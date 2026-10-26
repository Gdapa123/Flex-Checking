"""Réglages dérivés de l'environnement, isolés de `settings` pour pouvoir être testés."""

POSTGRES = "django.db.backends.postgresql"


def base_depuis_url(config, sslmode_defaut="require", pool_max=0):
    """Base décrite par DATABASE_URL (dictionnaire de `env.db`).

    Les options portées par l'URL (`?sslmode=verify-full&channel_binding=require`…) sont conservées : les
    écraser abaisserait silencieusement la sécurité de la connexion choisie par l'URL. Le chiffrement est
    seulement imposé par défaut (`sslmode_defaut`) quand l'URL ne précise rien.

    `pool_max` > 0 (Postgres seulement) : connexions réutilisées d'une requête à l'autre (pool natif de Django,
    `psycopg_pool`). Sans pool, chaque requête rouvre une connexion chiffrée vers une base distante (Neon :
    TCP, TLS et authentification SCRAM), soit plusieurs centaines de millisecondes par appel d'API. Les
    connexions du pool gardent exactement les mêmes options (chiffrement, liaison de canal).
    """
    options = {"connect_timeout": 5, **config.get("OPTIONS", {})}
    base = {**config, "CONN_MAX_AGE": 0}
    if config.get("ENGINE") == POSTGRES:
        options.setdefault("sslmode", sslmode_defaut)
        if pool_max > 0:
            options["pool"] = pool_postgres(pool_max)
            # connexion coupée pendant l'inactivité (base mise en veille, relais PgBouncer) : détectée avant
            # usage et remplacée (Django passe alors `ConnectionPool.check_connection` au pool)
            base["CONN_HEALTH_CHECKS"] = True
    return {**base, "OPTIONS": options}


def pool_postgres(taille_max):
    """Paramètres du pool : une connexion prête, au plus `taille_max` (file d'attente ASGI, voir
    `config/concurrence.py`). Les connexions inactives sont fermées avant les délais d'inactivité côté
    serveur. Pool saturé : erreur après `timeout` secondes plutôt qu'une attente sans fin."""
    return {"min_size": 1, "max_size": taille_max, "timeout": 10, "max_idle": 240, "max_lifetime": 1800}


def caches_sans_redis():
    """Caches sans Redis (environnement de test Vercel : plusieurs instances éphémères).

    Les limites anti-abus sensibles (connexion, renvoi d'email) sont partagées par la base : en mémoire de
    chaque processus, chaque nouvelle instance repartirait de zéro et la protection contre la force brute
    serait multipliée par le nombre d'instances. Table créée par `python manage.py createcachetable` ; si elle
    manque, `CacheDeSecours` bascule sur la mémoire locale (jamais d'absence de limite).
    """
    local = "django.core.cache.backends.locmem.LocMemCache"
    return {
        "default": {"BACKEND": local, "LOCATION": "default"},
        "limites": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "cache_limites"},
        "limites_local": {"BACKEND": local, "LOCATION": "limites"},
    }
