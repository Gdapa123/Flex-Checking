import hashlib

from rest_framework.throttling import SimpleRateThrottle


class ConnexionThrottle(SimpleRateThrottle):
    scope = "connexion"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        cle = hashlib.sha256(f"{self.get_ident(request)}:{email}".encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": cle}


class ConnexionCompteThrottle(SimpleRateThrottle):
    """Limite par compte visé, quelle que soit l'IP (attaque distribuée sur un même email)."""

    scope = "connexion_compte"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return None
        return self.cache_format % {"scope": self.scope, "ident": hashlib.sha256(email.encode()).hexdigest()}
