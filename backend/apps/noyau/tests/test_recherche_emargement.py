"""Recherche de l'émargement manuel (17/11/2026 : invités présents en base mais introuvables) et suites de l'audit."""

import pytest
from django.utils import timezone

from apps.noyau.emails import planifier
from apps.noyau.filtres import mots_recherche
from apps.noyau.models import EmailEnvoye, StatutEmail, TypeEmail
from apps.noyau.tasks import envoyer_email

from .conftest import nouvel_invite
from .test_audit_securite import borne  # noqa: F401 — fixture

pytestmark = pytest.mark.django_db


def url(ev):
    return f"/api/evenements/{ev.pk}/invites/"


@pytest.mark.parametrize(
    "q,attendu",
    [
        ("N’Guessan Marie", ["N", "Guessan", "Marie"]),  # apostrophe typographique (clavier iPhone)
        ("Mme Koné", ["Koné"]),  # civilité ignorée
        ("M. Jean-Marc KOUASSI", ["Jean", "Marc", "KOUASSI"]),  # tiret
        ("Mme", ["Mme"]),  # seule : conservée
        ("jean.kone@sib.ci", ["jean.kone@sib.ci"]),  # le point n'est pas un séparateur
    ],
)
def test_mots_recherche(q, attendu):
    assert mots_recherche(q) == attendu


@pytest.fixture
def invites_noms_composes(evenement):
    a = nouvel_invite(evenement, email="m@sib.ci", nom="N'Guessan", prenom="Marie", civilite="MME")
    b = nouvel_invite(evenement, email="j@sib.ci", nom="Kouadio", prenom="Jean-Marc", civilite="M")
    c = nouvel_invite(evenement, email="k@sib.ci", nom="N’Dri", prenom="Koffi", civilite="M")  # saisi avec ’
    return a, b, c


@pytest.mark.parametrize(
    "q,indice",
    [
        ("N’Guessan", 0),  # typographique → droite en base
        ("Nguessan Marie", None),  # sans apostrophe : non trouvé (documenté, pas de recherche approchée)
        ("Guessan", 0),
        ("Mme N'Guessan", 0),  # civilité tapée avec le nom
        ("Jean Marc Kouadio", 1),  # espace → tiret en base
        ("Jean-Marc", 1),
        ("N'Dri Koffi", 2),  # droite → typographique en base
    ],
)
def test_recherche_noms_composes(client_admin, evenement, invites_noms_composes, q, indice):
    d = client_admin.get(url(evenement), {"q": q, "taille": 100}).json()
    ids = [r["id"] for r in d["resultats"]]
    if indice is None:
        assert ids == []
    else:
        assert ids == [invites_noms_composes[indice].pk], q


def test_recherche_borne_noms_composes(borne, evenement, invites_noms_composes):  # noqa: F811
    base = f"/api/evenements/{evenement.pk}/borne/recherche/"
    assert borne.get(base, {"q": "N’Guessan"}).json()["total"] == 1
    assert borne.get(base, {"q": "Mme Guessan"}).json()["total"] == 1
    assert borne.get(base, {"q": "Jean Marc"}).json()["total"] == 1  # espace → tiret en base
    assert borne.get(base, {"q": "Jean-Marc Kouadio"}).json()["total"] == 1


def test_recherche_plus_de_25_resultats(client_admin, evenement):
    # nom courant : l'écran de scan demande 100 résultats et signale s'il y en a davantage
    for i in range(30):
        nouvel_invite(evenement, email=f"k{i}@sib.ci", prenom=f"Aya{i:02d}", nom="Kouassi")
    d = client_admin.get(url(evenement), {"q": "kouassi", "taille": 100, "tri": "nom"}).json()
    assert d["total"] == 30 and len(d["resultats"]) == 30


def test_resultat_emargement_avec_fonction(client_admin, evenement):
    inv = nouvel_invite(evenement, fonction="Directrice financière", entreprise="SIB")
    corps = {"qrToken": inv.qr_token, "mode": "QR_CAMERA", "poste": "Accueil", "appareil": "TELEPHONE"}
    d = client_admin.post(f"/api/evenements/{evenement.pk}/emargement/", corps, format="json").json()
    assert d["invite"]["fonction"] == "Directrice financière"
    assert d["invite"]["entreprise"] == "SIB"


def test_magazine_non_envoye_si_presence_annulee_avant_envoi(evenement, monkeypatch):
    inv = nouvel_invite(evenement)
    # email n°2 en file (débit limité), puis présence annulée avant son tour
    monkeypatch.setattr("apps.noyau.emails._lancer", lambda *a, **k: None)
    email = planifier(inv, TypeEmail.MAGAZINE)
    assert inv.statut.code != "PRESENT"
    envoyer_email(email.pk)
    email.refresh_from_db()
    assert email.statut == StatutEmail.ECHEC and "annulée" in email.erreur


def test_renvoi_d_un_email_deja_en_file_le_relance_sans_doublon(client_admin, evenement, monkeypatch):
    inv = nouvel_invite(evenement)
    EmailEnvoye.objects.filter(invite=inv).update(statut=StatutEmail.ENVOYE, envoye_le=timezone.now())
    lances = []
    monkeypatch.setattr("apps.noyau.emails._lancer", lambda tache, email_id: lances.append(email_id))
    chemin = f"/api/invites/{inv.pk}/renvoi-email/"
    assert client_admin.post(chemin, {"type": "INVITATION"}, format="json").status_code == 202
    en_file = EmailEnvoye.objects.get(invite=inv, statut=StatutEmail.EN_ATTENTE)
    # second clic (adresse corrigée, nouvel essai prévu dans 30 min) : l'envoi en file est relancé, pas dupliqué
    r = client_admin.post(chemin, {"type": "INVITATION"}, format="json")
    assert r.status_code == 202
    assert EmailEnvoye.objects.filter(invite=inv, statut=StatutEmail.EN_ATTENTE).count() == 1
    assert lances == [en_file.pk, en_file.pk]


def test_renvoi_groupe_ignore_une_invitation_encore_en_file(client_admin, evenement, monkeypatch):
    from datetime import timedelta

    inv = nouvel_invite(evenement)
    # invitation créée il y a 2 h mais toujours en file (débit limité, nouvel essai programmé)
    EmailEnvoye.objects.filter(invite=inv).update(
        statut=StatutEmail.EN_ATTENTE, cree_le=timezone.now() - timedelta(hours=2)
    )
    monkeypatch.setattr("apps.noyau.emails._lancer", lambda *a, **k: None)
    r = client_admin.post(
        f"/api/evenements/{evenement.pk}/invites/actions-groupees/",
        {"action": "RENVOYER", "ids": [inv.pk]},
        format="json",
    ).json()
    assert r == {"traites": 0, "ignores": 1}
    assert EmailEnvoye.objects.filter(invite=inv).count() == 1


def test_renvoi_groupe_remet_en_file_une_invitation_perdue(client_admin, evenement, monkeypatch):
    from datetime import timedelta

    inv = nouvel_invite(evenement)
    # jamais tentée depuis 3 h (message perdu, Redis redémarré) : remise en file, sans nouvel email
    EmailEnvoye.objects.filter(invite=inv).update(
        statut=StatutEmail.EN_ATTENTE, tentatives=0, cree_le=timezone.now() - timedelta(hours=3)
    )
    lances = []
    monkeypatch.setattr("apps.noyau.emails._lancer", lambda tache, email_id: lances.append(email_id))
    r = client_admin.post(
        f"/api/evenements/{evenement.pk}/invites/actions-groupees/",
        {"action": "RENVOYER", "ids": [inv.pk]},
        format="json",
    ).json()
    assert r == {"traites": 1, "ignores": 0}
    assert EmailEnvoye.objects.filter(invite=inv).count() == 1
    assert lances == [EmailEnvoye.objects.get(invite=inv).pk]


def test_renvoi_individuel_pendant_un_nouvel_essai_ne_cree_pas_de_seconde_chaine(client_admin, evenement, monkeypatch):
    inv = nouvel_invite(evenement)
    # déjà tenté une fois, nouvel essai programmé : ni nouvel email, ni nouvelle tâche
    EmailEnvoye.objects.filter(invite=inv).update(statut=StatutEmail.EN_ATTENTE, tentatives=1)
    lances = []
    monkeypatch.setattr("apps.noyau.emails._lancer", lambda tache, email_id: lances.append(email_id))
    r = client_admin.post(f"/api/invites/{inv.pk}/renvoi-email/", {"type": "INVITATION"}, format="json")
    assert r.status_code == 202 and "Nouvel essai déjà programmé" in r.json()["detail"]
    assert lances == [] and EmailEnvoye.objects.filter(invite=inv).count() == 1
