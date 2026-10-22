"""Protection des données personnelles des invités (loi ivoirienne n° 2013-450 du 19 juin 2013, RGPD).

Durée de conservation limitée : une fois la durée réglée par le super admin écoulée après la cérémonie, les invités
sont anonymisés (nom, prénom, email, téléphone, entreprise, fonction effacés, QR code invalidé, liens du sondage et
messages d'erreur d'envoi supprimés). Les chiffres (inscrits, présents, modes d'émargement, avis anonymes) restent
disponibles pour les bilans. Opération irréversible, journalisée, lancée chaque nuit (Celery Beat) et par le cron
de la plateforme sans file d'attente.
"""

import calendar
from datetime import date

from django.db import transaction
from django.utils import timezone

from . import caches, temps_reel
from .journal import journaliser
from .models import EmailEnvoye, Evenement, InvitationSondage, Invite, Parametres, nouveau_qr_token

DOMAINE_ANONYME = "anonyme.invalid"  # domaine réservé (RFC 2606) : aucune adresse réelle
NOM_ANONYME = "Anonyme"
CONSERVATION_MIN_MOIS, CONSERVATION_MAX_MOIS = 1, 60


def mois_avant(jour, mois):
    """Même jour `mois` mois plus tôt (dernier jour du mois si ce jour n'existe pas)."""
    annee, m = divmod(jour.year * 12 + jour.month - 1 - mois, 12)
    return date(annee, m + 1, min(jour.day, calendar.monthrange(annee, m + 1)[1]))


def evenements_expires(aujourd_hui=None):
    duree = Parametres.charger().duree_conservation_mois
    limite = mois_avant(aujourd_hui or timezone.localdate(), duree)
    return Evenement.objects.filter(date__lt=limite, anonymise_le__isnull=True)


def anonymiser_evenement(evenement, auteur=None):
    """Anonymise tous les invités d'une cérémonie. Idempotent ; renvoie le nombre d'invités anonymisés."""
    with transaction.atomic():
        ev = Evenement.objects.select_for_update().get(pk=evenement.pk)
        if ev.anonymise_le is not None:
            return 0
        invites = list(ev.invites.all())
        for inv in invites:
            inv.nom, inv.prenom = NOM_ANONYME, ""
            inv.email = f"anonyme-{inv.pk}@{DOMAINE_ANONYME}"
            inv.telephone = inv.entreprise = inv.fonction = ""
            inv.qr_token = nouveau_qr_token()  # l'ancien QR code ne désigne plus personne
        champs = ["nom", "prenom", "email", "telephone", "entreprise", "fonction", "qr_token"]
        Invite.objects.bulk_update(invites, champs, batch_size=500)
        # messages d'erreur SMTP (peuvent citer l'adresse) et liens personnels du sondage (avis anonymes conservés)
        EmailEnvoye.objects.filter(invite__evenement=ev).exclude(erreur="").update(erreur="")
        InvitationSondage.objects.filter(invite__evenement=ev).delete()
        ev.anonymise_le = timezone.now()
        ev.save(update_fields=["anonymise_le"])
        journaliser(auteur, "DONNEES_ANONYMISATION", ev, evenement=ev.pk, invites=len(invites))
        caches.invalider(caches.cle_statistiques(ev.pk), caches.cle_public(ev.slug_inscription), caches.CLE_ANALYTIQUE)
        temps_reel.notifier_evenement(ev.pk, temps_reel.SUJETS_INVITES)
    return len(invites)


def anonymiser_donnees_expirees():
    total, evenements = 0, 0
    for ev in evenements_expires():
        total += anonymiser_evenement(ev)
        evenements += 1
    return {"evenements": evenements, "invites": total}
