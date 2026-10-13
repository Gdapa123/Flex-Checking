"""Point d'entrée WebSocket `/api/ws/` : pousse les notifications de `temps_reel` au navigateur.

Sécurité :
- authentification par le cookie httpOnly `fc_access` (même JWT que l'API) ; la connexion est
  fermée (code 4001) à l'expiration du jeton, le navigateur rafraîchit sa session et se reconnecte ;
- origine vérifiée (AllowedHostsOriginValidator dans config/asgi.py) ;
- un admin ne rejoint que les groupes des événements qui lui sont affectés ;
- le serveur ignore tout message envoyé par le navigateur.
"""

import asyncio
import time
import weakref
from http.cookies import CookieError, SimpleCookie

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken

from apps.comptes.authentication import acces_revoque, jeton_revoque
from apps.comptes.models import Admin, Role
from apps.comptes.permissions import evenements_visibles
from config.concurrence import DB_CONCURRENCE

from .temps_reel import CONNECTES, TOUS, groupe_compte, groupe_evenement

FERMETURE_SESSION = 4001  # jeton absent ou expiré : rafraîchir la session puis se reconnecter
FERMETURE_COMPTE = 4003  # compte désactivé ou supprimé : retour à la connexion
FERMETURE_INDISPONIBLE = 4004  # temps réel non configuré (pas de Redis) : le navigateur interroge périodiquement l'API


def _jeton(scope):
    for nom, valeur in scope.get("headers", []):
        if nom == b"cookie":
            morceau = SimpleCookie()
            try:
                morceau.load(valeur.decode("latin-1"))
            except CookieError:
                return None
            if settings.JWT_COOKIE_ACCESS in morceau:
                return morceau[settings.JWT_COOKIE_ACCESS].value
    return None


_files = weakref.WeakKeyDictionary()  # un sémaphore par boucle d'événements (un par processus en production)


def _file():
    """Accès base des connexions WebSocket bornés comme ceux des requêtes HTTP (`config.concurrence`) :
    une vague de reconnexions (redémarrage, déploiement) ne peut pas dépasser `max_connections` MySQL."""
    boucle = asyncio.get_running_loop()
    if boucle not in _files:
        _files[boucle] = asyncio.Semaphore(DB_CONCURRENCE)
    return _files[boucle]


async def _compte(admin_id):
    async with _file():
        return await _compte_base(admin_id)


async def _groupes(admin):
    async with _file():
        return await _groupes_base(admin)


@database_sync_to_async
def _compte_base(admin_id):
    """Compte actif et sorti du mot de passe temporaire (même règle que `EstAdmin`)."""
    return Admin.objects.filter(pk=admin_id, actif=True, doit_changer_mot_de_passe=False).first()


@database_sync_to_async
def _groupes_base(admin):
    groupes = {CONNECTES, groupe_compte(admin.pk)}
    if admin.role == Role.SUPER_ADMIN:
        groupes.add(TOUS)
    else:
        groupes.update(groupe_evenement(pk) for pk in evenements_visibles(admin).values_list("pk", flat=True))
    return groupes


class TempsReelConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.groupes = set()
        self.minuteur = None
        await self.accept()
        if self.channel_layer is None:
            # Temps réel désactivé (pas de Redis) : fermeture avec un code explicite, pour que le navigateur sache que
            # ce n'est pas une coupure passagère et se contente de l'interrogation périodique de l'API.
            await self.close(code=FERMETURE_INDISPONIBLE)
            return
        brut = _jeton(self.scope)
        try:
            jeton = AccessToken(brut) if brut else None
        except TokenError:
            jeton = None
        admin = await _compte(jeton[api_settings.USER_ID_CLAIM]) if jeton else None
        if admin is None:
            await self.close(code=FERMETURE_SESSION if jeton is None else FERMETURE_COMPTE)
            return
        # mot de passe changé depuis l'émission du jeton, ou session fermée par une déconnexion
        if jeton_revoque(jeton, admin) or await database_sync_to_async(acces_revoque)(jeton):
            await self.close(code=FERMETURE_SESSION)
            return
        self.admin_id, self.jeton = admin.pk, jeton
        await self._rejoindre(await _groupes(admin))
        delai = max(0, jeton["exp"] - time.time())
        self.minuteur = asyncio.get_running_loop().call_later(
            delai, lambda: asyncio.ensure_future(self.close(code=FERMETURE_SESSION))
        )
        await self.send_json({"type": "pret"})

    async def disconnect(self, code):
        if self.minuteur:
            self.minuteur.cancel()
        await self._rejoindre(set())

    async def receive_json(self, content, **kwargs):
        """Canal descendant uniquement."""

    async def _rejoindre(self, groupes):
        for g in self.groupes - groupes:
            await self.channel_layer.group_discard(g, self.channel_name)
        for g in groupes - self.groupes:
            await self.channel_layer.group_add(g, self.channel_name)
        self.groupes = groupes

    # --- messages des groupes (type = nom de la méthode)

    async def maj(self, message):
        await self.send_json({"type": "maj", "sujets": message["sujets"], "evenements": message["evenements"]})

    async def perimetre(self, message):
        admin = await _compte(self.admin_id)
        if admin is None:
            await self.close(code=FERMETURE_COMPTE)
            return
        if jeton_revoque(self.jeton, admin):  # mot de passe changé ou réinitialisé : session révoquée
            await self.close(code=FERMETURE_SESSION)
            return
        await self._rejoindre(await _groupes(admin))
        await self.send_json({"type": "maj", "sujets": ["moi", "evenements", "evenement"], "evenements": []})

    async def fermer(self, message):
        await self.close(code=FERMETURE_COMPTE)
