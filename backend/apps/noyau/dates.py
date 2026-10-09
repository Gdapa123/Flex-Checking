"""Formats de dates en français, fuseau Africa/Abidjan (UTC+0)."""

from datetime import datetime

from django.utils import timezone

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
]


def date_longue(d):
    """« samedi 14 novembre 2026 »"""
    return f"{JOURS[d.weekday()]} {d.day} {MOIS[d.month - 1]} {d.year}"


def date_longue_majuscule(d):
    s = date_longue(d)
    return s[0].upper() + s[1:]


def heure(t):
    """« 18h00 »"""
    return f"{t.hour}h{t.minute:02d}"


def heure_dt(dt):
    if dt is None:
        return ""
    return heure(timezone.localtime(dt))


def combiner(d, t):
    return timezone.make_aware(datetime.combine(d, t), timezone.get_default_timezone())
