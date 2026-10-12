"""Réglages dérivés de l'environnement, isolés de `settings` pour pouvoir être testés."""

POSTGRES = "django.db.backends.postgresql"


def base_depuis_url(config, sslmode_defaut="require"):
    """Base décrite par DATABASE_URL (dictionnaire de `env.db`).

    Les options portées par l'URL (`?sslmode=verify-full&channel_binding=require`…) sont conservées : les
    écraser abaisserait silencieusement la sécurité de la connexion choisie par l'URL. Le chiffrement est
    seulement imposé par défaut (`sslmode_defaut`) quand l'URL ne précise rien.
    """
    options = {"connect_timeout": 5, **config.get("OPTIONS", {})}
    if config.get("ENGINE") == POSTGRES:
        options.setdefault("sslmode", sslmode_defaut)
    return {**config, "CONN_MAX_AGE": 0, "OPTIONS": options}


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
