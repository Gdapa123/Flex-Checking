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


def ics_evenement(evenement):
    debut = combiner(evenement.date, evenement.heure_accueil)
    fin = combiner(evenement.date, evenement.heure_debut) + timedelta(hours=3)
    description = f"Accueil dès {evenement.heure_accueil:%H:%M}. Présentez votre QR code à l'accueil."
    if evenement.lien_carte:
        description += f"\nItinéraire : {evenement.lien_carte}"
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
