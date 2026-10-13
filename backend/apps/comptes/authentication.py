import time

from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken

VERSION_SESSION = "vs"
# Session « borne libre-service » : l'appareil est laissé au public. Seules les vues qui le déclarent
# (`autorise_borne`) l'acceptent : émargement, recherche réduite, réglages du scan. Le mot de passe de l'hôte
# (`auth/verifier-mot-de-passe/`) rend une session complète.
BORNE = "borne"


def emettre_jetons(admin, borne=False):
    """Jeton de rafraîchissement (et jeton d'accès dérivé) portant la version de session du compte et, le cas
    échéant, le mode borne (conservé au rafraîchissement)."""
    jeton = RefreshToken.for_user(admin)
    jeton[VERSION_SESSION] = admin.version_session
    if borne:
        jeton[BORNE] = True
    return jeton


def est_borne(jeton):
    return bool(jeton is not None and jeton.get(BORNE, False))


def _cle_acces_revoque(jeton):
    return f"acces-revoque:{jeton.get('jti', '')}"


def revoquer_acces(jeton):
    """Jeton d'accès d'une session fermée (déconnexion) : refusé jusqu'à son expiration, sans toucher aux autres
    appareils du compte (contrairement à `nouvelle_version_session`)."""
    from .throttles import CacheDeSecours

    restant = int(jeton.get("exp", 0) - time.time())
    if restant > 0 and jeton.get("jti"):
        CacheDeSecours().set(_cle_acces_revoque(jeton), 1, restant)


def acces_revoque(jeton):
    from .throttles import CacheDeSecours

    return bool(jeton.get("jti") and CacheDeSecours().get(_cle_acces_revoque(jeton)))


def jeton_revoque(jeton, admin):
    """Jeton émis avant le dernier changement ou la dernière réinitialisation du mot de passe."""
    return jeton.get(VERSION_SESSION, 0) != admin.version_session


def nouvelle_version_session(admin):
    """À appeler avec le changement de mot de passe (champ à inclure dans `save(update_fields=…)`)."""
    admin.version_session += 1


def verifier_csrf(request):
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
        if jeton_revoque(validated, user) or acces_revoque(validated):
            raise exceptions.AuthenticationFailed("Session expirée.", code="session_revoquee")
        verifier_csrf(request)
        return user, validated
