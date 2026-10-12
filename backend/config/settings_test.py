import os

os.environ.setdefault("DJANGO_SECRET_KEY", "cle-de-test-suffisamment-longue-pour-hmac-sha256")

from .settings import *  # noqa: E402, F403

CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    "limites": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "limites-test"},
    "limites_local": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "limites-local-test"},
}
CELERY_TASK_ALWAYS_EAGER = True
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
JWT_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
MEDIA_ROOT = BASE_DIR / "media-tests"  # noqa: F405
SECRET_KEY = "cle-de-test-suffisamment-longue-pour-hmac-sha256"
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
