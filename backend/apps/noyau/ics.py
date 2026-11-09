"""Fichier iCalendar d'un événement (sans donnée personnelle)."""

from datetime import UTC, timedelta

from django.conf import settings
from django.utils import timezone

from .cartes_invitation import carte_pour_agenda
from .dates import combiner

FORMAT = "%Y%m%dT%H%M%SZ"


def _echapper(texte):
    texte = texte.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
    # tout saut de ligne (y compris un retour chariot seul) est échappé : jamais de propriété injectée
    return texte.replace("\r\n", "\\n").replace("\r", "\\n").replace("\n", "\\n")


def _sans_saut(texte):
    return texte.replace("\r", "").replace("\n", "")


def _utc(dt):
    return dt.astimezone(UTC).strftime(FORMAT)


def lien_pratique(evenement, ancre="", slug=None):
    """Page publique « Infos pratiques » (choix de l'agenda et de l'application d'itinéraire). `slug` : lien
    effectivement utilisé par l'invité (un ancien lien ne doit jamais révéler le nouveau)."""
    lien = f"{settings.APP_PUBLIC_URL}/i/{slug or evenement.slug_inscription}/pratique"
    return f"{lien}#{ancre}" if ancre else lien


def bornes(evenement):
    """Début (heure d'accueil) et fin estimée (lancement + 3 h) de l'événement, conscients du fuseau."""
    debut = combiner(evenement.date, evenement.heure_accueil)
    fin = combiner(evenement.date, evenement.heure_debut) + timedelta(hours=3)
    return debut, fin


# rappels de l'agenda : la veille et une heure avant le début (accueil)
RAPPELS = ("-P1D", "-PT1H")


_A_CALCULER = object()


def description_agenda(evenement, slug=None, carte=_A_CALCULER):
    """`carte` : résultat de `carte_pour_agenda` déjà lu (une seule requête par fichier .ics)."""
    description = (
        f"Accueil dès {evenement.heure_accueil:%H:%M}, lancement à {evenement.heure_debut:%H:%M}. "
        "Présentez votre QR code à l'accueil.\n"
        f"Itinéraire : {lien_pratique(evenement, 'itineraire', slug)}"
    )
    if carte is _A_CALCULER:
        carte = carte_pour_agenda(evenement, slug)
    if carte:
        description += f"\nCarte d'invitation : {carte[0]}"
    return description


def ics_evenement(evenement, slug=None):
    slug = slug or evenement.slug_inscription
    debut, fin = bornes(evenement)
    carte = carte_pour_agenda(evenement, slug)
    description = description_agenda(evenement, slug, carte)
    lignes = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MDE Business School//Flex-Checking//FR",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:evenement-{evenement.pk}@flex-checking",
        f"DTSTAMP:{_utc(timezone.now())}",
        f"DTSTART:{_utc(debut)}",
        f"DTEND:{_utc(fin)}",
        f"SUMMARY:{_echapper(evenement.nom_agenda)}",
        f"LOCATION:{_echapper(evenement.lieu)}",
        f"DESCRIPTION:{_echapper(description)}",
        f"URL:{settings.APP_PUBLIC_URL}/i/{slug}",
    ]
    if carte:
        # adresse construite ou validée (URLField) : ni saut de ligne ni point-virgule dans une valeur URI
        lien, type_mime = carte
        lignes.append(f"ATTACH;FMTTYPE={type_mime}:{_sans_saut(lien)}" if type_mime else f"ATTACH:{_sans_saut(lien)}")
    for declencheur in RAPPELS:
        lignes += [
            "BEGIN:VALARM",
            f"TRIGGER:{declencheur}",
            "ACTION:DISPLAY",
            f"DESCRIPTION:{_echapper(evenement.nom_agenda)}",
            "END:VALARM",
        ]
    lignes += ["END:VEVENT", "END:VCALENDAR"]
    return ("\r\n".join(lignes) + "\r\n").encode("utf-8")
