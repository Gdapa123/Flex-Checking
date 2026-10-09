from rest_framework.views import exception_handler


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
    if response is not None and response.status_code == 429:
        response.data = {"code": "TROP_DE_TENTATIVES", "detail": "Trop de tentatives. Réessayez dans quelques minutes."}
    return response
