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
            await asyncio.wait_for(self.semaphore.acquire(), timeout=ATTENTE_MAX)
        except TimeoutError:
            return await _sature(send)
        try:
            await self.application(scope, receive, send)
        finally:
            self.semaphore.release()


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
