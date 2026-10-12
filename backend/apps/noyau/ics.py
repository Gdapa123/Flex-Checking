"""Fichier iCalendar d'un événement (sans donnée personnelle)."""

from datetime import UTC, timedelta

from django.conf import settings
from django.utils import timezone

from .dates import combiner

FORMAT = "%Y%m%dT%H%M%SZ"


def _echapper(texte):
    return texte.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _utc(dt):
    return dt.astimezone(UTC).strftime(FORMAT)


def lien_pratique(evenement, ancre=""):
    """Page publique « Infos pratiques » (choix de l'agenda et de l'application d'itinéraire)."""
    lien = f"{settings.APP_PUBLIC_URL}/i/{evenement.slug_inscription}/pratique"
    return f"{lien}#{ancre}" if ancre else lien


def bornes(evenement):
    """Début (heure d'accueil) et fin estimée (lancement + 3 h) de l'événement, conscients du fuseau."""
    debut = combiner(evenement.date, evenement.heure_accueil)
    fin = combiner(evenement.date, evenement.heure_debut) + timedelta(hours=3)
    return debut, fin


def description_agenda(evenement):
    return (
        f"Accueil dès {evenement.heure_accueil:%H:%M}, lancement à {evenement.heure_debut:%H:%M}. "
        "Présentez votre QR code à l'accueil.\n"
        f"Itinéraire : {lien_pratique(evenement, 'itineraire')}"
    )


def ics_evenement(evenement):
    debut, fin = bornes(evenement)
    description = description_agenda(evenement)
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
        f"SUMMARY:{_echapper(evenement.nom_affiche)}",
        f"LOCATION:{_echapper(evenement.lieu)}",
        f"DESCRIPTION:{_echapper(description)}",
        f"URL:{settings.APP_PUBLIC_URL}/i/{evenement.slug_inscription}",
        "BEGIN:VALARM",
        "TRIGGER:-PT2H",
        "ACTION:DISPLAY",
        f"DESCRIPTION:{_echapper(evenement.nom_affiche)}",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return ("\r\n".join(lignes) + "\r\n").encode("utf-8")
