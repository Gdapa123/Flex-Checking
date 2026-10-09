from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication


def _verifier_csrf(request):
    def dummy_get_response(req):  # pragma: no cover
        return None

    check = CSRFCheck(dummy_get_response)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f"CSRF refusé : {reason}")


class CookieJWTAuthentication(JWTAuthentication):
    """JWT lu dans le cookie httpOnly `fc_access`, avec vérification CSRF sur les requêtes
    modifiantes (le cookie étant envoyé automatiquement par le navigateur)."""

    def authenticate(self, request):
        raw = request.COOKIES.get(settings.JWT_COOKIE_ACCESS)
        if not raw:
            return None
        validated = self.get_validated_token(raw)
        user = self.get_user(validated)
        if not user.actif:
            raise exceptions.AuthenticationFailed("Compte désactivé.", code="compte_desactive")
        _verifier_csrf(request)
        return user, validated
