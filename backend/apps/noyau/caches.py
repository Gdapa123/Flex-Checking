"""Caches applicatifs (Redis) des lectures les plus sollicitées.

Ils absorbent les pics : des dizaines d'écrans qui rechargent les statistiques au même instant
(notification temps réel) ou des centaines d'invités qui ouvrent le lien d'inscription. Chaque cache
est vidé dès que ses données changent (signaux de `temps_reel`) : les chiffres affichés restent exacts.
Redis indisponible : le cache est ignoré et les données sont lues en base.
"""

from django.core.cache import cache
from django.db import transaction

DUREE = 30  # secondes, filet de sécurité si une invalidation était manquée
CLE_ANALYTIQUE = "analytique"  # analyses du super admin (toutes cérémonies)


def cle_statistiques(evenement_id):
    return f"stats:{evenement_id}"


def cle_public(slug):
    return f"public:{slug}"


def lire(cle, calcul, duree=DUREE):
    valeur = cache.get(cle)
    if valeur is None:
        valeur = calcul()
        cache.set(cle, valeur, duree)
    return valeur


def invalider(*cles):
    """Vide les clés tout de suite, puis de nouveau au commit : une lecture concurrente faite entre les
    deux (données pas encore validées) ne peut pas remettre en cache l'ancien état pour `DUREE` secondes."""
    cles = [c for c in cles if c]
    if not cles:
        return
    cache.delete_many(cles)
    if transaction.get_connection().in_atomic_block:
        transaction.on_commit(lambda: cache.delete_many(cles))
