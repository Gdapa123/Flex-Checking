"""Erreurs techniques : capture, masquage, regroupement, réponse neutre et consultation super admin."""

import pytest
from rest_framework.test import APIClient

from apps.noyau.emails import planifier
from apps.noyau.erreurs import enregistrer
from apps.noyau.models import ErreurTechnique, SourceErreur, TypeEmail

from .conftest import client_connecte, nouvel_invite
from .test_inscription import payload, url

pytestmark = pytest.mark.django_db


def signaler(**kw):
    corps = {"type": "TypeError", "message": "x is undefined", "lieu": "/i/amp/confirmation?q=1#a", **kw}
    return APIClient().post("/api/erreurs/", corps, format="json")


def test_signalement_navigateur_regroupe_et_masque():
    assert signaler(message="Échec pour aya@sib.ci au 07 12 34 56 78").status_code == 204
    assert signaler(message="Échec pour aya@sib.ci au 07 12 34 56 78").status_code == 204
    e = ErreurTechnique.objects.get()
    assert e.source == SourceErreur.NAVIGATEUR and e.occurrences == 2
    assert "aya@sib.ci" not in e.message and "[email]" in e.message and "[tél]" in e.message
    assert e.lieu == "/i/amp/confirmation"  # sans paramètres ni ancre


def test_signalement_invalide_ignore_sans_erreur():
    assert APIClient().post("/api/erreurs/", {"message": "x" * 5000}, format="json").status_code == 204
    assert not ErreurTechnique.objects.exists()


def test_erreur_serveur_reponse_neutre_et_enregistree(client, evenement, monkeypatch):
    def panne(*a, **k):
        raise RuntimeError("connexion perdue pour aya@sib.ci")

    monkeypatch.setattr("apps.noyau.vues_public.services.inscrire", panne)
    r = client.post(url(evenement, "inscription/"), payload(), content_type="application/json")
    assert r.status_code == 500
    assert r.json()["code"] == "ERREUR_SERVEUR" and "RuntimeError" not in r.content.decode()
    e = ErreurTechnique.objects.get()
    assert e.source == SourceErreur.SERVEUR and e.type == "RuntimeError"
    assert e.lieu.startswith("POST /api/public/evenements/") and "[email]" in e.message
    assert "Traceback" in e.details


def test_echec_definitif_email_enregistre(evenement, settings):
    inv = nouvel_invite(evenement)
    settings.EMAIL_BACKEND = "apps.noyau.tests.test_emails.BackendEnPanne"
    planifier(inv, TypeEmail.INVITATION)
    e = ErreurTechnique.objects.get(source=SourceErreur.EMAIL)
    assert e.type == "ConnectionRefusedError" and "Invitation" in e.lieu


def test_erreur_resolue_qui_revient_est_rouverte():
    enregistrer(SourceErreur.TACHE, "ValueError", "boom", lieu="tache")
    ErreurTechnique.objects.update(resolue=True)
    enregistrer(SourceErreur.TACHE, "ValueError", "boom", lieu="tache")
    e = ErreurTechnique.objects.get()
    assert not e.resolue and e.occurrences == 2


def test_consultation_reservee_au_super_admin(admin, super_admin):
    signaler()
    assert client_connecte(admin).get("/api/erreurs-techniques/").status_code == 403
    sa = client_connecte(super_admin)
    r = sa.get("/api/erreurs-techniques/").json()
    assert r["aTraiter"] == 1 and r["resultats"][0]["sourceLibelle"] == "Navigateur"

    pk = r["resultats"][0]["id"]
    assert sa.patch(f"/api/erreurs-techniques/{pk}/", {"resolue": True}, format="json").json()["resolue"]
    assert sa.get("/api/erreurs-techniques/").json()["total"] == 0  # filtre « à traiter » par défaut
    assert sa.get("/api/erreurs-techniques/", {"statut": "resolues"}).json()["total"] == 1
    assert sa.post("/api/erreurs-techniques/actions/", {"action": "supprimer_resolues"}, format="json").json() == {
        "nombre": 1
    }
    assert not ErreurTechnique.objects.exists()
