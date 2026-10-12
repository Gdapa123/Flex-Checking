import hashlib
import logging

from django.core.cache import caches
from rest_framework.throttling import SimpleRateThrottle

journal = logging.getLogger(__name__)


class CacheDeSecours:
    """Cache des limites anti-abus sensibles : Redis, et mémoire locale du processus si Redis est
    indisponible. Une panne de Redis ne désactive donc jamais la protection contre la force brute
    (elle devient seulement propre à chaque processus le temps de la panne)."""

    def _appel(self, methode, *args):
        try:
            return getattr(caches["limites"], methode)(*args)
        except Exception:  # noqa: BLE001
            journal.warning("Redis indisponible : limites de débit en mémoire locale")
            return getattr(caches["limites_local"], methode)(*args)

    def get(self, cle, defaut=None):
        return self._appel("get", cle, defaut)

    def set(self, cle, valeur, duree=None):
        return self._appel("set", cle, valeur, duree)


class LimiteSensible(SimpleRateThrottle):
    cache = CacheDeSecours()


class ConnexionThrottle(LimiteSensible):
    scope = "connexion"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        cle = hashlib.sha256(f"{self.get_ident(request)}:{email}".encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": cle}


class ConnexionCompteThrottle(LimiteSensible):
    """Limite par compte visé, quelle que soit l'IP (attaque distribuée sur un même email)."""

    scope = "connexion_compte"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return None
        return self.cache_format % {"scope": self.scope, "ident": hashlib.sha256(email.encode()).hexdigest()}
