"""Statistiques du tableau de bord admin (temps réel, interrogées toutes les 5 s)."""

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from . import statuts
from .dates import combiner, heure
from .models import EmailEnvoye, Emargement, Evenement, ModeEmargement, StatutEmail, TypeEmail

TRANCHE = timedelta(minutes=15)


def _plancher(dt):
    return dt.replace(minute=dt.minute - dt.minute % 15, second=0, microsecond=0)


def statistiques(evenement):
    maintenant = timezone.now()
    invites = evenement.invites.all()
    agg = invites.aggregate(
        inscrits=Count("id"),
        presents=Count("id", filter=Q(statut__code=statuts.PRESENT)),
        recents=Count("id", filter=Q(statut__code=statuts.PRESENT, present_le__gte=maintenant - TRANCHE)),
    )
    inscrits, presents = agg["inscrits"], agg["presents"]

    # --- arrivées par tranche de 15 minutes ---
    heures = [
        timezone.localtime(h) for h in invites.filter(present_le__isnull=False).values_list("present_le", flat=True)
    ]
    debut = _plancher(combiner(evenement.date, evenement.heure_accueil))
    fin = combiner(evenement.date, evenement.heure_debut) + timedelta(hours=1)
    jour = [h for h in heures if h.date() == evenement.date]
    if jour:
        debut = min(debut, _plancher(min(jour)))
        fin = max(fin, _plancher(max(jour)) + TRANCHE)
    if evenement.date == timezone.localdate():
        fin = min(fin, max(_plancher(timezone.localtime(maintenant)) + TRANCHE, debut + 8 * TRANCHE))
    tranches = []
    t = debut
    while t < fin and len(tranches) < 48:
        n = sum(1 for h in jour if t <= h < t + TRANCHE)
        tranches.append({"debut": heure(t.time()), "fin": heure((t + TRANCHE).time()), "arrivees": n})
        t += TRANCHE
    courante = max((i for i, tr in enumerate(tranches) if tr["arrivees"]), default=None)
    pic = max(tranches, key=lambda tr: tr["arrivees"], default=None)

    # --- répartition par mode ---
    par_mode = dict(invites.filter(statut__code=statuts.PRESENT).values_list("mode_emargement").annotate(n=Count("id")))
    modes = [{"mode": m.value, "libelle": m.label, "nb": par_mode.get(m.value, 0)} for m in ModeEmargement]

    # --- arrivées par poste d'accueil (émargements non annulés) ---
    postes = [
        {"poste": p or "Non précisé", "nb": n}
        for p, n in Emargement.objects.filter(invite__evenement=evenement, annule_le__isnull=True)
        .values_list("poste")
        .annotate(n=Count("id"))
        .order_by("-n")[:8]
    ]

    # --- inscriptions par jour (cumul) ---
    jours = {}
    for d in invites.values_list("inscrit_le", flat=True):
        cle = timezone.localtime(d).date()
        jours[cle] = jours.get(cle, 0) + 1
    cumul, inscriptions = 0, []
    for jour in sorted(jours):
        cumul += jours[jour]
        inscriptions.append({"date": jour.isoformat(), "nb": jours[jour], "cumul": cumul})

    # --- emails : statut du dernier envoi de chaque type par invité ---
    emails = EmailEnvoye.objects.filter(invite__evenement=evenement)

    def derniers(type_email):
        etat = {}
        for invite_id, statut in (
            emails.filter(type=type_email).order_by("cree_le", "pk").values_list("invite_id", "statut")
        ):
            etat[invite_id] = statut
        return etat

    inv, mag = derniers(TypeEmail.INVITATION), derniers(TypeEmail.MAGAZINE)

    # --- comparaison avec les éditions précédentes du même programme ---
    editions = (
        Evenement.objects.filter(programme=evenement.programme, date__lte=evenement.date)
        .annotate(
            nb_inscrits=Count("invites", distinct=True),
            nb_presents=Count("invites", filter=Q(invites__statut__code=statuts.PRESENT), distinct=True),
        )
        .order_by("-date")[:5]
    )
    comparaison = [
        {
            "evenement": e.pk,
            "annee": e.annee,
            "inscrits": e.nb_inscrits,
            "presents": e.nb_presents,
            "taux": round(e.nb_presents / e.nb_inscrits * 100) if e.nb_inscrits else 0,
            "enCours": e.pk == evenement.pk,
        }
        for e in editions
    ]

    return {
        "inscrits": inscrits,
        "presents": presents,
        "nonPresents": inscrits - presents,
        "taux": round(presents / inscrits * 100) if inscrits else 0,
        "capacite": evenement.capacite,
        "presents15min": agg["recents"],
        "heureDebut": heure(evenement.heure_debut),
        "tranches": tranches,
        "trancheCourante": courante,
        "pic": pic if pic and pic["arrivees"] else None,
        "modes": modes,
        "postes": postes,
        "inscriptions": inscriptions[-60:],
        "remplissage": round(inscrits / evenement.capacite * 100) if evenement.capacite else 0,
        "emails": {
            "invitationsEnvoyees": sum(1 for s in inv.values() if s == StatutEmail.ENVOYE),
            "invitationsEchec": sum(1 for s in inv.values() if s == StatutEmail.ECHEC),
            "invitationsAttente": sum(1 for s in inv.values() if s == StatutEmail.EN_ATTENTE),
            "magazinesEnvoyes": sum(1 for s in mag.values() if s == StatutEmail.ENVOYE),
            "magazinesEchec": sum(1 for s in mag.values() if s == StatutEmail.ECHEC),
            "magazineActif": evenement.programme.magazine_actif,
        },
        "comparaison": comparaison,
        "misAJour": maintenant.isoformat(),
    }
