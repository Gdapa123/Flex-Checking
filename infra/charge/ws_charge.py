"""500 écrans WebSocket connectés, puis une inscription : délai de réception de la notification par tous.

Usage (dans le conteneur django, serveur de production lancé sur le port 8001) :
  python ws_charge.py <nb écrans> <lien d’inscription> <email d’un admin de l’événement>
"""

import asyncio
import json
import os
import sys
import time
import urllib.request

import django

sys.path.insert(0, "/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
import websockets  # noqa: E402
from asgiref.sync import sync_to_async  # noqa: E402
from rest_framework_simplejwt.tokens import AccessToken  # noqa: E402

from apps.comptes.models import Admin  # noqa: E402

N = int(sys.argv[1]) if len(sys.argv) > 1 else 500
SLUG = sys.argv[2] if len(sys.argv) > 2 else "pmd-2026"
COMPTE = sys.argv[3] if len(sys.argv) > 3 else "mariam.kone@mde.ci"
URL = "ws://127.0.0.1:8001/api/ws/"


async def main():
    admin = await sync_to_async(Admin.objects.get)(email=COMPTE)
    jeton = str(AccessToken.for_user(admin))
    entetes = {"Cookie": f"fc_access={jeton}", "Origin": "http://localhost"}
    debut = time.monotonic()
    connexions = await asyncio.gather(
        *[websockets.connect(URL, additional_headers=entetes, open_timeout=30) for _ in range(N)],
        return_exceptions=True,
    )
    ok = [c for c in connexions if not isinstance(c, Exception)]
    prets = await asyncio.gather(*[c.recv() for c in ok], return_exceptions=True)
    print(
        f"{len(ok)}/{N} connexions ouvertes, {sum(1 for p in prets if 'pret' in str(p))} prêtes en {time.monotonic() - debut:.1f} s"
    )

    corps = json.dumps(
        {
            "civilite": "M",
            "nom": "Direct",
            "prenom": "Charge",
            "email": f"charge.ws.{int(time.time())}@test.ci",
            "telephone": "0701020304",
            "entreprise": "Test",
            "fonction": "Test",
            "consentementDonnees": True,
        }
    ).encode()

    async def attendre(c):
        t = time.monotonic()
        while True:
            m = json.loads(await asyncio.wait_for(c.recv(), timeout=15))
            if m.get("type") == "maj" and "invites" in m.get("sujets", []):
                return time.monotonic() - t

    taches = [asyncio.create_task(attendre(c)) for c in ok]
    await asyncio.sleep(0.2)
    envoi = time.monotonic()
    req = urllib.request.Request(
        f"http://127.0.0.1:8001/api/public/evenements/{SLUG}/inscription/",
        data=corps,
        headers={"Content-Type": "application/json"},
    )
    await asyncio.to_thread(urllib.request.urlopen, req)
    delais = sorted(r for r in await asyncio.gather(*taches, return_exceptions=True) if isinstance(r, float))
    if delais:
        print(
            f"notification reçue par {len(delais)}/{len(ok)} écrans ; dernier écran servi {time.monotonic() - envoi:.2f} s après l'inscription "
            f"(médiane {delais[len(delais)//2]*1000:.0f} ms)"
        )
    await asyncio.gather(*[c.close() for c in ok], return_exceptions=True)


asyncio.run(main())
