"""Analyses, rapports PDF, caches, santé et résilience (file d'envoi indisponible)."""

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.noyau import caches
from apps.noyau.models import EmailEnvoye, ErreurTechnique, JournalActivite, SourceErreur, StatutEmail
from apps.noyau.tasks import relancer_emails_en_attente

from .conftest import client_connecte, nouvel_invite
from .test_inscription import payload, url

pytestmark = pytest.mark.django_db


def test_rapport_evenement_pdf_et_droits(client_admin, evenement, autre_evenement):
    nouvel_invite(evenement, entreprise="<b>Évil & Co</b> <font size=90>")  # balises saisies par un invité
    r = client_admin.get(f"/api/evenements/{evenement.pk}/rapport/")
    assert r.status_code == 200 and r["Content-Type"] == "application/pdf"
    assert r.content.startswith(b"%PDF") and r["Cache-Control"] == "no-store"
    assert JournalActivite.objects.filter(action="EXPORT", details__type="rapport").exists()
    assert client_admin.get(f"/api/evenements/{autre_evenement.pk}/rapport/").status_code == 404


def test_rapport_global_reserve_au_super_admin(client_admin, client_sa, evenement):
    nouvel_invite(evenement, entreprise="A <script> & <b>B")  # top entreprises du rapport global
    assert client_admin.get("/api/rapports/global/").status_code == 403
    r = client_sa.get("/api/rapports/global/")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")


def test_analyses_super_admin(client_admin, client_sa, evenement):
    nouvel_invite(evenement)
    assert client_admin.get("/api/analytique/").status_code == 403
    a = client_sa.get("/api/analytique/").json()
    assert a["totaux"]["inscrits"] == 1 and a["programmes"][0]["programme"] == "AMP"
    assert len(a["inscriptionsParJour"]) == 60 and a["inscriptionsParJour"][-1]["nb"] == 1
    t = client_sa.get("/api/analytique/technique/").json()
    assert t["sante"]["base"] is True and len(t["requetes"]) == 60
    assert {e["source"] for e in t["erreursATraiter"]} == set(SourceErreur.values)


def test_statistiques_en_cache_et_toujours_exactes(client_admin, evenement):
    inv = nouvel_invite(evenement)
    assert client_admin.get(f"/api/evenements/{evenement.pk}/statistiques/").json()["presents"] == 0
    assert cache.get(caches.cle_statistiques(evenement.pk)) is not None
    client_admin.post(f"/api/invites/{inv.pk}/presence/")  # le changement vide le cache
    s = client_admin.get(f"/api/evenements/{evenement.pk}/statistiques/").json()
    assert s["presents"] == 1 and s["postes"] and s["inscriptions"][-1]["cumul"] == 1


def test_page_publique_en_cache_et_ancien_lien_coupe(client, client_sa, evenement):
    ancien = evenement.slug_inscription
    assert client.get(url(evenement)).status_code == 200
    assert cache.get(caches.cle_public(ancien)) is not None
    evenement.slug_inscription = "amp-2026-nouveau"
    evenement.save()
    assert client.get(f"/api/public/evenements/{ancien}/").status_code == 404  # pas de réponse en cache


def test_places_restantes_a_jour_apres_inscription(client, evenement):
    evenement.capacite = 1
    evenement.save()
    assert client.get(url(evenement)).json()["etat"] != "COMPLET"
    assert client.post(url(evenement, "inscription/"), payload(), content_type="application/json").status_code == 201
    assert client.get(url(evenement)).json()["etat"] == "COMPLET"


def test_sante_sans_details_publics(client):
    r = client.get("/api/sante/")
    assert r.status_code == 200 and r.json() == {"statut": "ok"}  # ni latence ni état de Redis


def test_limite_de_connexion_maintenue_si_redis_tombe(admin, monkeypatch):
    """Redis indisponible : la protection contre la force brute bascule en mémoire locale."""
    from django.core.cache import caches

    class RedisEnPanne:
        def close(self, **kwargs):  # fermeture en fin de requête : sans effet
            pass

        def __getattr__(self, nom):
            def panne(*a, **k):
                raise ConnectionError("Redis injoignable")

            return panne

    reel = caches.__getitem__
    monkeypatch.setattr(
        type(caches), "__getitem__", lambda self, alias: RedisEnPanne() if alias == "limites" else reel(alias)
    )
    c = APIClient()
    for _ in range(5):
        assert (
            c.post("/api/auth/connexion/", {"email": admin.email, "motDePasse": "faux"}, format="json").status_code
            == 401
        )
    r = c.post("/api/auth/connexion/", {"email": admin.email, "motDePasse": "faux"}, format="json")
    assert r.status_code == 429


def test_file_indisponible_n_empeche_pas_l_inscription(client, evenement, monkeypatch):
    def panne(*a, **k):
        raise ConnectionError("broker injoignable")

    monkeypatch.setattr("apps.noyau.tasks.envoyer_email.delay", panne)
    r = client.post(url(evenement, "inscription/"), payload(), content_type="application/json")
    assert r.status_code == 201  # l'invité est inscrit, sans erreur visible
    email = EmailEnvoye.objects.get()
    assert email.statut == StatutEmail.EN_ATTENTE and email.tentatives == 0
    assert ErreurTechnique.objects.filter(source=SourceErreur.TACHE).exists()


def test_relance_des_emails_restes_en_attente(evenement, monkeypatch):
    monkeypatch.setattr("apps.noyau.tasks.envoyer_email.delay", lambda *a, **k: None)
    inv = nouvel_invite(evenement)
    EmailEnvoye.objects.filter(invite=inv).update(
        statut=StatutEmail.EN_ATTENTE, tentatives=0, cree_le=timezone.now() - timedelta(minutes=20)
    )
    monkeypatch.undo()
    assert relancer_emails_en_attente() == 1
    assert EmailEnvoye.objects.get(invite=inv).statut == StatutEmail.ENVOYE


def test_documentation_api_reservee_au_super_admin(client_admin, client_sa):
    assert APIClient().get("/api/schema/").status_code in (401, 403)
    assert client_admin.get("/api/schema/").status_code == 403
    assert client_sa.get("/api/schema/").status_code == 200


def test_limite_de_generation_des_rapports(admin, evenement, settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK}
    from rest_framework.settings import api_settings

    taux = {**api_settings.DEFAULT_THROTTLE_RATES, "rapport": "2/hour"}
    from apps.noyau.vues_admin import RapportThrottle

    RapportThrottle.THROTTLE_RATES = taux
    try:
        c = client_connecte(admin)
        codes = [c.get(f"/api/evenements/{evenement.pk}/rapport/").status_code for _ in range(3)]
        assert codes == [200, 200, 429]
    finally:
        RapportThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
