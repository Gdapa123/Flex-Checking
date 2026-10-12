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

    def incrementer(self, cle, duree):
        """Compteur à fenêtre fixe : crée la clé à 1 (durée `duree`) ou l'incrémente."""
        if self._appel("add", cle, 1, duree) is False:
            try:
                self._appel("incr", cle)
            except ValueError:  # clé expirée entre les deux appels
                self._appel("set", cle, 1, duree)


def email_soumis(request):
    """Adresse email du corps de la requête, normalisée. Un corps JSON qui n'est pas un objet (liste,
    nombre…) donne une adresse vide au lieu d'une erreur serveur avant même la validation."""
    from apps.noyau.validation import donnees_objet

    return str(donnees_objet(request).get("email", "")).strip().lower()


class LimiteSensible(SimpleRateThrottle):
    cache = CacheDeSecours()


class ConnexionThrottle(LimiteSensible):
    scope = "connexion"

    def get_cache_key(self, request, view):
        email = email_soumis(request)
        cle = hashlib.sha256(f"{self.get_ident(request)}:{email}".encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": cle}


class ConnexionCompteThrottle(LimiteSensible):
    """Limite par compte visé, quelle que soit l'IP (attaque distribuée sur un même email)."""

    scope = "connexion_compte"

    def get_cache_key(self, request, view):
        email = email_soumis(request)
        if not email:
            return None
        return self.cache_format % {"scope": self.scope, "ident": hashlib.sha256(email.encode()).hexdigest()}
