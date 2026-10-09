from django.conf import settings

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
