"""Mesures techniques de l'API (graphiques « technique » du super admin).

Par minute : nombre de requêtes, erreurs 4xx / 5xx, durée cumulée et requêtes lentes (> 1 s).
Un seul aller-retour Redis par requête (pipeline) ; aucune donnée personnelle ; conservation 2 h.
Redis indisponible : la mesure est simplement perdue, la requête n'est jamais ralentie.
"""

import logging
import time

from django.utils import timezone

journal = logging.getLogger(__name__)
CONSERVATION = 2 * 3600
LENTE_MS = 1000
PAUSE_PANNE = 30  # secondes sans tentative après un échec Redis (aucun délai ajouté aux requêtes)
_panne_jusqua = 0.0


def _redis():
    try:
        from django_redis import get_redis_connection

        return get_redis_connection("default")
    except Exception:  # noqa: BLE001 — cache local (tests) ou Redis absent
        return None


def cle_minute(dt):
    return f"mesures:{dt:%Y%m%d%H%M}"


class MesuresMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith("/api/") or request.path == "/api/sante/":
            return self.get_response(request)
        debut = time.monotonic()
        reponse = self.get_response(request)
        self._enregistrer(reponse.status_code, int((time.monotonic() - debut) * 1000))
        return reponse

    @staticmethod
    def _enregistrer(statut, duree_ms):
        global _panne_jusqua
        if time.monotonic() < _panne_jusqua:
            return
        r = _redis()
        if r is None:
            return
        cle = cle_minute(timezone.localtime())
        try:
            p = r.pipeline(transaction=False)
            p.hincrby(cle, "n", 1)
            p.hincrby(cle, "ms", duree_ms)
            if statut >= 500:
                p.hincrby(cle, "e5", 1)
            elif statut >= 400:
                p.hincrby(cle, "e4", 1)
            if duree_ms >= LENTE_MS:
                p.hincrby(cle, "lent", 1)
            p.expire(cle, CONSERVATION)
            p.execute()
        except Exception:  # noqa: BLE001
            _panne_jusqua = time.monotonic() + PAUSE_PANNE
            journal.debug("Mesure non enregistrée", exc_info=True)


def dernieres_minutes(n=60):
    """Série des `n` dernières minutes (heure locale), complétée par des zéros."""
    from datetime import timedelta

    maintenant = timezone.localtime().replace(second=0, microsecond=0)
    minutes = [maintenant - timedelta(minutes=i) for i in range(n - 1, -1, -1)]
    valeurs = [{} for _ in minutes]
    r = _redis()
    if r is not None:
        try:
            p = r.pipeline(transaction=False)
            for m in minutes:
                p.hgetall(cle_minute(m))
            valeurs = p.execute()
        except Exception:  # noqa: BLE001
            journal.debug("Mesures illisibles", exc_info=True)
    serie = []
    for m, v in zip(minutes, valeurs, strict=True):
        v = {k.decode() if isinstance(k, bytes) else k: int(x) for k, x in (v or {}).items()}
        n_req = v.get("n", 0)
        serie.append(
            {
                "minute": f"{m:%H:%M}",
                "requetes": n_req,
                "erreurs5xx": v.get("e5", 0),
                "erreurs4xx": v.get("e4", 0),
                "lentes": v.get("lent", 0),
                "dureeMoyenneMs": round(v.get("ms", 0) / n_req) if n_req else 0,
            }
        )
    return serie
