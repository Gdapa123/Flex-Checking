"""Actions groupées et exports lourds (> 50 invités) exécutés par Celery.

L'état des tâches est conservé dans le cache (clé `tache:<id>`) avec le propriétaire, pour que
seul l'admin qui l'a lancée puisse la consulter et télécharger le fichier produit.
"""

import uuid
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.core.cache import cache

SEUIL_ASYNCHRONE = 50
DUREE = 60 * 60 * 6
DOSSIER = Path(settings.MEDIA_ROOT) / "exports"


def creer_tache(proprietaire_id, nature):
    tache_id = uuid.uuid4().hex
    cache.set(
        f"tache:{tache_id}",
        {"id": tache_id, "proprietaire": proprietaire_id, "nature": nature, "statut": "EN_COURS"},
        DUREE,
    )
    return tache_id


def lire_tache(tache_id):
    return cache.get(f"tache:{tache_id}")


def _terminer(tache_id, **resultat):
    etat = lire_tache(tache_id) or {"id": tache_id}
    etat.update(resultat)
    cache.set(f"tache:{tache_id}", etat, DUREE)


def ecrire_fichier(contenu, extension):
    DOSSIER.mkdir(parents=True, exist_ok=True)
    nom = f"{uuid.uuid4().hex}.{extension}"
    (DOSSIER / nom).write_bytes(contenu)
    return nom


@shared_task
def tache_export(tache_id, admin_id, invite_ids, fmt, nom_fichier, type_export="invites", evenement_id=None):
    from apps.comptes.models import Admin

    from . import exports
    from .journal import journaliser
    from .models import Invite

    try:
        qs = Invite.objects.filter(pk__in=invite_ids)
        fabrique = exports.lignes_presences if type_export == "presences" else exports.lignes_invites
        entetes, lignes = fabrique(qs)
        contenu, _mime, ext = exports.fichier(entetes, lignes, fmt, "Invités")
        stocke = ecrire_fichier(contenu, ext)
        journaliser(
            Admin.objects.get(pk=admin_id),
            "EXPORT",
            None,
            format=fmt,
            nb=len(lignes),
            type=type_export,
            evenement=evenement_id,
        )
        _terminer(tache_id, statut="TERMINEE", fichier=stocke, nom=f"{nom_fichier}.{ext}", nb=len(lignes))
    except Exception as exc:  # noqa: BLE001
        _terminer(tache_id, statut="ECHEC", erreur=str(exc)[:300])
        raise


@shared_task
def tache_action_groupee(tache_id, admin_id, evenement_id, action, invite_ids, contexte=None):
    from apps.comptes.models import Admin

    from .models import Evenement
    from .vues_invites import executer_action_groupee

    try:
        admin = Admin.objects.get(pk=admin_id)
        evenement = Evenement.objects.select_related("programme").get(pk=evenement_id)
        resultat = executer_action_groupee(admin, evenement, action, invite_ids, contexte or {})
        _terminer(tache_id, statut="TERMINEE", **resultat)
    except Exception as exc:  # noqa: BLE001
        _terminer(tache_id, statut="ECHEC", erreur=str(exc)[:300])
        raise
