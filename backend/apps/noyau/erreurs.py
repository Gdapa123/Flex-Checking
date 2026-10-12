"""Enregistrement des erreurs techniques (navigateur, serveur, tâches, emails).

Les erreurs identiques sont regroupées (compteur d'occurrences) ; une erreur résolue qui se
reproduit est rouverte. L'enregistrement ne lève jamais d'exception : il ne doit pas aggraver
la panne qu'il signale.
"""

import hashlib
import logging
import re
import traceback
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from .logs import EMAIL_RE, TEL_RE
from .models import ErreurTechnique, SourceErreur

journal = logging.getLogger(__name__)

MAX_ERREURS = 5000  # au-delà, les nouvelles signatures sont ignorées (les occurrences restent comptées)
# Signalements du navigateur (point d'accès public) : quota séparé, pour qu'un flot de faux signalements
# ne puisse jamais empêcher l'enregistrement des erreurs serveur, tâches et emails.
MAX_ERREURS_NAVIGATEUR = 2000
CONSERVATION = timedelta(days=30)
CHIFFRES_RE = re.compile(r"\d+")


def masquer(texte):
    return TEL_RE.sub("[tél]", EMAIL_RE.sub("[email]", texte or ""))


def _signature(source, type_, message, lieu):
    # les nombres (identifiants, durées) varient d'une occurrence à l'autre : ignorés pour regrouper
    brut = "|".join([source, type_, CHIFFRES_RE.sub("#", message[:300]), CHIFFRES_RE.sub("#", lieu)])
    return hashlib.sha256(brut.encode()).hexdigest()


def enregistrer(source, type_, message, *, lieu="", details="", navigateur=""):
    try:
        type_ = (type_ or "Erreur")[:120]
        message = masquer(message)[:1000] or "(sans message)"
        lieu = masquer(lieu.split("?")[0].split("#")[0])[:300]
        details = masquer(details)[:8000]
        signature = _signature(source, type_, message, lieu)
        maintenant = timezone.now()
        with transaction.atomic():
            maj = ErreurTechnique.objects.filter(signature=signature).update(
                occurrences=F("occurrences") + 1,
                derniere=maintenant,
                resolue=False,
                resolue_le=None,
                details=details,
                navigateur=navigateur[:300],
            )
            if maj:
                return
            if source == SourceErreur.NAVIGATEUR:
                if ErreurTechnique.objects.filter(source=source).count() >= MAX_ERREURS_NAVIGATEUR:
                    return
            elif ErreurTechnique.objects.exclude(source=SourceErreur.NAVIGATEUR).count() >= MAX_ERREURS:
                return
            ErreurTechnique.objects.create(
                source=source,
                signature=signature,
                type=type_,
                message=message,
                lieu=lieu,
                details=details,
                navigateur=navigateur[:300],
                premiere=maintenant,
                derniere=maintenant,
            )
    except IntegrityError:  # créée en parallèle par une autre requête : compter cette occurrence
        try:
            ErreurTechnique.objects.filter(signature=signature).update(occurrences=F("occurrences") + 1)
        except Exception:  # noqa: BLE001 — jamais d'erreur en cascade
            journal.exception("Impossible d'enregistrer l'erreur technique")
    except Exception:  # noqa: BLE001 — jamais d'erreur en cascade
        journal.exception("Impossible d'enregistrer l'erreur technique")


def enregistrer_exception(source, exc, *, lieu=""):
    details = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    enregistrer(source, type(exc).__name__, str(exc), lieu=lieu, details=details)


def purger():
    ErreurTechnique.objects.filter(derniere__lt=timezone.now() - CONSERVATION).delete()


# ---------------------------------------------------------------------------- captures automatiques


def _requete_django(sender, request=None, **kwargs):
    """Exceptions hors API REST (les vues DRF passent par `exceptions.gestionnaire_exceptions`)."""
    import sys

    from .models import SourceErreur

    exc = sys.exc_info()[1]
    if exc is not None:
        lieu = f"{request.method} {request.path}" if request is not None else ""
        enregistrer_exception(SourceErreur.SERVEUR, exc, lieu=lieu)


def _tache_celery(sender=None, exception=None, **kwargs):
    from .models import SourceErreur

    if exception is not None:
        enregistrer_exception(SourceErreur.TACHE, exception, lieu=getattr(sender, "name", ""))


def brancher():
    from celery.signals import task_failure
    from django.core.signals import got_request_exception

    got_request_exception.connect(_requete_django, dispatch_uid="erreurs-requete")
    task_failure.connect(_tache_celery, dispatch_uid="erreurs-tache")
