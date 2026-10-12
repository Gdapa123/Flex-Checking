"""Diffusion des changements aux écrans connectés (WebSocket, Django Channels).

Les messages ne contiennent que des sujets (« invites », « statistiques »…) et des identifiants
d'événements, jamais de données personnelles : le navigateur recharge ce qui le concerne par
l'API REST, qui applique les droits habituels.

Les notifications sont envoyées après le commit (un écran ne recharge jamais une donnée encore
annulable) et regroupées : une action groupée sur 500 invités produit un message par groupe.
"""

import logging
import threading

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.comptes.models import Admin

from .caches import CLE_ANALYTIQUE, cle_public, cle_statistiques, invalider
from .models import (
    EmailEnvoye,
    Emargement,
    ErreurTechnique,
    Evenement,
    Invite,
    JournalActivite,
    Parametres,
    Programme,
    SourceErreur,
)

journal = logging.getLogger(__name__)

TOUS = "tous"  # super admins : tous les événements
CONNECTES = "connectes"  # tous les comptes connectés


def groupe_evenement(evenement_id):
    return f"evenement.{evenement_id}"


def groupe_compte(admin_id):
    return f"compte.{admin_id}"


_local = threading.local()


def notifier(groupes, sujets=(), *, evenement=None, type_message="maj"):
    """Prépare une notification, envoyée au commit de la transaction en cours."""
    attente = getattr(_local, "attente", None)
    if attente is None:
        attente = _local.attente = {}
    for groupe in groupes:
        contenu = attente.setdefault((groupe, type_message), {"sujets": set(), "evenements": set()})
        contenu["sujets"].update(sujets)
        if evenement is not None:
            contenu["evenements"].add(evenement)
    # Un rappel par appel : le premier exécuté envoie tout, les suivants ne trouvent plus rien.
    transaction.on_commit(_envoyer)


def notifier_evenement(evenement_id, sujets):
    notifier([groupe_evenement(evenement_id), TOUS], sujets, evenement=evenement_id)


def _envoyer():
    attente = getattr(_local, "attente", None)
    if not attente:
        return
    _local.attente = {}
    couche = get_channel_layer()
    if couche is None:
        return
    for (groupe, type_message), contenu in attente.items():
        message = {
            "type": type_message,
            "sujets": sorted(contenu["sujets"]),
            "evenements": sorted(contenu["evenements"]),
        }
        try:
            async_to_sync(couche.group_send)(groupe, message)
        except Exception as exc:  # noqa: BLE001 — Redis indisponible : les écrans repassent en interrogation périodique
            journal.warning("Notification temps réel impossible (%s)", groupe, exc_info=True)
            from .erreurs import enregistrer_exception

            # pas de notification de cette erreur-ci : elle échouerait de la même façon
            _local.sans_notification = True
            try:
                enregistrer_exception(SourceErreur.SERVEUR, exc, lieu="Relais temps réel (Redis)")
            finally:
                _local.sans_notification = False
            return


# ---------------------------------------------------------------------------- signaux

SUJETS_INVITES = ("invites", "statistiques", "recents", "evenements")


def _slug(evenement_id):
    return Evenement.objects.filter(pk=evenement_id).values_list("slug_inscription", flat=True).first()


@receiver([post_save, post_delete], sender=Invite)
def _invite(sender, instance, **kwargs):
    # places restantes de la page publique et statistiques : caches vidés immédiatement
    # (événement déjà chargé : pas de requête supplémentaire par invité, ex. suppression en cascade)
    slug = instance.evenement.slug_inscription if Invite.evenement.is_cached(instance) else _slug(instance.evenement_id)
    invalider(cle_statistiques(instance.evenement_id), cle_public(slug), CLE_ANALYTIQUE)
    notifier_evenement(instance.evenement_id, SUJETS_INVITES)


@receiver(post_save, sender=Emargement)
def _emargement(sender, instance, **kwargs):
    invalider(cle_statistiques(instance.invite.evenement_id), CLE_ANALYTIQUE)
    notifier_evenement(instance.invite.evenement_id, SUJETS_INVITES)


@receiver(post_save, sender=EmailEnvoye)
def _email(sender, instance, **kwargs):
    invalider(cle_statistiques(instance.invite.evenement_id))
    notifier_evenement(instance.invite.evenement_id, ("invites", "statistiques"))


@receiver(post_save, sender=JournalActivite)
def _journal(sender, instance, **kwargs):
    notifier([TOUS], ("journal",))


@receiver(pre_save, sender=Evenement)
def _evenement_avant(sender, instance, **kwargs):
    # lien régénéré : l'ancien lien doit cesser de fonctionner tout de suite (pas de réponse en cache)
    instance._slug_precedent = _slug(instance.pk) if instance.pk else None


@receiver([post_save, post_delete], sender=Evenement)
def _evenement(sender, instance, **kwargs):
    invalider(
        cle_statistiques(instance.pk),
        cle_public(instance.slug_inscription),
        cle_public(getattr(instance, "_slug_precedent", None)),
        CLE_ANALYTIQUE,
    )
    notifier_evenement(instance.pk, ("evenement", "evenements", "statistiques"))


@receiver([post_save, post_delete], sender=Programme)
def _programme(sender, instance, **kwargs):
    groupes = [TOUS]
    if kwargs.get("signal") is post_save:
        evenements = list(instance.evenements.values_list("pk", "slug_inscription"))
        invalider(*[cle_public(slug) for _, slug in evenements], *[cle_statistiques(pk) for pk, _ in evenements])
        groupes += [groupe_evenement(pk) for pk, _ in evenements]
    notifier(groupes, ("programmes", "evenement", "evenements", "apercu-emails"))


@receiver(post_save, sender=Parametres)
def _parametres(sender, instance, **kwargs):
    notifier([CONNECTES], ("parametres", "apercu-emails"))


@receiver(post_save, sender=Admin)
def _admin(sender, instance, **kwargs):
    notifier([TOUS], ("admins",))
    # le périmètre (rôle, activation) est recalculé côté connexion ; un compte désactivé est déconnecté
    notifier([groupe_compte(instance.pk)], type_message="perimetre")


@receiver(post_delete, sender=Admin)
def _admin_supprime(sender, instance, **kwargs):
    notifier([groupe_compte(instance.pk)], type_message="fermer")


@receiver(m2m_changed, sender=Evenement.admins.through)
def _affectations(sender, instance, action, reverse, pk_set, **kwargs):
    if action == "pre_clear":
        # pk_set est vide pour un clear : on mémorise les comptes concernés avant la suppression
        instance._admins_avant_clear = [instance.pk] if reverse else list(instance.admins.values_list("pk", flat=True))
        return
    if action not in ("post_add", "post_remove", "post_clear"):
        return
    if reverse:
        comptes = [instance.pk]
    elif action == "post_clear":
        comptes = getattr(instance, "_admins_avant_clear", [])
    else:
        comptes = list(pk_set or ())
    notifier([TOUS], ("admins", "evenements"))
    notifier([groupe_compte(pk) for pk in comptes], type_message="perimetre")


@receiver(post_save, sender=ErreurTechnique)
def _erreur(sender, instance, **kwargs):
    if not getattr(_local, "sans_notification", False):
        notifier([TOUS], ("erreurs",))
