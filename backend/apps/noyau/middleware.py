from django.conf import settings
from django.db import connection
from django.http import JsonResponse

CHEMIN_SANTE = "/api/sante/"

CSP = "; ".join(
    [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self'",
        "font-src 'self' data:",
        "connect-src 'self'",
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
)


class EnTetesSecuriteMiddleware:
    """En-têtes de sécurité complémentaires (CSP, Permissions-Policy)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Content-Security-Policy", CSP)
        response.setdefault("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if request.path.startswith("/api/") and not settings.DEBUG:
            response.setdefault("Cache-Control", "no-store")
        return response


def sante():
    """Contrôle de santé : 503 seulement si la base est injoignable. Réponse publique réduite au statut :
    l'état de Redis et les latences ne sont visibles que du super admin (Analyses › Technique)."""
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
    except Exception:  # noqa: BLE001
        return JsonResponse({"statut": "indisponible"}, status=503)
    return JsonResponse({"statut": "ok"})


class SanteMiddleware:
    """Répond au contrôle de santé avant toute autre couche. Le HEALTHCHECK Docker (Host 127.0.0.1) et le
    répartiteur Caddy (Host = adresse du conteneur) n'utilisent pas le domaine public : sans cela,
    CommonMiddleware rejetterait leur en-tête Host (400, ALLOWED_HOSTS de production) et tous les
    conteneurs seraient déclarés en panne. Aucune donnée n'est exposée (statut seul)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path != CHEMIN_SANTE:
            return self.get_response(request)
        if request.method in ("GET", "HEAD"):
            reponse = sante()
        else:
            reponse = JsonResponse({"detail": "Méthode non autorisée."}, status=405)
            reponse["Allow"] = "GET, HEAD"
        # mêmes protections que les autres réponses de l'API (ce middleware passe avant les autres)
        reponse["Cache-Control"] = "no-store"
        reponse["X-Content-Type-Options"] = "nosniff"
        reponse["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        reponse["Referrer-Policy"] = "no-referrer"
        return reponse
