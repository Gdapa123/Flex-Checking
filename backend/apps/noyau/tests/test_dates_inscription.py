"""Une inscription n'est jamais datée dans le futur (données de démo comprises)."""

import importlib
from datetime import timedelta

import pytest
from django.apps import apps as django_apps
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.utils import timezone

from apps.noyau.models import EmailEnvoye, Invite, Source, TypeEmail
from apps.noyau.services import creer_invite

from .conftest import donnees_reference

pytestmark = pytest.mark.django_db


def donnees(email="futur@exemple.ci"):
    return dict(civilite="M", nom="Koné", prenom="Yao", email=email, telephone="+225 07 00 00 00 00")


def test_modele_refuse_une_inscription_dans_le_futur(evenement):
    invite = creer_invite(evenement, donnees(), source=Source.MANUEL)
    invite.inscrit_le = timezone.now() + timedelta(days=3)
    with pytest.raises(ValidationError):
        invite.save()
    invite.inscrit_le = timezone.now()
    invite.consentement_le = timezone.now() + timedelta(hours=2)
    with pytest.raises(ValidationError):
        invite.save()


def test_seed_demo_sans_date_future(monkeypatch):
    donnees_reference()
    monkeypatch.setenv("DEMO_MOT_DE_PASSE_SUPER_ADMIN", "Demo-Test-2026!")
    monkeypatch.setenv("DEMO_MOT_DE_PASSE_ADMIN", "Demo-Test-2026!")
    call_command("seed_demo", "--force", verbosity=0)
    maintenant = timezone.now()
    assert Invite.objects.exists()
    assert not Invite.objects.filter(inscrit_le__gt=maintenant).exists()
    assert not Invite.objects.filter(consentement_le__gt=maintenant).exists()
    assert not EmailEnvoye.objects.filter(envoye_le__gt=maintenant).exists()


def test_migration_supprime_les_inscriptions_futures(evenement):
    passe = creer_invite(evenement, donnees("passe@exemple.ci"), source=Source.MANUEL)
    futur = creer_invite(evenement, donnees("futur@exemple.ci"), source=Source.MANUEL)
    # anciennes données de démo : écrites sans passer par save()
    Invite.objects.filter(pk=futur.pk).update(inscrit_le=timezone.now() + timedelta(days=10))
    EmailEnvoye.objects.create(invite=futur, type=TypeEmail.INVITATION)
    migration = importlib.import_module("apps.noyau.migrations.0008_inscriptions_pas_dans_le_futur")
    migration.supprimer(django_apps, None)
    assert list(Invite.objects.filter(evenement=evenement)) == [passe]
    assert not EmailEnvoye.objects.filter(invite_id=futur.pk).exists()
