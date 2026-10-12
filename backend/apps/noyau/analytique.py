"""Analyses du super admin : activité de tous les événements et indicateurs techniques."""

import time
from datetime import timedelta

from django.db import connection
from django.db.models import Count, Q
from django.utils import timezone

from . import statuts
from .mesures import _redis, dernieres_minutes
from .models import (
    EmailEnvoye,
    Emargement,
    ErreurTechnique,
    Evenement,
    Invite,
    ModeEmargement,
    SourceErreur,
    StatutEmail,
    TypeEmail,
)
from .services import statut_evenement


def _taux(presents, inscrits):
    return round(presents / inscrits * 100) if inscrits else 0


def analytique():
    evenements = list(
        Evenement.objects.select_related("programme")
        .annotate(
            nb_inscrits=Count("invites", distinct=True),
            nb_presents=Count("invites", filter=Q(invites__statut__code=statuts.PRESENT), distinct=True),
        )
        .order_by("date")
    )
    lignes = [
        {
            "id": e.pk,
            "nom": e.nom_affiche,
            "programme": e.programme.nom,
            "couleur": e.programme.couleur_principale,
            "annee": e.annee,
            "date": e.date.isoformat(),
            "capacite": e.capacite,
            "inscrits": e.nb_inscrits,
            "presents": e.nb_presents,
            "taux": _taux(e.nb_presents, e.nb_inscrits),
            "remplissage": round(e.nb_inscrits / e.capacite * 100) if e.capacite else 0,
            "statut": statut_evenement(e, e.nb_inscrits),
        }
        for e in evenements
    ]

    # par programme et par année (comparaison annuelle)
    programmes, annees = {}, {}
    for e in lignes:
        p = programmes.setdefault(
            e["programme"],
            {"programme": e["programme"], "couleur": e["couleur"], "evenements": 0, "inscrits": 0, "presents": 0},
        )
        p["evenements"] += 1
        p["inscrits"] += e["inscrits"]
        p["presents"] += e["presents"]
        a = annees.setdefault(
            (e["annee"], e["programme"]),
            {"annee": e["annee"], "programme": e["programme"], "couleur": e["couleur"], "inscrits": 0, "presents": 0},
        )
        a["inscrits"] += e["inscrits"]
        a["presents"] += e["presents"]
    for groupe in (*programmes.values(), *annees.values()):
        groupe["taux"] = _taux(groupe["presents"], groupe["inscrits"])

    # inscriptions par jour sur 60 jours (toutes cérémonies)
    depuis = timezone.now() - timedelta(days=59)
    jours = {}
    for d in Invite.objects.filter(inscrit_le__gte=depuis).values_list("inscrit_le", flat=True):
        cle = timezone.localtime(d).date()
        jours[cle] = jours.get(cle, 0) + 1
    debut = timezone.localdate() - timedelta(days=59)
    inscriptions = [
        {"date": (debut + timedelta(days=i)).isoformat(), "nb": jours.get(debut + timedelta(days=i), 0)}
        for i in range(60)
    ]

    par_mode = dict(
        Invite.objects.filter(statut__code=statuts.PRESENT).values_list("mode_emargement").annotate(n=Count("id"))
    )
    emails = dict(EmailEnvoye.objects.values_list("statut").annotate(n=Count("id")))
    entreprises = (
        Invite.objects.exclude(entreprise="").values_list("entreprise").annotate(n=Count("id")).order_by("-n")[:8]
    )
    inscrits = sum(e["inscrits"] for e in lignes)
    presents = sum(e["presents"] for e in lignes)
    return {
        "totaux": {
            "evenements": len(lignes),
            "inscrits": inscrits,
            "presents": presents,
            "taux": _taux(presents, inscrits),
            "emailsEnvoyes": emails.get(StatutEmail.ENVOYE, 0),
            "emailsEchec": emails.get(StatutEmail.ECHEC, 0),
            "emailsAttente": emails.get(StatutEmail.EN_ATTENTE, 0),
            "magazinesEnvoyes": EmailEnvoye.objects.filter(type=TypeEmail.MAGAZINE, statut=StatutEmail.ENVOYE).count(),
        },
        "evenements": lignes,
        "programmes": sorted(programmes.values(), key=lambda p: -p["inscrits"]),
        "annees": sorted(annees.values(), key=lambda a: (a["annee"], a["programme"])),
        "inscriptionsParJour": inscriptions,
        "modes": [{"mode": m.value, "libelle": m.label, "nb": par_mode.get(m.value, 0)} for m in ModeEmargement],
        "entreprises": [{"entreprise": nom, "nb": n} for nom, n in entreprises],
        "misAJour": timezone.now().isoformat(),
    }


def _latence_base():
    try:
        debut = time.monotonic()
        with connection.cursor() as c:
            c.execute("SELECT 1")
        return round((time.monotonic() - debut) * 1000, 1)
    except Exception:  # noqa: BLE001
        return None


def _redis_etat():
    r = _redis()
    if r is None:
        return None, None
    try:
        debut = time.monotonic()
        r.ping()
        latence = round((time.monotonic() - debut) * 1000, 1)
        return latence, r.llen("celery")
    except Exception:  # noqa: BLE001
        return None, None


def technique():
    maintenant = timezone.now()
    latence_redis, file_celery = _redis_etat()
    depuis = timezone.localdate() - timedelta(days=13)
    debut_periode = timezone.make_aware(timezone.datetime.combine(depuis, timezone.datetime.min.time()))
    par_jour = {}
    # (filtre sur un instant, pas sur `__date` : MySQL sans tables de fuseaux renverrait NULL)
    for source, premiere in ErreurTechnique.objects.filter(premiere__gte=debut_periode).values_list(
        "source", "premiere"
    ):
        cle = timezone.localtime(premiere).date()
        par_jour.setdefault(cle, {s: 0 for s in SourceErreur.values})[source] += 1
    erreurs_jour = [
        {
            "date": (depuis + timedelta(days=i)).isoformat(),
            **par_jour.get(depuis + timedelta(days=i), {s: 0 for s in SourceErreur.values}),
        }
        for i in range(14)
    ]
    par_source = dict(ErreurTechnique.objects.filter(resolue=False).values_list("source").annotate(n=Count("id")))
    occurrences = dict(
        ErreurTechnique.objects.filter(derniere__gte=maintenant - timedelta(days=1))
        .values_list("source")
        .annotate(n=Count("id"))
    )
    jour = maintenant - timedelta(days=1)
    emails_24h = dict(EmailEnvoye.objects.filter(cree_le__gte=jour).values_list("statut").annotate(n=Count("id")))
    minutes = dernieres_minutes(60)
    total = sum(m["requetes"] for m in minutes)
    latence_base = _latence_base()
    return {
        "sante": {
            "base": latence_base is not None,
            "baseMs": latence_base,
            "redis": latence_redis is not None,
            "redisMs": latence_redis,
            "fileEmails": file_celery,
        },
        "requetes": minutes,
        "resume": {
            "requetesHeure": total,
            "erreurs5xxHeure": sum(m["erreurs5xx"] for m in minutes),
            "lentesHeure": sum(m["lentes"] for m in minutes),
            "dureeMoyenneMs": round(sum(m["dureeMoyenneMs"] * m["requetes"] for m in minutes) / total) if total else 0,
            "scansHeure": Emargement.objects.filter(date__gte=maintenant - timedelta(hours=1)).count(),
        },
        "erreursParJour": erreurs_jour,
        "erreursATraiter": [
            {
                "source": s.value,
                "libelle": s.label,
                "nb": par_source.get(s.value, 0),
                "dernieres24h": occurrences.get(s.value, 0),
            }
            for s in SourceErreur
        ],
        "emails24h": {
            "envoyes": emails_24h.get(StatutEmail.ENVOYE, 0),
            "echecs": emails_24h.get(StatutEmail.ECHEC, 0),
            "attente": emails_24h.get(StatutEmail.EN_ATTENTE, 0),
        },
        "misAJour": maintenant.isoformat(),
    }
