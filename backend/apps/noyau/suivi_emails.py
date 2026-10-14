"""Suivi des trois emails d'une cérémonie : compteurs, échecs à traiter, renvoi groupé et email de test."""

import logging

from django.db import transaction
from django.utils import timezone

from . import emails, statuts
from .exceptions import ErreurMetier
from .journal import journaliser
from .models import EmailEnvoye, InvitationSondage, Parametres, StatutEmail, TypeEmail

ECHECS_AFFICHES = 50


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


def magazine_disponible(evenement):
    prog = evenement.programme
    return bool(prog.magazine_actif and prog.lien_magazine)


def suivi(evenement):
    resultat = {}
    derniers = _derniers_statuts(evenement)
    for type_email in TypeEmail.values:
        statuts_type = [statut for _, statut in derniers[type_email].values()]
        ids_echec = _ids_en_echec(derniers[type_email])
        echecs = (
            EmailEnvoye.objects.filter(pk__in=ids_echec).select_related("invite").order_by("-cree_le")[:ECHECS_AFFICHES]
        )
        bloc = {
            "envoyes": statuts_type.count(StatutEmail.ENVOYE),
            "attente": statuts_type.count(StatutEmail.EN_ATTENTE),
            "echecs": len(ids_echec),
            "listeEchecs": [
                {
                    "inviteId": e.invite_id,
                    "nomComplet": e.invite.nom_complet,
                    "email": e.invite.email,
                    "erreur": e.erreur[:200],
                    "tentatives": e.tentatives,
                    "le": e.cree_le.isoformat(),
                }
                for e in echecs
            ],
        }
        if type_email == TypeEmail.MAGAZINE:
            bloc["actif"] = magazine_disponible(evenement)
        elif type_email == TypeEmail.SONDAGE:
            bloc["actif"] = evenement.programme.sondage_actif
        resultat[type_email] = bloc
    return resultat


def _verifier_disponible(evenement, type_email):
    if type_email == TypeEmail.MAGAZINE and not magazine_disponible(evenement):
        raise ErreurMetier("MAGAZINE_INDISPONIBLE", "Le magazine est désactivé pour ce programme.")
    if type_email == TypeEmail.SONDAGE and not evenement.programme.sondage_actif:
        raise ErreurMetier("SONDAGE_INDISPONIBLE", "Le sondage de satisfaction est désactivé pour ce programme.")


def renvoyer_echecs(admin, evenement, type_email):
    """Replanifie l'email pour chaque invité dont le dernier envoi de ce type a échoué."""
    _verifier_disponible(evenement, type_email)
    ids_echec = _ids_en_echec(_derniers_statuts(evenement)[type_email])
    envois = EmailEnvoye.objects.filter(pk__in=ids_echec).select_related("invite__statut", "invite__evenement")
    renvoyables = None
    if type_email == TypeEmail.SONDAGE:
        renvoyables = set(
            InvitationSondage.objects.filter(
                invite__evenement=evenement, expire_le__gt=timezone.now(), repondu=False
            ).values_list("invite_id", flat=True)
        )
    with transaction.atomic():
        n = 0
        for envoi in envois:
            if type_email in (TypeEmail.MAGAZINE, TypeEmail.SONDAGE) and envoi.invite.statut.code != statuts.PRESENT:
                continue  # émargement annulé depuis : ni l'email n°2 ni le sondage ne repartent
            if renvoyables is not None and envoi.invite_id not in renvoyables:
                continue  # lien expiré (24 h) ou déjà utilisé : le renvoi n'aurait plus de sens
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
