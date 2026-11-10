"""Suivi des trois emails d'une cérémonie : invités à contacter, compteurs, échecs, renvoi groupé et email de test."""

import logging
import re
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from . import emails, statuts
from .adresses import suggerer_correction
from .donnees_personnelles import DOMAINE_ANONYME
from .exceptions import ErreurMetier
from .journal import journaliser
from .models import EmailEnvoye, InvitationSondage, JournalActivite, Parametres, StatutEmail, TypeEmail

A_CONTACTER_AFFICHES = 200
# un email sans tentative depuis 15 min est normalement repris par `tasks.relancer_emails_en_attente`
ATTENTE_ANORMALE = timedelta(minutes=15)

# Cause d'un échec, lue dans le message d'erreur SMTP (codes RFC 5321 / 3463 et classes d'exception de smtplib).
# côté « adresse » : l'adresse de l'invité est en cause (à corriger ou à confirmer avec lui) ;
# côté « envoi » : notre serveur d'envoi est en cause (configuration, réseau, réputation, taille), l'invité n'y est
# pour rien. Ordre : notre côté d'abord (expéditeur refusé, authentification, filtrage 5.7.x, taille), car ces
# messages citent souvent « users », « exist » ou « domain » ; puis les codes précis de l'adresse ; puis le texte.
CAUSES = [
    (
        r"SMTPSenderRefused|5\.1\.[78]\b|sender address",
        "EXPEDITEUR_REFUSE",
        "Adresse d’expédition refusée",
        "envoi",
    ),
    (
        r"SMTPAuthenticationError|\b535\b|5\.7\.8",
        "AUTHENTIFICATION",
        "Identifiants du serveur d’envoi refusés",
        "envoi",
    ),
    (
        r"5\.7\.\d+|\b554\b|spam|blocked|blacklist|policy",
        "FILTRAGE",
        "Refusé par filtrage (réputation ou authentification du domaine d’envoi)",
        "envoi",
    ),
    (r"5\.3\.4|message size|too large|size limit", "TAILLE", "Email trop volumineux pour le serveur", "envoi"),
    (
        r"5\.1\.2|host unknown|nxdomain|domain (not found|does not exist)",
        "DOMAINE_INEXISTANT",
        "Domaine de l’adresse inexistant",
        "adresse",
    ),
    (
        r"5\.1\.[01]\b|user unknown|no such user|mailbox unavailable"
        r"|(account|mailbox|address|user) (that you tried to reach )?does not exist",
        "ADRESSE_INEXISTANTE",
        "Adresse inexistante",
        "adresse",
    ),
    (
        r"[45]\.2\.2|mailbox (is )?full|over quota|quota exceeded",
        "BOITE_PLEINE",
        "Boîte de réception pleine",
        "adresse",
    ),
    (r"SMTPRecipientsRefused", "ADRESSE_REFUSEE", "Adresse refusée par le serveur", "adresse"),
    (
        r"timed? ?out|Timeout|SMTPServerDisconnected|SMTPConnectError|ConnectionRefused|ConnectionReset|"
        r"socket|gaierror|OSError|Network",
        "SERVEUR_INJOIGNABLE",
        "Serveur d’envoi injoignable",
        "envoi",
    ),
]
CAUSES = [(re.compile(motif, re.IGNORECASE), code, libelle, cote) for motif, code, libelle, cote in CAUSES]


def cause_echec(erreur):
    """(code, libellé, côté) d'un échec d'envoi, d'après le message d'erreur enregistré."""
    for motif, code, libelle, cote in CAUSES:
        if motif.search(erreur or ""):
            return code, libelle, cote
    return "INCONNUE", "Erreur d’envoi", "envoi"


def _derniers_statuts(evenement):
    """Dernier envoi de chaque type pour chaque invité : {type: {invite_id: (email_id, statut)}}, en une requête
    sur des colonnes simples (aucun objet chargé)."""
    derniers = {t: {} for t in TypeEmail.values}
    lignes = (
        EmailEnvoye.objects.filter(invite__evenement=evenement)
        .order_by("cree_le", "pk")
        .values_list("type", "invite_id", "pk", "statut")
    )
    for type_email, invite_id, pk, statut in lignes:
        derniers.setdefault(type_email, {})[invite_id] = (pk, statut)
    return derniers


def _ids_en_echec(derniers_type):
    return [pk for pk, statut in derniers_type.values() if statut == StatutEmail.ECHEC]


def a_contacter(evenement, derniers):
    """Invités dont un email n'est pas (ou probablement pas) arrivé, avec la cause et l'action utile.

    Un invité par ligne (plusieurs problèmes possibles) : invitation jamais envoyée, dernier envoi en échec (cause
    lue dans l'erreur SMTP), envoi bloqué en attente, adresse probablement mal tapée (le serveur l'accepte puis
    l'abandonne sans que l'application le sache). Quatre requêtes, quel que soit le nombre d'invités.

    `causes_envoi` : nombre d'invités dont au moins un problème vient de l'envoi (pas de leur adresse).
    """
    maintenant = timezone.now()
    invites = list(
        evenement.invites.exclude(email__endswith=f"@{DOMAINE_ANONYME}")
        .select_related("statut")
        .only("id", "evenement_id", "civilite", "nom", "prenom", "email", "telephone", "statut__code")
    )
    a_examiner = {
        pk
        for type_email in TypeEmail.values
        for pk, statut in derniers[type_email].values()
        if statut in (StatutEmail.ECHEC, StatutEmail.EN_ATTENTE)
    }
    envois = {
        e["pk"]: e
        for e in EmailEnvoye.objects.filter(pk__in=a_examiner).values(
            "pk", "type", "statut", "erreur", "tentatives", "cree_le", "derniere_tentative_le"
        )
    }
    # invités ajoutés à la main en décochant l'envoi de l'invitation : aucune invitation attendue (journal sans donnée
    # personnelle, `services.creer_invite`)
    sans_invitation_voulue = set(
        JournalActivite.objects.filter(
            action="INVITE_AJOUT",
            cible_type="Invite",
            cible_id__in=[i.pk for i in invites],
            details__email_envoye=False,
        ).values_list("cible_id", flat=True)
    )
    lignes, causes_envoi = [], 0
    for inv in invites:
        present = inv.statut.code == statuts.PRESENT
        problemes = []
        if inv.pk not in derniers[TypeEmail.INVITATION] and inv.pk not in sans_invitation_voulue:
            problemes.append(
                {
                    "code": "JAMAIS_ENVOYE",
                    "type": TypeEmail.INVITATION,
                    "libelle": "Invitation jamais envoyée",
                    "cote": "envoi",
                }
            )
        for type_email in TypeEmail.values:
            pk_statut = derniers[type_email].get(inv.pk)
            e = envois.get(pk_statut[0]) if pk_statut else None
            if e is None or (type_email != TypeEmail.INVITATION and not present):
                continue  # magazine et sondage : seulement pour un invité encore présent
            if e["statut"] == StatutEmail.ECHEC:
                if e["erreur"].startswith("Sondage non envoyé"):
                    continue  # lien clos ou présence annulée : rien à faire
                code, libelle, cote = cause_echec(e["erreur"])
                problemes.append(
                    {
                        "code": code,
                        "type": type_email,
                        "libelle": libelle,
                        "cote": cote,
                        "detail": e["erreur"][:200],
                        "le": (e["derniere_tentative_le"] or e["cree_le"]).isoformat(),
                    }
                )
            elif e["statut"] == StatutEmail.EN_ATTENTE and e["cree_le"] < maintenant - ATTENTE_ANORMALE:
                problemes.append(
                    {
                        "code": "BLOQUE",
                        "type": type_email,
                        "libelle": "En attente depuis plus de 15 min (nouvel essai automatique)",
                        "cote": "envoi",
                        "le": e["cree_le"].isoformat(),
                    }
                )
        suggestion = suggerer_correction(inv.email)
        if suggestion:
            problemes.append(
                {
                    "code": "ADRESSE_DOUTEUSE",
                    "type": TypeEmail.INVITATION,
                    "libelle": "Adresse probablement mal tapée",
                    "cote": "adresse",
                }
            )
        if problemes:
            causes_envoi += any(p["cote"] == "envoi" for p in problemes)
            lignes.append(
                {
                    "invite_id": inv.pk,
                    "nom_complet": inv.nom_complet,
                    "email": inv.email,
                    "telephone": inv.telephone,
                    "statut": inv.statut.code,
                    "suggestion": suggestion,
                    # corriger l'adresse d'abord si elle est en cause ; sinon un simple renvoi suffit
                    "action": "CORRIGER" if any(p["cote"] == "adresse" for p in problemes) else "RENVOYER",
                    "problemes": problemes,
                }
            )
    lignes.sort(key=lambda x: (x["action"] != "CORRIGER", x["nom_complet"]))
    return {"total": len(lignes), "causes_envoi": causes_envoi, "invites": lignes[:A_CONTACTER_AFFICHES]}


def suivi(evenement):
    resultat = {}
    derniers = _derniers_statuts(evenement)
    for type_email in TypeEmail.values:
        statuts_type = [statut for _, statut in derniers[type_email].values()]
        bloc = {
            "envoyes": statuts_type.count(StatutEmail.ENVOYE),
            "attente": statuts_type.count(StatutEmail.EN_ATTENTE),
            # le détail, invité par invité, est dans « Invités à contacter » (`a_contacter`)
            "echecs": len(_ids_en_echec(derniers[type_email])),
        }
        if type_email == TypeEmail.MAGAZINE:
            bloc["actif"] = True  # toujours envoyé au passage « Présent »
        elif type_email == TypeEmail.SONDAGE:
            bloc["actif"] = evenement.programme.sondage_actif
        resultat[type_email] = bloc
    resultat["a_contacter"] = a_contacter(evenement, derniers)
    return resultat


def _verifier_disponible(evenement, type_email):
    if type_email == TypeEmail.SONDAGE and not evenement.programme.sondage_actif:
        raise ErreurMetier("SONDAGE_INDISPONIBLE", "Le sondage de satisfaction est désactivé pour ce programme.")


def renvoyer_echecs(admin, evenement, type_email):
    """Replanifie l'email pour chaque invité dont le dernier envoi de ce type a échoué."""
    _verifier_disponible(evenement, type_email)
    ids_echec = _ids_en_echec(_derniers_statuts(evenement)[type_email])
    envois = EmailEnvoye.objects.filter(pk__in=ids_echec).select_related("invite__statut", "invite__evenement")
    renvoyables = None
    if type_email == TypeEmail.SONDAGE:
        # liens encore ouverts, que l'invité ait répondu ou non : le renvoi ne doit pas révéler qui a répondu
        renvoyables = set(
            InvitationSondage.objects.filter(invite__evenement=evenement, expire_le__gt=timezone.now()).values_list(
                "invite_id", flat=True
            )
        )
    with transaction.atomic():
        n = 0
        for envoi in envois:
            if type_email in (TypeEmail.MAGAZINE, TypeEmail.SONDAGE) and envoi.invite.statut.code != statuts.PRESENT:
                continue  # émargement annulé depuis : ni l'email n°2 ni le sondage ne repartent
            if renvoyables is not None and envoi.invite_id not in renvoyables:
                continue  # lien expiré (24 h) : le renvoi n'aurait plus de sens
            emails.planifier(envoi.invite, type_email)
            n += 1
        if n:
            journaliser(admin, "EMAIL_RENVOI", None, evenement=evenement.pk, type=type_email, nb=n)
    return n


def envoyer_test(admin, evenement, type_email, source):
    """Envoie l'email, rempli avec un invité d'exemple, à l'adresse du compte connecté (objet préfixé « [Test] »)."""
    _verifier_disponible(evenement, type_email)
    p = Parametres.charger()
    rendu = emails.rendre(type_email, source, parametres=p)
    message = emails.message_depuis_rendu(rendu, admin.email, p, prefixe_objet="[Test] ")
    try:
        message.send()
    except Exception as exc:  # noqa: BLE001 — SMTP indisponible, adresse refusée…
        logging.getLogger(__name__).warning("Email de test non envoyé : %s", exc.__class__.__name__)
        raise ErreurMetier(
            "ENVOI_IMPOSSIBLE", "L’email de test n’a pas pu être envoyé. Réessayez plus tard.", status=502
        ) from exc
    journaliser(admin, "EMAIL_TEST", None, evenement=evenement.pk, type=type_email)
    return admin.email
