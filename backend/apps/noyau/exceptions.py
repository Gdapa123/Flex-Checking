import logging

from rest_framework.views import exception_handler

journal = logging.getLogger("django.request")
ERREUR_SERVEUR = "Une erreur technique est survenue. Elle a été signalée à l’équipe ; réessayez dans un instant."


class ErreurMetier(Exception):
    """Erreur métier renvoyée au client avec un code stable."""

    def __init__(self, code, message, status=409, **extra):
        super().__init__(message)
        self.code, self.message, self.status, self.extra = code, message, status, extra


def gestionnaire_exceptions(exc, context):
    from rest_framework.response import Response

    if isinstance(exc, ErreurMetier):
        return Response({"code": exc.code, "detail": exc.message, **exc.extra}, status=exc.status)
    response = exception_handler(exc, context)
    if response is None:
        # Erreur non prévue : enregistrée pour le super admin, jamais montrée telle quelle à l'utilisateur
        from .erreurs import enregistrer_exception
        from .models import SourceErreur

        requete = context.get("request")
        lieu = f"{requete.method} {requete.path}" if requete else ""
        journal.error("Erreur serveur sur %s", lieu, exc_info=exc)
        enregistrer_exception(SourceErreur.SERVEUR, exc, lieu=lieu)
        return Response({"code": "ERREUR_SERVEUR", "detail": ERREUR_SERVEUR}, status=500)
    if response.status_code == 429:
        response.data = {"code": "TROP_DE_TENTATIVES", "detail": "Trop de tentatives. Réessayez dans quelques minutes."}
    return response
