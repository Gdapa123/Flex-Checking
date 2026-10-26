# Tests de charge

À lancer sur un environnement de test (jamais sur la production : les scripts créent des inscriptions
`charge.*@test.ci`, à supprimer ensuite).

1. Serveur de production dans le conteneur django, limites par IP levées (toutes les requêtes viennent d'une machine) :

   ```bash
   docker compose exec -d -e DJANGO_DEBUG=0 -e SECURE_SSL_REDIRECT=0 -e JWT_COOKIE_SECURE=0 \
     -e LIMITE_INSCRIPTION_IP=100000/hour -e LIMITE_ANONYME=100000/min -e LIMITE_COMPTE=100000/min \
     -e WEB_CONCURRENCY=4 -e PORT=8001 django sh -c "gunicorn config.asgi:application -c gunicorn.conf.py"
   ```

2. HTTP (1 000 ouvertures du lien, 500 inscriptions, 300 tableaux de bord, scénario mixte) :

   ```bash
   docker run --rm --pull always --network flex-checking_default -v "$PWD/infra/charge:/w:ro" node:24-alpine \
     node /w/charge.mjs http://django:8001 <lien d'inscription> <id événement> <email admin> <mot de passe>
   ```

3. Temps réel (500 écrans WebSocket, délai de notification) :

   ```bash
   docker compose cp infra/charge/ws_charge.py django:/tmp/ && \
     docker compose exec -e DJANGO_DEBUG=0 django python /tmp/ws_charge.py 500 <lien d'inscription> <email admin>
   ```

4. Nettoyage : supprimer les invités `charge.*@test.ci`, puis `docker compose restart django`.

## Résultats de référence (12/10/2026, Docker Desktop 8 cœurs, 4 processus Uvicorn)

| Scénario | Réussite | Médiane | p95 | Débit |
|---|---|---|---|---|
| 1 000 invités ouvrent le lien en même temps | 100 % | 531 ms | 941 ms | 939 req/s |
| 500 inscriptions simultanées | 100 % | 2,2 s | 4,2 s | 113 req/s |
| 300 tableaux de bord admin | 100 % | 602 ms | 1,4 s | 211 req/s |
| Mixte 1 500 requêtes (lectures, admin, listes) | 100 % | 640 ms | 2,9 s | 427 req/s |
| 500 écrans WebSocket : notification après une inscription | 500 / 500 | — | — | tous servis en 0,09 s |

Avant la file d'attente de `config/concurrence.py`, le même test produisait 12 à 65 % d'erreurs 500
(« Too many connections » MySQL) : chaque requête ASGI ouvrant sa propre connexion, un pic dépassait la limite.
