from datetime import time, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.comptes.models import Admin, Role
from apps.noyau.models import Evenement, Programme
from apps.noyau.services import creer_invite

MDP = "MotDePasse-Test-1"


def donnees_reference():
    """Statuts et programmes (créés par data migration ; recréés si un test transactionnel a vidé la base)."""
    from apps.noyau.models import Statut

    for code, libelle, ordre in [("INSCRIT", "Inscrit", 1), ("PRESENT", "Présent", 2)]:
        Statut.objects.get_or_create(code=code, defaults={"libelle": libelle, "ordre": ordre})
    for nom, p, s in [("AMP", "#8F1C1F", "#F7941D"), ("PMD", "#1A5E36", "#FFF200")]:
        Programme.objects.get_or_create(nom=nom, defaults={"couleur_principale": p, "couleur_secondaire": s})


@pytest.fixture
def programme(db):
    donnees_reference()
    p = Programme.objects.get(nom="AMP")
    p.magazine_actif, p.lien_magazine = True, "https://mde.ci/magazine/amp"
    p.save()
    return p


@pytest.fixture
def autre_programme(db):
    donnees_reference()
    return Programme.objects.get(nom="PMD")


def creer_evenement(programme, **kw):
    aujourd_hui = timezone.localdate()
    valeurs = dict(
        programme=programme,
        date=aujourd_hui + timedelta(days=30),
        heure_debut=time(18, 0),
        heure_accueil=time(17, 15),
        lieu="Sofitel Abidjan",
        lien_carte="https://maps.example/x",
        capacite=100,
        date_limite_inscription=aujourd_hui + timedelta(days=20),
    )
    valeurs.update(kw)
    return Evenement.objects.create(**valeurs)


@pytest.fixture
def evenement(programme):
    return creer_evenement(programme)


@pytest.fixture
def autre_evenement(autre_programme):
    return creer_evenement(autre_programme)


@pytest.fixture
def super_admin(db):
    return Admin.objects.create_user("sa@mde.ci", "Super Admin", MDP, role=Role.SUPER_ADMIN)


@pytest.fixture
def admin(db, evenement):
    a = Admin.objects.create_user("admin@mde.ci", "Admin Test", MDP)
    evenement.admins.add(a)
    return a


@pytest.fixture
def admin_autre(db, autre_evenement):
    a = Admin.objects.create_user("autre@mde.ci", "Autre Admin", MDP)
    autre_evenement.admins.add(a)
    return a


def client_connecte(user):
    """Client authentifié par cookies JWT réels, avec en-tête CSRF."""
    c = APIClient(enforce_csrf_checks=True)
    c.get("/api/auth/csrf/")  # la connexion exige l'en-tête CSRF, comme le frontend
    c.credentials(HTTP_X_CSRFTOKEN=c.cookies["fc_csrftoken"].value)
    r = c.post("/api/auth/connexion/", {"email": user.email, "motDePasse": MDP}, format="json")
    assert r.status_code == 200, r.content
    c.credentials(HTTP_X_CSRFTOKEN=c.cookies["fc_csrftoken"].value)
    return c


@pytest.fixture
def client_admin(admin):
    return client_connecte(admin)


@pytest.fixture
def client_sa(super_admin):
    return client_connecte(super_admin)


DONNEES = {
    "civilite": "MME",
    "nom": "Kouassi",
    "prenom": "Aya",
    "email": "aya.kouassi@sib.ci",
    "telephone": "07 12 34 56 78",
    "entreprise": "SIB",
    "fonction": "",
    "consentement_donnees": True,
}


def nouvel_invite(evenement, **kw):
    d = {**DONNEES, "telephone": "+225 07 12 34 56 78", **kw}
    return creer_invite(evenement, d, source="FORMULAIRE")


@pytest.fixture(autouse=True)
def _on_commit_immediat(monkeypatch):
    """Dans les tests (transaction englobante), exécuter immédiatement les envois prévus après commit."""
    from apps.noyau import emails

    monkeypatch.setattr(emails.transaction, "on_commit", lambda fn, *a, **k: fn())
