from django.apps import AppConfig


class ComptesConfig(AppConfig):
    name = "apps.comptes"
    label = "comptes"
    verbose_name = "Comptes"

    def ready(self):
        from django.db.models.signals import pre_save
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

        from .jetons import vider_texte_du_jeton

        # jamais de jeton de rafraîchissement en clair dans la base (voir jetons.py)
        pre_save.connect(vider_texte_du_jeton, sender=OutstandingToken, dispatch_uid="comptes-vider-texte-jeton")
