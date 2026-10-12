from django.apps import AppConfig


class NoyauConfig(AppConfig):
    name = "apps.noyau"
    label = "noyau"
    verbose_name = "Émargement"

    def ready(self):
        from . import temps_reel  # noqa: F401  (signaux de diffusion temps réel)
