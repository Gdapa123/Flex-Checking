import pytest
from rest_framework.test import APIClient

from apps.noyau.models import JournalActivite

from .conftest import MDP, client_connecte, nouvel_invite

pytestmark = pytest.mark.django_db


def test_non_connecte_refuse(evenement):
    c = APIClient()
    assert c.get(f"/api/evenements/{evenement.pk}/invites/").status_code in (401, 403)
    assert c.get("/api/programmes/").status_code in (401, 403)


def test_connexion_cookies_httponly(admin):
    c = APIClient()
    r = c.post("/api/auth/connexion/", {"email": admin.email, "motDePasse": MDP}, format="json")
    assert r.status_code == 200
    assert r.cookies["fc_access"]["httponly"] and r.cookies["fc_refresh"]["httponly"]
    assert "access" not in r.json()  # le jeton n'est jamais exposé au JavaScript
    assert JournalActivite.objects.filter(action="CONNEXION", auteur=admin).exists()


def test_mauvais_mot_de_passe_et_limitation(admin):
    c = APIClient()
    for _ in range(5):
        r = c.post("/api/auth/connexion/", {"email": admin.email, "motDePasse": "faux"}, format="json")
        assert r.status_code == 401
    r = c.post("/api/auth/connexion/", {"email": admin.email, "motDePasse": MDP}, format="json")
    assert r.status_code == 429


def test_csrf_obligatoire_sur_ecriture(admin, evenement):
    c = client_connecte(admin)
    c.credentials()  # retire l'en-tête X-CSRFToken
    inv = nouvel_invite(evenement)
    r = c.post(f"/api/invites/{inv.pk}/presence/")
    assert r.status_code == 403


def test_compte_desactive(admin, evenement):
    c = client_connecte(admin)
    admin.actif = False
    admin.save()
    assert c.get(f"/api/evenements/{evenement.pk}/invites/").status_code in (401, 403)


def test_rafraichir_et_deconnexion(admin):
    c = client_connecte(admin)
    assert c.post("/api/auth/rafraichir/").status_code == 204
    assert c.get("/api/auth/moi/").json()["email"] == admin.email
    assert c.post("/api/auth/deconnexion/").status_code == 204
    assert c.post("/api/auth/rafraichir/").status_code == 401


def test_admin_limite_a_ses_evenements(admin, evenement, autre_evenement):
    c = client_connecte(admin)
    ids = [e["id"] for e in c.get("/api/evenements/").json()]
    assert ids == [evenement.pk]
    autre = nouvel_invite(autre_evenement, email="z@sib.ci")
    assert c.get(f"/api/evenements/{autre_evenement.pk}/").status_code == 404
    assert c.get(f"/api/evenements/{autre_evenement.pk}/invites/").status_code == 404
    assert c.get(f"/api/evenements/{autre_evenement.pk}/statistiques/").status_code == 404
    assert c.get(f"/api/invites/{autre.pk}/").status_code == 404
    assert c.patch(f"/api/invites/{autre.pk}/", {"nom": "Pirate"}, format="json").status_code == 404
    assert c.get(f"/api/invites/{autre.pk}/historique/").status_code == 404
    assert c.post(f"/api/invites/{autre.pk}/renvoi-email/", {}, format="json").status_code == 404


def test_admin_interdit_sur_super_admin(admin, evenement):
    c = client_connecte(admin)
    assert c.post("/api/programmes/", {"nom": "X"}, format="json").status_code == 403
    assert c.patch(f"/api/evenements/{evenement.pk}/", {"capacite": 5}, format="json").status_code == 403
    assert c.get("/api/admins/").status_code == 403
    assert c.get("/api/parametres/").status_code == 403
    assert c.get("/api/journal/").status_code == 403
    assert c.get("/api/invites/").status_code == 403
    assert c.get("/api/exports/invites/").status_code == 403


def test_super_admin_voit_tout(super_admin, evenement, autre_evenement):
    c = client_connecte(super_admin)
    assert len(c.get("/api/evenements/").json()) >= 2
    assert c.get(f"/api/evenements/{autre_evenement.pk}/invites/").status_code == 200


def test_x_forwarded_for_falsifie_ne_contourne_pas_la_limite(admin):
    """Changer X-Forwarded-For à chaque essai ne doit pas réinitialiser la limite de connexion."""
    c = APIClient()
    for i in range(5):
        c.post(
            "/api/auth/connexion/",
            {"email": admin.email, "motDePasse": "faux"},
            format="json",
            HTTP_X_FORWARDED_FOR=f"10.0.0.{i}, 203.0.113.7",
        )
    r = c.post(
        "/api/auth/connexion/",
        {"email": admin.email, "motDePasse": MDP},
        format="json",
        HTTP_X_FORWARDED_FOR="10.9.9.9, 203.0.113.7",
    )
    assert r.status_code == 429


def test_limite_par_compte_quelle_que_soit_l_ip(admin):
    """Attaque distribuée sur un même compte : bloquée après 20 essais par heure."""
    c = APIClient()
    for i in range(20):
        c.post(
            "/api/auth/connexion/",
            {"email": admin.email, "motDePasse": "faux"},
            format="json",
            HTTP_X_FORWARDED_FOR=f"198.51.100.{i}",
        )
    r = c.post(
        "/api/auth/connexion/",
        {"email": admin.email, "motDePasse": MDP},
        format="json",
        HTTP_X_FORWARDED_FOR="192.0.2.250",
    )
    assert r.status_code == 429


def test_documentation_api_reservee(db):
    assert APIClient().get("/api/schema/").status_code in (401, 403)
