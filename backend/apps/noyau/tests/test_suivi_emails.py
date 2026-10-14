"""Écran « Suivi des emails » : compteurs, renvoi groupé des échecs, email de test."""

import pytest
from django.core import mail

from apps.noyau import services
from apps.noyau.models import Appareil, EmailEnvoye, JournalActivite, ModeEmargement, StatutEmail, TypeEmail

from .conftest import client_connecte, nouvel_invite

pytestmark = pytest.mark.django_db


def url(ev, suffixe=""):
    return f"/api/evenements/{ev.pk}/suivi-emails/{suffixe}"


def mettre_en_echec(invite, type_email=TypeEmail.INVITATION):
    e = EmailEnvoye.objects.filter(invite=invite, type=type_email).latest("cree_le", "pk")
    e.statut, e.erreur, e.tentatives = StatutEmail.ECHEC, "SMTPRecipientsRefused: 550", 4
    e.save()


def emarger(ev, admin, invite):
    services.emarger(
        ev, admin, invite_id=invite.pk, mode=ModeEmargement.MANUEL, appareil=Appareil.ORDINATEUR, poste="Test"
    )


def test_suivi_compte_et_liste_les_echecs(evenement, client_admin):
    ok = nouvel_invite(evenement)
    ko = nouvel_invite(evenement, email="ko@exemple.ci")
    mettre_en_echec(ko)
    r = client_admin.get(url(evenement))
    assert r.status_code == 200
    inv = r.json()["INVITATION"]
    assert (inv["envoyes"], inv["attente"], inv["echecs"]) == (1, 0, 1)
    assert inv["listeEchecs"][0]["inviteId"] == ko.pk
    assert inv["listeEchecs"][0]["email"] == "ko@exemple.ci"
    assert "550" in inv["listeEchecs"][0]["erreur"]
    assert r.json()["MAGAZINE"]["actif"] is True
    assert ok.pk not in [e["inviteId"] for e in inv["listeEchecs"]]


def test_suivi_reserve_aux_admins_de_la_ceremonie(autre_evenement, client_admin):
    assert client_admin.get(url(autre_evenement)).status_code == 404
    assert client_admin.post(url(autre_evenement, "test/"), {"type": "INVITATION"}, format="json").status_code == 404


def test_renvoyer_echecs_replanifie_seulement_les_echecs(evenement, client_admin):
    nouvel_invite(evenement)
    ko = nouvel_invite(evenement, email="ko@exemple.ci")
    mettre_en_echec(ko)
    mail.outbox.clear()
    r = client_admin.post(url(evenement, "renvoyer-echecs/"), {"type": "INVITATION"}, format="json")
    assert r.status_code == 200 and r.json() == {"traites": 1}
    assert [m.to for m in mail.outbox] == [["ko@exemple.ci"]]
    assert client_admin.get(url(evenement)).json()["INVITATION"]["echecs"] == 0
    assert JournalActivite.objects.filter(action="EMAIL_RENVOI", details__nb=1).exists()


def test_renvoyer_magazine_ignore_les_invites_plus_presents(evenement, admin, client_admin):
    present = nouvel_invite(evenement)
    annule = nouvel_invite(evenement, email="annule@exemple.ci")
    for inv in (present, annule):
        emarger(evenement, admin, inv)
        mettre_en_echec(inv, TypeEmail.MAGAZINE)
    emargement = annule.emargements.get()
    services.annuler_emargement(emargement, admin)
    r = client_admin.post(url(evenement, "renvoyer-echecs/"), {"type": "MAGAZINE"}, format="json")
    assert r.json() == {"traites": 1}


def test_magazine_desactive_refuse(evenement, client_admin):
    evenement.programme.magazine_actif = False
    evenement.programme.save()
    assert client_admin.get(url(evenement)).json()["MAGAZINE"]["actif"] is False
    for suffixe in ("renvoyer-echecs/", "test/"):
        r = client_admin.post(url(evenement, suffixe), {"type": "MAGAZINE"}, format="json")
        assert r.status_code == 409


def test_email_de_test_envoye_au_compte_connecte(evenement, admin, client_admin):
    mail.outbox.clear()
    r = client_admin.post(url(evenement, "test/"), {"type": "INVITATION"}, format="json")
    assert r.status_code == 200 and r.json() == {"destinataire": admin.email}
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [admin.email]
    assert mail.outbox[0].subject.startswith("[Test] ")
    assert not EmailEnvoye.objects.exists()  # aucun envoi d'invité créé
    assert JournalActivite.objects.filter(action="EMAIL_TEST").exists()


def test_email_de_test_smtp_indisponible(evenement, client_admin, settings):
    settings.EMAIL_BACKEND = "apps.noyau.tests.test_emails.BackendEnPanne"
    r = client_admin.post(url(evenement, "test/"), {"type": "INVITATION"}, format="json")
    assert r.status_code == 502
    assert r.json()["code"] == "ENVOI_IMPOSSIBLE"


def test_type_invalide(evenement, client_admin):
    r = client_admin.post(url(evenement, "test/"), {"type": "AUTRE"}, format="json")
    assert r.status_code == 400


def test_super_admin_a_acces(evenement, super_admin):
    assert client_connecte(super_admin).get(url(evenement)).status_code == 200
