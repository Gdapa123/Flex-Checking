"""Suppressions du super admin : programmes, cérémonies, comptes et invités (confirmation, garde-fous, journal)."""

import pytest

from apps.comptes.models import Admin, Role
from apps.noyau.models import Emargement, Evenement, Invite, JournalActivite, Programme

from .conftest import MDP, client_connecte, nouvel_invite

pytestmark = pytest.mark.django_db


def test_cereremonie_avec_invites_exige_le_nom(client_sa, evenement):
    nouvel_invite(evenement)
    url = f"/api/evenements/{evenement.pk}/"
    assert client_sa.delete(url).json()["code"] == "CONFIRMATION_REQUISE"
    assert client_sa.delete(url + "?confirmation=autre").status_code == 400
    assert client_sa.delete(url + "?confirmation=" + evenement.nom_affiche.lower()).status_code == 204
    assert not Evenement.objects.filter(pk=evenement.pk).exists() and not Invite.objects.exists()
    j = JournalActivite.objects.get(action="EVENEMENT_SUPPRESSION")
    assert j.details["invites"] == 1


def test_ceremonie_vide_sans_confirmation(client_sa, evenement):
    assert client_sa.delete(f"/api/evenements/{evenement.pk}/").status_code == 204


def test_programme_avec_ceremonies(client_sa, evenement, programme):
    nouvel_invite(evenement)
    url = f"/api/programmes/{programme.pk}/"
    assert client_sa.delete(url).status_code == 400
    assert client_sa.delete(f"{url}?confirmation={programme.nom}").status_code == 204
    assert not Programme.objects.filter(pk=programme.pk).exists() and not Evenement.objects.exists()


def test_suppression_de_compte_garde_l_historique(client_sa, admin, evenement):
    inv = nouvel_invite(evenement)
    client_connecte(admin).post(f"/api/invites/{inv.pk}/presence/")
    assert client_sa.delete(f"/api/admins/{admin.pk}/").status_code == 204
    assert not Admin.objects.filter(pk=admin.pk).exists()
    em = Emargement.objects.get(invite=inv)
    assert em.admin is None  # émargement conservé
    historique = client_sa.get(f"/api/invites/{inv.pk}/historique/").json()
    assert any("Compte supprimé" in (e.get("detail") or "") for e in historique)
    assert JournalActivite.objects.filter(action="ADMIN_SUPPRESSION").exists()


def test_garde_fous_des_comptes(client_sa, super_admin):
    assert client_sa.delete(f"/api/admins/{super_admin.pk}/").json()["code"] == "COMPTE_COURANT"
    autre = Admin.objects.create_user("sa2@mde.ci", "Autre Super", MDP, role=Role.SUPER_ADMIN)
    c = client_connecte(autre)
    assert c.delete(f"/api/admins/{super_admin.pk}/").status_code == 204  # il reste « autre »


def test_dernier_super_admin_protege(client_sa, super_admin):
    autre = Admin.objects.create_user("sa2@mde.ci", "Autre Super", MDP, role=Role.SUPER_ADMIN)
    assert client_sa.delete(f"/api/admins/{autre.pk}/").status_code == 204
    # il ne reste que le compte courant, qui ne peut pas se supprimer lui-même
    assert client_sa.delete(f"/api/admins/{super_admin.pk}/").status_code == 409


def test_suppression_d_invites_reservee_au_super_admin(client_sa, client_admin, evenement):
    a, b, c = (nouvel_invite(evenement, email=f"x{i}@sib.ci") for i in range(3))
    assert client_admin.delete(f"/api/invites/{a.pk}/").status_code == 403
    assert client_sa.delete(f"/api/invites/{a.pk}/").status_code == 204
    url = f"/api/evenements/{evenement.pk}/invites/actions-groupees/"
    corps = {"action": "SUPPRIMER", "ids": [b.pk, c.pk]}
    assert client_admin.post(url, corps, format="json").status_code == 403
    assert client_sa.post(url, corps, format="json").json() == {"traites": 2}
    assert not Invite.objects.exists()
    j = JournalActivite.objects.filter(action="INVITE_SUPPRESSION").order_by("-date").first()
    assert j.details["nb"] == 2 and "x1@sib.ci" not in str(j.details)  # aucune donnée personnelle
