"""Protection des données personnelles des invités (loi ivoirienne n° 2013-450 du 19 juin 2013, RGPD).

Durée de conservation limitée : une fois la durée réglée par le super admin écoulée après la cérémonie, les invités
sont anonymisés (nom, prénom, email, téléphone, entreprise, fonction, date du consentement effacés, QR code invalidé,
liens du sondage, messages d'erreur d'envoi et motifs d'annulation supprimés). Les chiffres (inscrits, présents,
modes d'émargement, avis anonymes) restent disponibles pour les bilans. Opération irréversible, journalisée,
lancée chaque nuit (Celery Beat) et par le cron de la plateforme sans file d'attente.
"""

import calendar
from datetime import date

from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from . import caches, temps_reel
from .journal import journaliser
from .models import EmailEnvoye, Emargement, Evenement, InvitationSondage, Invite, Parametres, nouveau_qr_token

DOMAINE_ANONYME = "anonyme.invalid"  # domaine réservé (RFC 2606) : aucune adresse réelle
NOM_ANONYME = "Anonyme"
CONSERVATION_MIN_MOIS, CONSERVATION_MAX_MOIS = 1, 60


def mois_avant(jour, mois):
    """Même jour `mois` mois plus tôt (dernier jour du mois si ce jour n'existe pas)."""
    annee, m = divmod(jour.year * 12 + jour.month - 1 - mois, 12)
    return date(annee, m + 1, min(jour.day, calendar.monthrange(annee, m + 1)[1]))


def _non_anonymises(evenement_qs_ou_ev):
    return Invite.objects.filter(evenement=evenement_qs_ou_ev).exclude(email__endswith=f"@{DOMAINE_ANONYME}")


def evenements_expires(aujourd_hui=None):
    """Cérémonies dont la durée de conservation est écoulée et qui ont encore des invités identifiables (y compris
    des invités ajoutés ou corrigés après une première anonymisation)."""
    duree = Parametres.charger().duree_conservation_mois
    limite = mois_avant(aujourd_hui or timezone.localdate(), duree)
    a_traiter = Invite.objects.filter(evenement=OuterRef("pk")).exclude(email__endswith=f"@{DOMAINE_ANONYME}")
    return Evenement.objects.filter(date__lt=limite).filter(Exists(a_traiter))


def anonymiser_evenement(evenement, auteur=None):
    """Anonymise les invités encore identifiables d'une cérémonie. Idempotent ; renvoie leur nombre."""
    with transaction.atomic():
        ev = Evenement.objects.select_for_update().get(pk=evenement.pk)
        invites = list(_non_anonymises(ev))
        if not invites:
            return 0
        for inv in invites:
            inv.nom, inv.prenom = NOM_ANONYME, ""
            inv.email = f"anonyme-{inv.pk}@{DOMAINE_ANONYME}"
            inv.telephone = inv.entreprise = inv.fonction = ""
            inv.consentement_le = None
            inv.qr_token = nouveau_qr_token()  # l'ancien QR code ne désigne plus personne
        champs = ["nom", "prenom", "email", "telephone", "entreprise", "fonction", "consentement_le", "qr_token"]
        Invite.objects.bulk_update(invites, champs, batch_size=500)
        ids = [inv.pk for inv in invites]
        # textes libres pouvant citer une personne : erreurs SMTP, motifs d'annulation ; liens personnels du sondage
        # (les avis, déjà anonymes, restent)
        EmailEnvoye.objects.filter(invite_id__in=ids).exclude(erreur="").update(erreur="")
        Emargement.objects.filter(invite_id__in=ids).exclude(motif_annulation="").update(motif_annulation="")
        InvitationSondage.objects.filter(invite_id__in=ids).delete()
        ev.anonymise_le = timezone.now()
        ev.save(update_fields=["anonymise_le"])
        journaliser(auteur, "DONNEES_ANONYMISATION", ev, evenement=ev.pk, invites=len(invites))
        caches.invalider(caches.cle_statistiques(ev.pk), caches.cle_public(ev.slug_inscription), caches.CLE_ANALYTIQUE)
        temps_reel.notifier_evenement(ev.pk, temps_reel.SUJETS_INVITES)
    return len(invites)


def anonymiser_donnees_expirees():
    total, evenements = 0, 0
    for ev in evenements_expires():
        n = anonymiser_evenement(ev)
        if n:
            total += n
            evenements += 1
    return {"evenements": evenements, "invites": total}
