"""Point d'entrée ASGI : HTTP (Django) et WebSocket temps réel (`/api/ws/`)."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application_http = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402
from django.urls import path  # noqa: E402

from apps.noyau.consumers import TempsReelConsumer  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": application_http,
        "websocket": AllowedHostsOriginValidator(URLRouter([path("api/ws/", TempsReelConsumer.as_asgi())])),
    }
)
