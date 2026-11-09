"""Jetons de rafraîchissement en base (liste noire de SimpleJWT) : jamais leur texte, seulement leur identifiant.

SimpleJWT enregistre chaque jeton de rafraîchissement en entier (`OutstandingToken.token`) ; lu dans la base, une
console ou une sauvegarde, ce texte suffisait à ouvrir une session de 12 h à la place du compte. La liste noire et
la détection des rotations n'utilisent que `jti`, `user`, `created_at` et `expires_at` : le texte est vidé avant
chaque enregistrement, et les jetons expirés sont supprimés.
"""

from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken


def vider_texte_du_jeton(sender, instance, **kwargs):
    """Signal `pre_save` d'`OutstandingToken` : le jeton n'est jamais écrit en base."""
    instance.token = ""


def purger_jetons():
    """Vide le texte des jetons enregistrés avant cette protection et supprime les jetons expirés (leur entrée de
    liste noire avec eux : un jeton expiré est refusé de toute façon)."""
    vides = OutstandingToken.objects.exclude(token="").update(token="")
    supprimes, _ = OutstandingToken.objects.filter(expires_at__lt=timezone.now()).delete()
    return {"textesVides": vides, "supprimes": supprimes}
