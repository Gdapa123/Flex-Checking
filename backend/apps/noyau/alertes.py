"""Alertes de sécurité et d'exploitation : email aux super admins actifs, sans attendre qu'ils ouvrent l'écran.

Déclencheurs : compte bloqué après trop d'échecs de connexion (`comptes.views.ConnexionView`) et nouvelle erreur
côté serveur, tâche ou email (`erreurs.enregistrer`, jamais pour les signalements publics du navigateur).

Garde-fous : une alerte par clé et par période (pas de rafale pour la même cause), 10 alertes par heure au plus en
tout, envoi en arrière-plan, et aucune exception ni erreur technique enregistrée en cas d'échec de l'envoi (sinon
une panne SMTP produirait une erreur, qui produirait une alerte, qui échouerait…). Aucune donnée d'invité.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

journal = logging.getLogger("securite")

MAX_ALERTES_PAR_HEURE = 10


def alerter(cle, sujet, texte, *, periode_s=3600):
    """Planifie l'email d'alerte, une fois par `cle` et par `periode_s`. Ne lève jamais d'exception."""
    from apps.comptes.throttles import CacheDeSecours

    try:
        limites = CacheDeSecours()
        if limites.incrementer(f"alerte:{cle}", periode_s) > 1:
            return False
        if limites.incrementer("alertes-heure", 3600) > MAX_ALERTES_PAR_HEURE:
            journal.warning("Alerte non envoyée (plafond horaire atteint) : %s", sujet)
            return False
        transaction.on_commit(lambda: _planifier(sujet, texte))
        return True
    except Exception:  # noqa: BLE001 — une alerte ne fait jamais échouer l'action qui la déclenche
        journal.exception("Alerte impossible à planifier : %s", sujet)
        return False


def _planifier(sujet, texte):
    from .tasks import envoyer_alerte

    try:
        envoyer_alerte.delay(sujet, texte)
    except Exception:  # noqa: BLE001 — file indisponible : envoi direct (délai SMTP borné par EMAIL_TIMEOUT)
        envoyer(sujet, texte)


def envoyer(sujet, texte):
    """Envoi immédiat aux super admins actifs. Échec seulement journalisé (jamais d'erreur technique enregistrée)."""
    from apps.comptes.models import Admin, Role

    try:
        destinataires = list(Admin.objects.filter(role=Role.SUPER_ADMIN, actif=True).values_list("email", flat=True))
        if not destinataires:
            return 0
        pied = (
            f"\n\nDétail : {settings.APP_PUBLIC_URL}/super/journal et {settings.APP_PUBLIC_URL}/super/erreurs\n"
            "Alerte envoyée automatiquement par Flex’Checking, merci de ne pas y répondre."
        )
        return send_mail(
            f"[Flex’Checking] {sujet}", texte + pied, settings.DEFAULT_FROM_EMAIL, destinataires, fail_silently=False
        )
    except Exception as exc:  # noqa: BLE001
        journal.error("Alerte non envoyée (%s) : %s", exc.__class__.__name__, sujet)
        return 0
