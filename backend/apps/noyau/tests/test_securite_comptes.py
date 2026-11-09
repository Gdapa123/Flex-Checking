"""Journalisation des échecs de connexion, alertes aux super admins, mots de passe compromis (ASVS 2.1.7, 7.2)."""

import hashlib
import logging
import urllib.error

import pytest
from django.core import mail
from rest_framework.test import APIClient

from apps.comptes import validateurs
from apps.comptes.throttles import ECHECS_CONNEXION_PAR_COMPTE, CacheDeSecours, cle_echecs_connexion
from apps.noyau.erreurs import enregistrer
from apps.noyau.models import ErreurTechnique, JournalActivite, SourceErreur

from .conftest import MDP, client_connecte

pytestmark = pytest.mark.django_db


def tentative(email, mot_de_passe="Mauvais-Mdp-2026"):
    c = APIClient(enforce_csrf_checks=True)
    c.get("/api/auth/csrf/")
    c.credentials(HTTP_X_CSRFTOKEN=c.cookies["fc_csrftoken"].value)
    return c.post("/api/auth/connexion/", {"email": email, "motDePasse": mot_de_passe}, format="json")


# ---------------------------------------------------------------- échecs de connexion
def test_echec_journalise_sans_email(admin, client_sa, caplog):
    caplog.set_level(logging.WARNING, logger="securite")
    assert tentative(admin.email).status_code == 401
    e = JournalActivite.objects.get(action="CONNEXION_ECHEC")
    assert e.auteur is None and e.cible_id == admin.pk and e.details["raison"] == "mot_de_passe"
    assert admin.email not in str(e.details)
    assert "Connexion refusée : mot_de_passe" in caplog.text and admin.email not in caplog.text
    entrees = client_sa.get("/api/journal/").json()["resultats"]
    echec = next(x for x in entrees if x["action"] == "CONNEXION_ECHEC")
    assert echec["detail"] == "Connexion refusée · Admin Test · mot de passe incorrect"
    assert echec["auteurNom"] == "Tentative de connexion" and echec["categorie"] == "Compte"


def test_echec_sur_compte_inconnu_seulement_dans_le_journal_de_securite(db, caplog):
    caplog.set_level(logging.WARNING, logger="securite")
    assert tentative("personne@mde.ci").status_code == 401
    assert not JournalActivite.objects.filter(action="CONNEXION_ECHEC").exists()
    assert "compte inconnu" in caplog.text and "personne@mde.ci" not in caplog.text


def test_echec_sur_compte_desactive(admin):
    admin.actif = False
    admin.save(update_fields=["actif"])
    assert tentative(admin.email, MDP).status_code == 401
    assert JournalActivite.objects.get(action="CONNEXION_ECHEC").details["raison"] == "compte_inactif"


def test_blocage_journalise_et_alerte_une_seule_fois(admin, super_admin, django_capture_on_commit_callbacks):
    CacheDeSecours().set(cle_echecs_connexion(admin.email), ECHECS_CONNEXION_PAR_COMPTE, 3600)
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        assert tentative(admin.email).status_code == 429
        assert tentative(admin.email).status_code == 429  # suite de la série : ni nouveau journal, ni nouvel email
    assert JournalActivite.objects.filter(action="CONNEXION_BLOQUEE", cible_id=admin.pk).count() == 1
    assert len(mail.outbox) == 1
    alerte = mail.outbox[0]
    assert alerte.to == [super_admin.email] and "Connexion bloquée : Admin Test" in alerte.subject
    assert "réinitialisez le mot de passe" in alerte.body


# ---------------------------------------------------------------- alertes sur les erreurs
def test_nouvelle_erreur_serveur_alerte_une_fois(super_admin, django_capture_on_commit_callbacks):
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        enregistrer(SourceErreur.SERVEUR, "ValueError", "boom aya@exemple.ci", lieu="/api/x/")
        enregistrer(SourceErreur.SERVEUR, "ValueError", "boom aya@exemple.ci", lieu="/api/x/")  # même erreur
        enregistrer(SourceErreur.NAVIGATEUR, "TypeError", "x", lieu="/scan")  # signalement public : jamais
    assert len(mail.outbox) == 1
    assert "Nouvelle erreur (serveur)" in mail.outbox[0].subject
    assert "aya@exemple.ci" not in mail.outbox[0].body and "[email]" in mail.outbox[0].body


def test_alerte_en_echec_sans_boucle_d_erreurs(super_admin, settings, django_capture_on_commit_callbacks):
    # SMTP en panne : l'alerte échoue en silence (journalisée), sans créer d'erreur technique qui relancerait une alerte
    settings.EMAIL_BACKEND = "apps.noyau.tests.test_emails.BackendEnPanne"
    with django_capture_on_commit_callbacks(execute=True):
        enregistrer(SourceErreur.TACHE, "RuntimeError", "panne", lieu="tache")
    assert ErreurTechnique.objects.count() == 1


def test_plafond_horaire_des_alertes(super_admin, django_capture_on_commit_callbacks):
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        for i in range(15):
            enregistrer(SourceErreur.SERVEUR, "ValueError", f"erreur distincte {'x' * i}", lieu=f"/api/{'y' * i}/")
    assert len(mail.outbox) == 10


# ---------------------------------------------------------------- mots de passe compromis
class ReponsePwned:
    def __init__(self, corps):
        self.corps = corps

    def read(self):
        return self.corps.encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture
def pwned(settings, monkeypatch):
    settings.VERIFIER_MOTS_DE_PASSE_FUITES = True
    appels = []

    def installer(compromis=(), erreur=None):
        def urlopen(requete, timeout):
            appels.append((requete.full_url, dict(requete.header_items()), timeout))
            if erreur:
                raise erreur
            lignes = ["0000000000000000000000000000000000A:0"]  # remplissage, comme l'API
            for mdp in compromis:
                lignes.append(hashlib.sha1(mdp.encode()).hexdigest().upper()[5:] + ":42")
            return ReponsePwned("\r\n".join(lignes))

        monkeypatch.setattr(validateurs.urllib.request, "urlopen", urlopen)
        return appels

    return installer


def changer(client, nouveau):
    return client.post("/api/auth/mot-de-passe/", {"actuel": MDP, "nouveau": nouveau}, format="json")


def test_mot_de_passe_compromis_refuse(admin, pwned):
    appels = pwned(compromis=["Fuite-Connue-2026"])
    r = changer(client_connecte(admin), "Fuite-Connue-2026")
    assert r.status_code == 400 and "fuites de données" in str(r.json())
    # k-anonymat : seuls les 5 premiers caractères de l'empreinte partent, jamais le mot de passe ni l'empreinte entière
    empreinte = hashlib.sha1(b"Fuite-Connue-2026").hexdigest().upper()
    url, entetes, delai = appels[0]
    assert url == validateurs.URL_PWNED + empreinte[:5]
    assert empreinte[5:] not in url and "Fuite" not in url
    assert entetes.get("Add-padding") == "true" and delai == validateurs.DELAI_S


def test_mot_de_passe_sain_accepte(admin, pwned):
    pwned(compromis=["Autre-Mot-De-Passe"])
    assert changer(client_connecte(admin), "Sain-Et-Unique-2026!").status_code == 204


def test_service_indisponible_n_empeche_pas_de_changer(admin, pwned, caplog):
    caplog.set_level(logging.WARNING, logger="securite")
    pwned(erreur=urllib.error.URLError("hors ligne"))
    assert changer(client_connecte(admin), "Sain-Et-Unique-2026!").status_code == 204
    assert "Vérification des fuites de mots de passe indisponible" in caplog.text
