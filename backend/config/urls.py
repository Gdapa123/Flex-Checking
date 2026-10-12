from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# `/api/sante/` est servi par `apps.noyau.middleware.SanteMiddleware`, avant le contrôle de l'en-tête Host.

urlpatterns = [
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/", include("apps.noyau.urls")),
]
