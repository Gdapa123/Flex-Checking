"""Sondage de satisfaction (email n°3).

- Envoi : le lendemain de la cérémonie, à partir de 8 h (heure d'Abidjan), à chaque invité **présent** ; un seul
  envoi par invité (`InvitationSondage` unique par invité), y compris si la tâche planifiée tourne plusieurs fois.
- Lien personnel valable 24 h après sa création ; au-delà, la page publique affiche « sondage clos ».
- Une réponse par invité (lien) et une par appareil pour une même cérémonie (cookie posé par le serveur et
  identifiant du navigateur, conservés sous forme d'empreintes).
"""

import hashlib
import logging
from datetime import time, timedelta
from time import monotonic

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Max, Q
from django.utils import timezone

from . import dates, emails, statuts
from .exceptions import ErreurMetier
from .models import (
    DUREE_SONDAGE_HEURES,
    EmailEnvoye,
    Evenement,
    InvitationSondage,
    ReponseSondage,
    StatutEmail,
    TypeEmail,
)

logger = logging.getLogger(__name__)

HEURE_ENVOI = time(8, 0)
# sans file d'attente, durée maximale passée à envoyer dans la requête du cron (la plateforme coupe à 300 s)
BUDGET_SANS_FILE_S = 200
DUREE = timedelta(hours=DUREE_SONDAGE_HEURES)
COMMENTAIRES_AFFICHES = 20

A_VENIR, EN_COURS, TERMINE, DESACTIVE = "A_VENIR", "EN_COURS", "TERMINE", "DESACTIVE"


def debut_envoi(evenement):
    """Moment d'envoi prévu : le lendemain de la cérémonie à 8 h."""
    return dates.combiner(evenement.date + timedelta(days=1), HEURE_ENVOI)


# ---------------------------------------------------------------- envoi planifié
def planifier_sondages(maintenant=None, budget_s=BUDGET_SANS_FILE_S):
    """Crée le lien et programme l'email n°3 pour les présents des cérémonies de la veille.

    Appelée par Celery Beat (production) ou par le cron Vercel (environnement de test) ; idempotente : un invité
    qui a déjà un lien n'en reçoit pas d'autre. Avant 8 h, ne fait rien. Rend {programmes, envoyes}.

    Sans file d'attente (Vercel), les emails ne partent pas un par un pendant la création des liens : tous les liens
    et emails « en attente » sont d'abord enregistrés, puis envoyés tant que le budget de temps le permet ; le reste
    part au déclenchement suivant (second cron de la journée), qui reprend les emails encore en attente.
    """
    maintenant = maintenant or timezone.now()
    local = timezone.localtime(maintenant)
    if local.time() < HEURE_ENVOI:
        return {"programmes": 0, "envoyes": 0}
    # deux déclenchements simultanés (Beat et un appel manuel) ne se chevauchent pas
    # (`is False` : cache indisponible → on continue, l'unicité en base protège des doublons)
    if cache.add("sondages-envoi", 1, timeout=600) is False:
        return {"programmes": 0, "envoyes": 0}
    try:
        veille = local.date() - timedelta(days=1)
        sans_file = settings.ENVOI_SANS_FILE
        n = 0
        for ev in Evenement.objects.filter(date=veille, programme__sondage_actif=True):
            presents = ev.invites.filter(statut__code=statuts.PRESENT, sondage__isnull=True)
            for invite in presents.iterator():
                try:
                    with transaction.atomic():
                        InvitationSondage.objects.create(
                            invite=invite, cree_le=maintenant, expire_le=maintenant + DUREE
                        )
                        if sans_file:
                            EmailEnvoye.objects.create(invite=invite, type=TypeEmail.SONDAGE)
                        else:
                            emails.planifier(invite, TypeEmail.SONDAGE)
                except IntegrityError:
                    continue  # lien déjà créé par un autre déclenchement
                n += 1
        envoyes = _envoyer_en_attente(veille, budget_s) if sans_file else 0
        if n or envoyes:
            logger.info(
                "Sondage de satisfaction : %s lien(s) créé(s), %s email(s) envoyé(s) dans la requête.", n, envoyes
            )
        return {"programmes": n, "envoyes": envoyes}
    finally:
        cache.delete("sondages-envoi")


def _envoyer_en_attente(veille, budget_s):
    """Sans worker : envoie les emails n°3 encore en attente des cérémonies de la veille, dans le budget de temps."""
    from .tasks import envoyer_email

    debut = monotonic()
    ids = EmailEnvoye.objects.filter(
        type=TypeEmail.SONDAGE,
        statut=StatutEmail.EN_ATTENTE,
        tentatives=0,
        invite__evenement__date=veille,
    ).values_list("pk", flat=True)
    envoyes = 0
    for email_id in list(ids):
        if monotonic() - debut > budget_s:
            break
        envoyer_email(email_id)
        envoyes += 1
    return envoyes


# ---------------------------------------------------------------- état et résultats
def etat(evenement, maintenant=None):
    maintenant = maintenant or timezone.now()
    invitations = InvitationSondage.objects.filter(invite__evenement=evenement)
    if not invitations.exists():
        if not evenement.programme.sondage_actif:
            return DESACTIVE
        # aucun envoi : à venir jusqu'à la fin du lendemain (les rattrapages de la journée peuvent encore envoyer)
        return A_VENIR if timezone.localtime(maintenant).date() <= evenement.date + timedelta(days=1) else TERMINE
    return EN_COURS if invitations.filter(expire_le__gt=maintenant).exists() else TERMINE


def _repartition(qs, champ, valeurs):
    compte = dict(qs.values_list(champ).annotate(n=Count("id")).values_list(champ, "n"))
    return [{"valeur": v, "nb": compte.get(v, 0)} for v in valeurs]


def resultats(evenement):
    invitations = InvitationSondage.objects.filter(invite__evenement=evenement)
    envoyes = invitations.count()
    reponses = ReponseSondage.objects.filter(evenement=evenement)
    agg = reponses.aggregate(
        nb=Count("id"),
        globale=Avg("note_globale"),
        accueil=Avg("note_accueil"),
        reco=Avg("recommandation"),
        promoteurs=Count("id", filter=Q(recommandation__gte=9)),
        detracteurs=Count("id", filter=Q(recommandation__lte=6)),
    )
    nb = agg["nb"]
    commentaires = [
        {"texte": r.commentaire, "noteGlobale": r.note_globale, "le": r.cree_le.isoformat()}
        for r in reponses.exclude(commentaire="")[:COMMENTAIRES_AFFICHES]
    ]
    return {
        "actif": evenement.programme.sondage_actif,
        "etat": etat(evenement),
        "envoiPrevu": debut_envoi(evenement).isoformat(),
        "fermeLe": (invitations.aggregate(m=Max("expire_le"))["m"] or debut_envoi(evenement) + DUREE).isoformat(),
        "envoyes": envoyes,
        "reponses": nb,
        "tauxReponse": round(nb / envoyes * 100) if envoyes else 0,
        "noteGlobale": round(agg["globale"], 1) if nb else None,
        "noteAccueil": round(agg["accueil"], 1) if nb else None,
        "recommandation": round(agg["reco"], 1) if nb else None,
        # Net Promoter Score : % de 9-10 moins % de 0-6
        "nps": round((agg["promoteurs"] - agg["detracteurs"]) / nb * 100) if nb else None,
        "promoteurs": agg["promoteurs"],
        "passifs": nb - agg["promoteurs"] - agg["detracteurs"],
        "detracteurs": agg["detracteurs"],
        "repartitionGlobale": _repartition(reponses, "note_globale", range(1, 6)),
        "repartitionAccueil": _repartition(reponses, "note_accueil", range(1, 6)),
        "commentaires": commentaires,
    }


def _moyenne(v):
    return round(v, 1) if v is not None else None


def _nps(promoteurs, detracteurs, nb):
    return round((promoteurs - detracteurs) / nb * 100) if nb else None


def resume_global(maintenant=None):
    """Vue d'ensemble du super admin : une ligne par cérémonie ayant reçu au moins un envoi, plus le cumul.
    Requêtes groupées par cérémonie (nombre de requêtes constant, quel que soit le nombre de cérémonies)."""
    maintenant = maintenant or timezone.now()
    envois = {
        r["invite__evenement"]: r
        for r in InvitationSondage.objects.values("invite__evenement").annotate(
            envoyes=Count("id"), ouverts=Count("id", filter=Q(expire_le__gt=maintenant))
        )
    }
    stats = {
        r["evenement"]: r
        for r in ReponseSondage.objects.values("evenement").annotate(
            nb=Count("id"),
            globale=Avg("note_globale"),
            accueil=Avg("note_accueil"),
            promoteurs=Count("id", filter=Q(recommandation__gte=9)),
            detracteurs=Count("id", filter=Q(recommandation__lte=6)),
        )
    }
    lignes = []
    for ev in Evenement.objects.filter(pk__in=envois).select_related("programme").order_by("-date"):
        e, r = envois[ev.pk], stats.get(ev.pk, {})
        nb = r.get("nb", 0)
        lignes.append(
            {
                "evenementId": ev.pk,
                "nomAffiche": ev.nom_affiche,
                "programme": ev.programme.nom,
                "date": ev.date.isoformat(),
                "etat": EN_COURS if e["ouverts"] else TERMINE,
                "envoyes": e["envoyes"],
                "reponses": nb,
                "tauxReponse": round(nb / e["envoyes"] * 100) if e["envoyes"] else 0,
                "noteGlobale": _moyenne(r.get("globale")),
                "noteAccueil": _moyenne(r.get("accueil")),
                "nps": _nps(r.get("promoteurs", 0), r.get("detracteurs", 0), nb),
            }
        )
    toutes = ReponseSondage.objects.aggregate(
        nb=Count("id"),
        globale=Avg("note_globale"),
        accueil=Avg("note_accueil"),
        promoteurs=Count("id", filter=Q(recommandation__gte=9)),
        detracteurs=Count("id", filter=Q(recommandation__lte=6)),
    )
    envoyes = sum(e["envoyes"] for e in envois.values())
    nb = toutes["nb"]
    return {
        "envoyes": envoyes,
        "reponses": nb,
        "tauxReponse": round(nb / envoyes * 100) if envoyes else 0,
        "noteGlobale": _moyenne(toutes["globale"]),
        "noteAccueil": _moyenne(toutes["accueil"]),
        "nps": _nps(toutes["promoteurs"], toutes["detracteurs"], nb),
        "ceremonies": lignes,
    }


# ---------------------------------------------------------------- réponse publique
def empreinte(evenement_id, identifiant):
    return hashlib.sha256(f"{evenement_id}:{identifiant}".encode()).hexdigest() if identifiant else ""


def invitation_par_jeton(jeton):
    return (
        InvitationSondage.objects.select_related("invite__evenement__programme", "invite__statut")
        .filter(jeton=jeton)
        .first()
    )


def etat_lien(invitation):
    if invitation.repondu:
        return "REPONDU"
    return "EXPIRE" if invitation.expire else "OUVERT"


def repondre(invitation, donnees, *, appareil_cookie, appareil_local):
    """Enregistre la réponse ; refuse un lien expiré, déjà utilisé ou un appareil ayant déjà répondu."""
    ev_id = invitation.invite.evenement_id
    cookie, local = empreinte(ev_id, appareil_cookie), empreinte(ev_id, appareil_local)
    with transaction.atomic():
        invitation = InvitationSondage.objects.select_for_update().get(pk=invitation.pk)
        if invitation.expire:
            raise ErreurMetier("SONDAGE_EXPIRE", "Le sondage est clos.", status=410)
        if invitation.repondu:
            raise ErreurMetier("DEJA_REPONDU", "Vous avez déjà répondu à ce sondage. Merci !")
        empreintes = [e for e in (cookie, local) if e]
        if ReponseSondage.objects.filter(
            Q(appareil__in=empreintes) | Q(appareil_local__in=empreintes), evenement_id=ev_id
        ).exists():
            raise ErreurMetier("APPAREIL_DEJA_UTILISE", "Un avis a déjà été envoyé depuis cet appareil. Merci !")
        try:
            with transaction.atomic():
                reponse = ReponseSondage.objects.create(
                    evenement_id=ev_id,
                    appareil=cookie or local,
                    appareil_local=local if cookie else "",
                    cree_le=timezone.now().replace(minute=0, second=0, microsecond=0),
                    **donnees,
                )
            invitation.repondu = True
            invitation.save(update_fields=["repondu"])
            return reponse
        except IntegrityError as exc:  # même appareil, deux envois simultanés
            raise ErreurMetier(
                "APPAREIL_DEJA_UTILISE", "Un avis a déjà été envoyé depuis cet appareil. Merci !"
            ) from exc


def sondage_renvoyable(invite):
    """Email n°3 : renvoi possible tant que le lien est ouvert et que l'invité n'a pas répondu."""
    invitation = InvitationSondage.objects.filter(invite=invite).first()
    return bool(invitation and not invitation.expire and not invitation.repondu)
