from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken

VERSION_SESSION = "vs"


def emettre_jetons(admin):
    """Jeton de rafraîchissement (et jeton d'accès dérivé) portant la version de session du compte."""
    jeton = RefreshToken.for_user(admin)
    jeton[VERSION_SESSION] = admin.version_session
    return jeton


def jeton_revoque(jeton, admin):
    """Jeton émis avant le dernier changement ou la dernière réinitialisation du mot de passe."""
    return jeton.get(VERSION_SESSION, 0) != admin.version_session


def nouvelle_version_session(admin):
    """À appeler avec le changement de mot de passe (champ à inclure dans `save(update_fields=…)`)."""
    admin.version_session += 1


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
        if jeton_revoque(validated, user):
            raise exceptions.AuthenticationFailed("Session expirée.", code="session_revoquee")
        _verifier_csrf(request)
        return user, validated
