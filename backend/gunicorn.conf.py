"""Serveur de production : Gunicorn + workers Uvicorn (ASGI : HTTP et WebSocket).

Dimensionnement par variables d'environnement. Chaque worker Uvicorn traite des centaines de
connexions simultanées (WebSocket compris) ; les vues Django synchrones s'exécutent dans un pool de
threads par worker. Repère : 2 workers par cœur, et MySQL `max_connections` supérieur à
workers × threads (voir docker-compose.prod.yml).
"""

import logging
import multiprocessing
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
worker_class = "uvicorn.workers.UvicornWorker"
workers = int(os.environ.get("WEB_CONCURRENCY", max(2, multiprocessing.cpu_count() * 2)))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "60"))  # requête bloquée : worker redémarré
graceful_timeout = 30
keepalive = 5
# recyclage périodique des workers (fuites mémoire éventuelles), décalé pour ne pas tous redémarrer ensemble
max_requests = 5000
max_requests_jitter = 500
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info")
# Uvicorn ne réécrit pas l'adresse du client d'après X-Forwarded-For (en-tête falsifiable) : l'IP réelle
# est déterminée par Django (NUM_PROXIES = nombre de proxys de confiance, Caddy = 1).
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1")


def post_worker_init(worker):
    """Aucune donnée personnelle dans le journal d'accès : chaînes de requête (`?q=` recherche d'invités)
    masquées avant écriture, emails et téléphones également."""
    from apps.noyau.logs import MasquerDonneesPersonnelles, MasquerParametresUrl

    acces = logging.getLogger("uvicorn.access")
    acces.addFilter(MasquerParametresUrl())
    acces.addFilter(MasquerDonneesPersonnelles())
