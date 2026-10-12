from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def sante(request):
    """Contrôle de santé (répartiteur de charge, Docker) : 503 seulement si la base est injoignable.

    Réponse publique réduite au statut : l'état de Redis (donc des limites de débit) et les latences ne
    sont visibles que du super admin (Analyses › Technique)."""
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
    except Exception:  # noqa: BLE001
        return JsonResponse({"statut": "indisponible"}, status=503)
    return JsonResponse({"statut": "ok"})


urlpatterns = [
    path("api/sante/", sante),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/", include("apps.noyau.urls")),
]
