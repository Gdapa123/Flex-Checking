"""Règles métier garanties côté serveur : inscription, émargement, annulation."""

import secrets
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone

from . import emails, statuts
from .exceptions import ErreurMetier
from .journal import journaliser
from .models import Emargement, Invite, ModeEmargement, Source, Statut, TypeEmail

# --- États d'ouverture des inscriptions ---
OUVERT, FERME, COMPLET, DATE_LIMITE = "OUVERT", "FERME", "COMPLET", "DATE_LIMITE"


def etat_inscriptions(evenement, nb_inscrits=None):
    if not evenement.inscriptions_ouvertes:
        return FERME
    if timezone.localdate() > evenement.date_limite_inscription:
        return DATE_LIMITE
    if nb_inscrits is None:
        nb_inscrits = evenement.invites.count()
    if nb_inscrits >= evenement.capacite:
        return COMPLET
    return OUVERT


MESSAGES_ETAT = {
    FERME: "Les inscriptions sont fermées.",
    DATE_LIMITE: "La date limite d’inscription est dépassée.",
    COMPLET: "L’événement est complet.",
}


def statut_evenement(evenement, nb_inscrits=None):
    """Libellé de statut affiché dans les listes (admin, super admin)."""
    aujourd_hui = timezone.localdate()
    if evenement.date == aujourd_hui:
        return "AUJOURDHUI"
    if evenement.date < aujourd_hui:
        return "TERMINEE"
    etat = etat_inscriptions(evenement, nb_inscrits)
    return {OUVERT: "INSCRIPTIONS_OUVERTES", COMPLET: "COMPLET"}.get(etat, "INSCRIPTIONS_FERMEES")


# --- Codes à 4 chiffres ---
def tirer_code(evenement):
    """Tirage aléatoire (secrets) d'un code à 4 chiffres libre pour l'événement."""
    pris = set(evenement.invites.values_list("code", flat=True))
    if len(pris) >= 10000:
        raise ErreurMetier("CODES_EPUISES", "Plus aucun code disponible pour cet événement.")
    while True:
        code = f"{secrets.randbelow(10000):04d}"
        if code not in pris:
            return code


def creer_invite(evenement, donnees, *, source, auteur=None, envoyer_invitation=True):
    """Crée un invité (statut INSCRIT, code, qrToken) et planifie l'email n°1 après commit.

    Gère la collision de code (nouveau tirage) et le doublon d'email (DEJA_INSCRIT)."""
    email = donnees["email"].strip().lower()
    for _ in range(20):
        try:
            with transaction.atomic():
                if Invite.objects.filter(evenement=evenement, email=email).exists():
                    raise ErreurMetier("DEJA_INSCRIT", "Cette adresse est déjà inscrite à cet événement.")
                maintenant = timezone.now()
                invite = Invite.objects.create(
                    evenement=evenement,
                    statut=Statut.par_code(statuts.INSCRIT),
                    civilite=donnees["civilite"],
                    nom=donnees["nom"].strip(),
                    prenom=donnees["prenom"].strip(),
                    email=email,
                    telephone=donnees["telephone"],
                    entreprise=(donnees.get("entreprise") or "").strip(),
                    fonction=(donnees.get("fonction") or "").strip(),
                    source=source,
                    code=tirer_code(evenement),
                    consentement_donnees=bool(donnees.get("consentement_donnees", source == Source.MANUEL)),
                    consentement_le=maintenant if donnees.get("consentement_donnees") else None,
                    inscrit_le=maintenant,
                )
                if envoyer_invitation:
                    emails.planifier(invite, TypeEmail.INVITATION)
                if auteur is not None:
                    journaliser(auteur, "INVITE_AJOUT", invite, evenement=evenement.pk, email_envoye=envoyer_invitation)
                return invite
        except IntegrityError as exc:
            if "invite_unique_email" in str(exc):
                raise ErreurMetier("DEJA_INSCRIT", "Cette adresse est déjà inscrite à cet événement.") from exc
            continue  # collision de code (course entre deux inscriptions) : nouveau tirage
    raise ErreurMetier("CODE_INDISPONIBLE", "Impossible d’attribuer un code. Réessayez.", status=503)


def inscrire(evenement, donnees):
    """Inscription publique depuis le formulaire."""
    with transaction.atomic():
        # verrou sur l'événement pour garantir la capacité
        evenement = type(evenement).objects.select_for_update().select_related("programme").get(pk=evenement.pk)
        etat = etat_inscriptions(evenement)
        if etat != OUVERT:
            raise ErreurMetier(etat, MESSAGES_ETAT[etat])
        if not donnees.get("consentement_donnees"):
            raise ErreurMetier("CONSENTEMENT", "Le consentement au traitement des données est obligatoire.", status=400)
        return creer_invite(evenement, donnees, source=Source.FORMULAIRE)


# --- Émargement ---
PRESENT, DEJA_EMARGE, CODE_INVALIDE, AUTRE_EVENEMENT = "PRESENT", "DEJA_EMARGE", "CODE_INVALIDE", "AUTRE_EVENEMENT"


def compteurs(evenement):
    c = evenement.invites.aggregate(inscrits=Count("id"), presents=Count("id", filter=Q(statut__code=statuts.PRESENT)))
    return c["presents"], c["inscrits"]


def _date_passage(date_client, maintenant):
    """Heure de passage : l'heure de l'appareil pour un scan hors ligne si elle est plausible."""
    if date_client and maintenant - timedelta(hours=12) <= date_client <= maintenant + timedelta(minutes=2):
        return min(date_client, maintenant)
    return maintenant


def emarger(evenement, admin, *, qr_token=None, code=None, invite_id=None, mode, poste="", appareil, date_client=None):
    """Passage à PRESENT : atomique (select_for_update) et idempotent."""
    with transaction.atomic():
        qs = Invite.objects.select_for_update().select_related("statut", "evenement__programme")
        invite = None
        if qr_token:
            invite = qs.filter(qr_token=qr_token.strip()).first()
            if invite is not None and invite.evenement_id != evenement.pk:
                return _resultat(AUTRE_EVENEMENT, evenement, invite=None, evenement_autre=invite.evenement.nom_affiche)
        elif code:
            invite = qs.filter(evenement=evenement, code=code.strip()).first()
        elif invite_id:
            invite = qs.filter(evenement=evenement, pk=invite_id).first()
        if invite is None:
            return _resultat(CODE_INVALIDE, evenement)

        if invite.statut.code == statuts.PRESENT:
            premier = invite.emargements.filter(annule_le__isnull=True).order_by("date").first()
            return _resultat(
                DEJA_EMARGE,
                evenement,
                invite=invite,
                present_le=invite.present_le,
                poste=premier.poste if premier else "",
                mode=invite.mode_emargement,
            )

        maintenant = timezone.now()
        passage = _date_passage(date_client, maintenant)
        invite.statut = Statut.par_code(statuts.PRESENT)
        invite.present_le = passage
        invite.mode_emargement = mode
        invite.save(update_fields=["statut", "present_le", "mode_emargement"])
        emargement = Emargement.objects.create(
            invite=invite,
            admin=admin,
            mode=mode,
            poste=poste[:60],
            appareil=appareil,
            date=passage,
            date_client=date_client,
        )
        journaliser(
            admin,
            "EMARGEMENT",
            invite,
            evenement=evenement.pk,
            mode=mode,
            poste=poste[:60],
            appareil=appareil,
            emargement=emargement.pk,
            hors_ligne=bool(date_client and abs((maintenant - date_client).total_seconds()) > 120),
        )
        programme = invite.evenement.programme
        magazine = False
        if programme.magazine_actif and programme.lien_magazine and not emails.magazine_deja_parti(invite):
            emails.planifier(invite, TypeEmail.MAGAZINE)
            magazine = True
        return _resultat(
            PRESENT,
            evenement,
            invite=invite,
            present_le=passage,
            poste=emargement.poste,
            magazine=magazine,
            emargement=emargement,
            mode=mode,
        )


def _resultat(
    resultat,
    evenement,
    *,
    invite=None,
    present_le=None,
    poste="",
    evenement_autre=None,
    magazine=False,
    emargement=None,
    mode=None,
):
    presents, inscrits = compteurs(evenement)
    return {
        "resultat": resultat,
        "invite": invite,
        "present_le": present_le,
        "poste": poste,
        "mode": mode,
        "evenement_autre": evenement_autre,
        "magazine_envoye": magazine,
        "emargement_id": emargement.pk if emargement else None,
        "presents": presents,
        "inscrits": inscrits,
    }


def annuler_emargement(emargement, admin, motif=""):
    """Retour à INSCRIT ; la ligne Emargement est conservée avec annuleLe / annulePar / motif."""
    with transaction.atomic():
        emargement = Emargement.objects.select_for_update().select_related("invite").get(pk=emargement.pk)
        invite = Invite.objects.select_for_update().select_related("statut").get(pk=emargement.invite_id)
        if emargement.annule_le is not None:
            raise ErreurMetier("DEJA_ANNULE", "Cet émargement a déjà été annulé.")
        if invite.statut.code != statuts.PRESENT:
            raise ErreurMetier("NON_PRESENT", "L’invité n’est pas au statut Présent.")
        emargement.annule_le = timezone.now()
        emargement.annule_par = admin
        emargement.motif_annulation = (motif or "")[:200]
        emargement.save(update_fields=["annule_le", "annule_par", "motif_annulation"])
        invite.statut = Statut.par_code(statuts.INSCRIT)
        invite.present_le = None
        invite.mode_emargement = None
        invite.save(update_fields=["statut", "present_le", "mode_emargement"])
        journaliser(admin, "ANNULATION_EMARGEMENT", invite, evenement=invite.evenement_id, emargement=emargement.pk)
        return invite


def annuler_presence(invite, admin, motif=""):
    """Annule l'émargement actif d'un invité (action « Annuler la présence » du tableau)."""
    emargement = invite.emargements.filter(annule_le__isnull=True).order_by("-date").first()
    if emargement is None:
        raise ErreurMetier("NON_PRESENT", "Aucun émargement actif pour cet invité.")
    return annuler_emargement(emargement, admin, motif)


MODES_VALIDES = {m.value for m in ModeEmargement}
