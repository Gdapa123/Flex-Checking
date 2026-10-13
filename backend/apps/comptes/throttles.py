import hashlib
import logging
import time

from django.core.cache import caches
from django.core.cache.backends.db import DatabaseCache
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
        """Compteur à fenêtre fixe : crée la clé à 1 (durée `duree`) ou l'incrémente ; rend la nouvelle valeur.
        L'incrément est atomique avec Redis : des requêtes parallèles ne peuvent pas toutes lire la même valeur
        (le cache en base, sans Redis, ne l'est pas : environnement de test seulement)."""
        if self._appel("add", cle, 1, duree) is not False:
            self._noter_fin(cle, duree)
            return 1
        try:
            n = self._appel("incr", cle)
        except ValueError:  # clé expirée entre les deux appels
            self._appel("set", cle, 1, duree)
            self._noter_fin(cle, duree)
            return 1
        self._retablir_fin(cle)
        return n

    def decrementer(self, cle):
        try:
            self._appel("decr", cle)
        except ValueError:  # clé expirée : rien à retirer
            return
        self._retablir_fin(cle)

    # Le cache en base (sans Redis) implémente incr/decr en réécrivant la clé avec la durée par défaut (300 s) :
    # la fenêtre de comptage serait raccourcie. On mémorise sa fin pour la rétablir après chaque modification.
    @staticmethod
    def _en_base():
        return isinstance(caches["limites"], DatabaseCache)

    def _noter_fin(self, cle, duree):
        if self._en_base():
            self._appel("set", f"{cle}:fin", time.time() + duree, duree)

    def _retablir_fin(self, cle):
        if self._en_base():
            fin = self._appel("get", f"{cle}:fin")
            if fin:
                self._appel("touch", cle, max(1, int(fin - time.time())))

    def supprimer(self, cle):
        return self._appel("delete", cle)


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


class ConnexionIpThrottle(LimiteSensible):
    """Limite par IP, toutes adresses email confondues : un attaquant ne multiplie pas ses essais en changeant
    d'adresse visée. Large, car les hôtes d'une même salle partagent souvent une IP."""

    scope = "connexion_ip"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


# Échecs de connexion par compte visé, toutes IP confondues (attaque distribuée sur un même email). Seuls les
# ÉCHECS comptent : un attaquant ne peut pas « consommer » la limite avec des requêtes quelconques, et la vraie
# personne n'est bloquée qu'après une vraie série d'erreurs de mot de passe.
ECHECS_CONNEXION_PAR_COMPTE = 20
FENETRE_ECHECS_CONNEXION_S = 3600


def cle_echecs_connexion(email):
    return "echecs-connexion:" + hashlib.sha256(email.encode()).hexdigest()


class MotDePasseCompteThrottle(LimiteSensible):
    """Vérification du mot de passe d'un compte déjà connecté (espace hôte de la borne, changement de mot de passe).

    Limite par compte, quelle que soit l'IP : protège contre la force brute depuis une session laissée sans
    surveillance."""

    scope = "mot_de_passe_minute"

    def get_cache_key(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class MotDePasseCompteHeureThrottle(MotDePasseCompteThrottle):
    scope = "mot_de_passe_heure"


class LimiteIpPartagee(LimiteSensible):
    """Limite par IP des points d'accès publics, conservée dans le cache des limites sensibles (Redis, ou base sans
    Redis) : partagée entre toutes les instances, au lieu d'une mémoire propre à chaque processus."""

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
