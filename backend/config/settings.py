"""Configuration Django de Flex’Checking.

Toutes les valeurs sensibles viennent des variables d'environnement (fichier .env à la racine
du dépôt en développement, non commité ; voir .env.example).
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

env = environ.Env()
environ.Env.read_env(ROOT_DIR / ".env", overwrite=False)

DEBUG = env.bool("DJANGO_DEBUG", default=False)
SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-key" if DEBUG else "")
if not DEBUG and (len(SECRET_KEY) < 32 or SECRET_KEY.startswith(("dev-", "change-me"))):
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured("DJANGO_SECRET_KEY doit être défini (32 caractères minimum) hors développement.")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
APP_PUBLIC_URL = env("APP_PUBLIC_URL", default="https://flex-checking.localhost").rstrip("/")

INSTALLED_APPS = [
    "daphne",  # runserver ASGI (WebSocket temps réel)
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "channels",
    "apps.comptes",
    "apps.noyau",
]

MIDDLEWARE = [
    "apps.noyau.middleware.SanteMiddleware",  # contrôle de santé, indépendant de l'en-tête Host
    "apps.noyau.mesures.MesuresMiddleware",  # durée et statut de chaque requête API (graphiques techniques)
    "django.middleware.security.SecurityMiddleware",
    "apps.noyau.middleware.EnTetesSecuriteMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": env("MYSQL_DATABASE", default="flex_checking"),
        "USER": env("MYSQL_USER", default="flex_checking"),
        "PASSWORD": env("MYSQL_PASSWORD", default="flex_checking"),
        "HOST": env("DB_HOST", default="127.0.0.1"),
        "PORT": env("DB_PORT", default="3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
            # une base saturée ou injoignable doit échouer vite plutôt que bloquer les requêtes
            "connect_timeout": 5,
        },
        # Sous ASGI, chaque requête ouvre et ferme sa connexion (pas de connexions persistantes partagées
        # entre threads) ; le nombre de connexions MySQL autorisées est dimensionné en conséquence.
        "CONN_MAX_AGE": 0,
        "TEST": {"CHARSET": "utf8mb4", "COLLATION": "utf8mb4_unicode_ci"},
    }
}

AUTH_USER_MODEL = "comptes.Admin"
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Abidjan"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "media/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Cache / limitation de débit ---
REDIS_URL = env("REDIS_URL", default="redis://127.0.0.1:6379/0")
# Base Redis séparée pour le cache : le vider ne doit jamais effacer la file Celery ni le temps réel
REDIS_CACHE_URL = env("REDIS_CACHE_URL", default=REDIS_URL.rsplit("/", 1)[0] + "/1")
_REDIS_OPTIONS = {
    "CLIENT_CLASS": "django_redis.client.DefaultClient",
    # délais courts : un Redis bloqué ne doit pas ralentir les requêtes
    "SOCKET_CONNECT_TIMEOUT": 0.5,
    "SOCKET_TIMEOUT": 0.5,
    "CONNECTION_POOL_KWARGS": {"max_connections": env.int("REDIS_MAX_CONNEXIONS", default=200)},
}
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_CACHE_URL,
        # Redis indisponible : l'application continue sans cache (jamais d'erreur pour l'utilisateur)
        "OPTIONS": {**_REDIS_OPTIONS, "IGNORE_EXCEPTIONS": True},
    },
    # Limites anti-abus sensibles (connexion, renvoi d'email) : les erreurs Redis remontent pour que
    # `apps.comptes.throttles.CacheDeSecours` bascule sur une mémoire locale au lieu de tout laisser passer.
    "limites": {"BACKEND": "django_redis.cache.RedisCache", "LOCATION": REDIS_CACHE_URL, "OPTIONS": _REDIS_OPTIONS},
    "limites_local": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "limites"},
}

# --- Django REST Framework ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.comptes.authentication.CookieJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["apps.comptes.permissions.CompteUtilisable"],
    "DEFAULT_RENDERER_CLASSES": ["djangorestframework_camel_case.render.CamelCaseJSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    "JSON_UNDERSCOREIZE": {"no_underscore_before_number": True},
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Nombre de proxys de confiance devant Django (Caddy) : l'IP du client est la dernière adresse
    # ajoutée à X-Forwarded-For. Sans ce réglage, l'en-tête complet (falsifiable) servait d'identifiant
    # et permettait de contourner toutes les limites de débit par IP.
    "NUM_PROXIES": env.int("NUM_PROXIES", default=1),
    # Limites de débit. Les limites par IP restent larges : le jour J, des centaines de personnes partagent
    # la même adresse (Wi-Fi de la salle, opérateurs mobiles) ; les limites par compte et par email
    # protègent contre la force brute et l'abus d'envoi.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("LIMITE_ANONYME", default="600/min"),
        "user": env("LIMITE_COMPTE", default="1200/min"),
        "connexion": "5/min",  # par IP et par email : des hôtes partageant une IP ne se bloquent pas
        "connexion_compte": "20/hour",
        "inscription": env("LIMITE_INSCRIPTION_IP", default="60/hour"),
        "renvoi_ip": "30/hour",
        "renvoi_email": "3/hour",
        "signalement_erreur": "30/min",
        "rapport": "30/hour",
    },
    "EXCEPTION_HANDLER": "apps.noyau.exceptions.gestionnaire_exceptions",
    # « ?format=xlsx|csv » désigne le format d'export, pas un rendu DRF
    "URL_FORMAT_OVERRIDE": None,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Flex’Checking API",
    "DESCRIPTION": "API d'émargement des cérémonies de graduation de MDE Business School.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # documentation de l'API réservée au super admin
    "SERVE_PERMISSIONS": ["apps.comptes.permissions.EstSuperAdmin"],
    "SERVE_AUTHENTICATION": ["apps.comptes.authentication.CookieJWTAuthentication"],
    "CAMELIZE_NAMES": True,
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.contrib.djangorestframework_camel_case.camelize_serializer_fields",
        "drf_spectacular.hooks.postprocess_schema_enums",
    ],
}

# --- JWT en cookies httpOnly ---
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=env.int("JWT_REFRESH_HOURS", default=12)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "USER_ID_FIELD": "id",
    # Chaque jeton porte une empreinte du mot de passe : un changement ou une réinitialisation du mot de
    # passe invalide aussitôt toutes les sessions ouvertes (API, rafraîchissement, WebSocket).
}
JWT_COOKIE_ACCESS = "fc_access"
JWT_COOKIE_REFRESH = "fc_refresh"
JWT_COOKIE_SECURE = env.bool("JWT_COOKIE_SECURE", default=True)
JWT_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_NAME = "fc_csrftoken"
CSRF_COOKIE_HTTPONLY = False  # lu par le frontend pour l'en-tête X-CSRFToken
CSRF_COOKIE_SECURE = JWT_COOKIE_SECURE
CSRF_COOKIE_SAMESITE = "Lax"

# --- En-têtes de sécurité ---
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "SAMEORIGIN"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
    SECURE_REDIRECT_EXEMPT = [r"^api/sante/$"]

# --- Celery ---
# --- Temps réel (WebSocket) : messages relayés par Redis entre Django, Celery et les écrans ---
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL], "capacity": 500, "expiry": 30},
    }
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = False
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # répartit la charge entre workers (envois d'emails en rafale)
CELERY_TASK_SOFT_TIME_LIMIT = 90
CELERY_TASK_TIME_LIMIT = 120
# File injoignable : échouer vite (l'email reste « en attente » et sera relancé par la tâche planifiée)
CELERY_BROKER_CONNECTION_TIMEOUT = 2
CELERY_BROKER_TRANSPORT_OPTIONS = {"socket_connect_timeout": 2, "socket_timeout": 5, "max_retries": 1}
CELERY_TASK_PUBLISH_RETRY_POLICY = {"max_retries": 1, "interval_start": 0, "interval_step": 0.5}
CELERY_BEAT_SCHEDULE = {
    "relancer-emails-en-attente": {"task": "apps.noyau.tasks.relancer_emails_en_attente", "schedule": 300},
    "purger-exports": {"task": "apps.noyau.tasks.purger", "schedule": 3600},
}

# --- Emails ---
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="evenements@mde.ci")
EMAIL_FILE_PATH = env("EMAIL_FILE_PATH", default=str(BASE_DIR / "emails-envoyes"))

# --- Journalisation : aucune donnée personnelle dans les logs applicatifs ---
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"masquer_pii": {"()": "apps.noyau.logs.MasquerDonneesPersonnelles"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "filters": ["masquer_pii"]}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {"django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False}},
}
