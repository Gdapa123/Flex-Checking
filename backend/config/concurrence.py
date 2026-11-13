"""File d'attente devant Django : nombre de requêtes HTTP traitées en même temps par processus.

Sous ASGI, chaque requête ouvre sa propre connexion MySQL. Sans limite, un pic (1 000 invités qui
ouvrent le lien au même instant) dépasse `max_connections` de MySQL et produit des erreurs. Ici, les
requêtes en surplus attendent leur tour (quelques millisecondes) au lieu d'échouer : le nombre de
connexions reste borné à `WEB_CONCURRENCY × DB_CONCURRENCE` par conteneur.

Au-delà de `ATTENTE_MAX` secondes d'attente (serveur durablement saturé), réponse 503 avec
`Retry-After` : le navigateur réessaie (React Query) et l'utilisateur voit un message neutre.
"""

import asyncio
import json
import os

DB_CONCURRENCE = int(os.environ.get("DB_CONCURRENCE", "24"))
ATTENTE_MAX = float(os.environ.get("ATTENTE_MAX", "20"))
# Le corps de la requête est lu AVANT de prendre une place : un client qui envoie son corps très lentement ne bloque
# pas une place de la file (sinon quelques dizaines de connexions lentes suffiraient à saturer l'API).
LECTURE_CORPS_MAX = float(os.environ.get("LECTURE_CORPS_MAX", "15"))
CORPS_MAX = 6 * 1024 * 1024  # au-delà de la limite du proxy (5 Mo) : refusé sans attendre la fin
SANS_FILE = ("/api/sante/",)  # contrôle de santé : jamais retardé (sinon le répartiteur retirerait le serveur)


class LimiteConcurrence:
    def __init__(self, application, limite=DB_CONCURRENCE):
        self.application = application
        self.limite = limite
        self.semaphore = None  # créé dans la boucle d'événements du processus

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") in SANS_FILE or self.limite <= 0:
            return await self.application(scope, receive, send)
        if self.semaphore is None:
            self.semaphore = asyncio.Semaphore(self.limite)
        try:
            messages = await asyncio.wait_for(_lire_corps(receive), timeout=LECTURE_CORPS_MAX)
        except TimeoutError:
            return await _refuser(send, 408, "LECTURE_TROP_LENTE", "Envoi trop lent. Réessayez.")
        except _CorpsTropGros:
            return await _refuser(send, 413, "TROP_VOLUMINEUX", "Envoi trop volumineux.")
        if messages[-1]["type"] == "http.disconnect":
            return  # client parti pendant l'envoi
        try:
            await asyncio.wait_for(self.semaphore.acquire(), timeout=ATTENTE_MAX)
        except TimeoutError:
            return await _sature(send)
        try:
            await self.application(scope, _rejouer(messages, receive), send)
        finally:
            self.semaphore.release()


class _CorpsTropGros(Exception):
    pass


async def _lire_corps(receive):
    """Messages `http.request` jusqu'au dernier morceau (ou `http.disconnect`)."""
    messages, taille = [], 0
    while True:
        message = await receive()
        messages.append(message)
        if message["type"] != "http.request":
            return messages
        taille += len(message.get("body", b""))
        if taille > CORPS_MAX:
            raise _CorpsTropGros
        if not message.get("more_body"):
            return messages


def _rejouer(messages, receive):
    """`receive` pour l'application : le corps déjà lu, puis le canal d'origine (déconnexion du client)."""
    file = list(messages)

    async def recevoir():
        if file:
            return file.pop(0)
        return await receive()

    return recevoir


async def _refuser(send, statut, code, detail):
    corps = json.dumps({"code": code, "detail": detail}).encode()
    await send({"type": "http.response.start", "status": statut, "headers": [(b"content-type", b"application/json")]})
    await send({"type": "http.response.body", "body": corps})


async def _sature(send):
    corps = json.dumps(
        {"code": "SERVICE_SATURE", "detail": "Le service est très sollicité. Réessayez dans quelques secondes."}
    ).encode()
    await send(
        {
            "type": "http.response.start",
            "status": 503,
            "headers": [(b"content-type", b"application/json"), (b"retry-after", b"5")],
        }
    )
    await send({"type": "http.response.body", "body": corps})
