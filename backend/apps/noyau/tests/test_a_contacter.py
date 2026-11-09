"""Suivi des emails : invités à contacter (cause de l'échec, adresse mal tapée, envoi bloqué, invitation absente)."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.noyau import services
from apps.noyau.adresses import suggerer_correction
from apps.noyau.models import Appareil, EmailEnvoye, ModeEmargement, StatutEmail, TypeEmail
from apps.noyau.services import creer_invite
from apps.noyau.suivi_emails import cause_echec

from .conftest import DONNEES, client_connecte, nouvel_invite

pytestmark = pytest.mark.django_db


def a_contacter(client, ev):
    r = client.get(f"/api/evenements/{ev.pk}/suivi-emails/")
    assert r.status_code == 200
    return r.json()["aContacter"]


def dernier(invite, type_email=TypeEmail.INVITATION):
    return EmailEnvoye.objects.filter(invite=invite, type=type_email).latest("cree_le", "pk")


def echouer(invite, erreur, type_email=TypeEmail.INVITATION):
    e = dernier(invite, type_email)
    e.statut, e.erreur, e.tentatives, e.derniere_tentative_le = StatutEmail.ECHEC, erreur, 4, timezone.now()
    e.save()


@pytest.mark.parametrize(
    ("erreur", "code", "cote"),
    [
        (
            "SMTPRecipientsRefused: {'a@x.ci': (550, b'5.1.1 The email account does not exist')}",
            "ADRESSE_INEXISTANTE",
            "adresse",
        ),
        ("SMTPRecipientsRefused: {'a@x.ci': (550, b'5.1.2 Host unknown')}", "DOMAINE_INEXISTANT", "adresse"),
        ("SMTPDataError: (552, b'5.2.2 The recipient mailbox is full')", "BOITE_PLEINE", "adresse"),
        ("SMTPRecipientsRefused: {'a@x.ci': (553, b'relay denied')}", "ADRESSE_REFUSEE", "adresse"),
        ("SMTPAuthenticationError: (535, b'5.7.8 Username and Password not accepted')", "AUTHENTIFICATION", "envoi"),
        ("SMTPSenderRefused: (553, b'sender rejected', 'noreply@mde.ci')", "EXPEDITEUR_REFUSE", "envoi"),
        ("SMTPDataError: (554, b'5.7.1 Message rejected as spam')", "FILTRAGE", "envoi"),
        ("TimeoutError: timed out", "SERVEUR_INJOIGNABLE", "envoi"),
        ("SMTPServerDisconnected: Connection unexpectedly closed", "SERVEUR_INJOIGNABLE", "envoi"),
        # notre côté, même quand le message cite « users », « exist » ou « domain » (revue du 2026-11-09)
        (
            "SMTPDataError: (550, b'5.7.26 This mail has been blocked because the sender is unauthenticated. "
            "To best protect our users from spam, the message has been blocked.')",
            "FILTRAGE",
            "envoi",
        ),
        (
            "SMTPSenderRefused: (553, b'5.1.8 Sender address rejected: Domain does not exist', 'noreply@mde.ci')",
            "EXPEDITEUR_REFUSE",
            "envoi",
        ),
        ("SMTPDataError: (552, b'5.3.4 Message size exceeds fixed maximum message size')", "TAILLE", "envoi"),
        (
            "SMTPRecipientsRefused: {'a@x.ci': (550, b'Recipient address rejected: User unknown in virtual table')}",
            "ADRESSE_INEXISTANTE",
            "adresse",
        ),
        ("ValueError: quelque chose", "INCONNUE", "envoi"),
        ("", "INCONNUE", "envoi"),
    ],
)
def test_cause_de_l_echec(erreur, code, cote):
    assert cause_echec(erreur)[0] == code and cause_echec(erreur)[2] == cote


@pytest.mark.parametrize(
    ("email", "attendu"),
    [
        ("aya@gmial.com", "aya@gmail.com"),
        ("aya@gmail.con", "aya@gmail.com"),
        ("aya@yahoo.fe", "aya@yahoo.fr"),
        ("aya@hotmial.fr", "aya@hotmail.fr"),
        ("aya@gmail.fr", "aya@gmail.com"),
        ("aya@gmail.com", None),
        ("aya@yahoo.com", None),
        ("aya@ymail.com", None),  # vrai domaine proche de gmail.com
        ("aya@orange.ci", None),
        ("aya@sib.ci", None),  # adresse professionnelle
        ("aya@hotmail.con", "aya@hotmail.com"),
        ("aya@outlook.fe", "aya@outlook.fr"),
        ("aya@mde.cii", "aya@mde.ci"),
        # vrais domaines nationaux des fournisseurs (invités de la diaspora) : jamais « corrigés »
        ("aya@hotmail.be", None),
        ("aya@hotmail.de", None),
        ("aya@outlook.es", None),
        ("aya@yahoo.es", None),
        ("aya@yahoo.co.uk", None),
        ("aya@aol.fr", None),
        ("aya@live.be", None),
        ("aya@ide.ci", None),  # autre domaine ivoirien, une lettre de mde.ci
        ("pas-une-adresse", None),
    ],
)
def test_suggestion_de_correction(email, attendu):
    assert suggerer_correction(email) == attendu


def test_tout_va_bien_liste_vide(client_admin, evenement):
    for i in range(3):
        inv = nouvel_invite(evenement, email=f"ok{i}@sib.ci")
        e = dernier(inv)
        e.statut, e.envoye_le = StatutEmail.ENVOYE, timezone.now()
        e.save()
    assert a_contacter(client_admin, evenement) == {"total": 0, "causesEnvoi": 0, "invites": []}


def test_adresse_inexistante_a_corriger_avec_telephone(client_admin, evenement):
    inv = nouvel_invite(evenement, email="aya@sib.ci")
    echouer(inv, "SMTPRecipientsRefused: {'aya@sib.ci': (550, b'5.1.1 user unknown')}")
    d = a_contacter(client_admin, evenement)
    assert d["total"] == 1 and d["causesEnvoi"] == 0
    ligne = d["invites"][0]
    assert ligne["inviteId"] == inv.pk and ligne["action"] == "CORRIGER"
    assert ligne["telephone"] == "+225 07 12 34 56 78" and ligne["suggestion"] is None
    assert ligne["problemes"][0]["libelle"] == "Adresse inexistante" and ligne["problemes"][0]["type"] == "INVITATION"


def test_echec_cote_serveur_a_renvoyer_et_compte(client_admin, evenement):
    for i in range(2):
        echouer(nouvel_invite(evenement, email=f"i{i}@sib.ci"), "SMTPAuthenticationError: (535, b'refused')")
    d = a_contacter(client_admin, evenement)
    assert d["total"] == 2 and d["causesEnvoi"] == 2


def test_causes_envoi_compte_les_invites_pas_les_problemes(client_admin, evenement):
    inv = nouvel_invite(evenement, email="un@sib.ci")
    echouer(inv, "TimeoutError: timed out")
    bloque = nouvel_invite(evenement, email="bloque@sib.ci")
    EmailEnvoye.objects.filter(pk=dernier(bloque).pk).update(
        statut=StatutEmail.EN_ATTENTE, cree_le=timezone.now() - timedelta(minutes=30)
    )
    d = a_contacter(client_admin, evenement)
    assert d["causesEnvoi"] == 2  # un échec réseau + un envoi bloqué, deux invités
    assert {x["action"] for x in d["invites"]} == {"RENVOYER"}


def test_adresse_mal_tapee_meme_si_envoyee(client_admin, evenement):
    # le serveur d'envoi accepte « gmial.com » puis abandonne : l'application voit « envoyé »
    inv = nouvel_invite(evenement, email="aya@gmial.com")
    e = dernier(inv)
    e.statut, e.envoye_le = StatutEmail.ENVOYE, timezone.now()
    e.save()
    ligne = a_contacter(client_admin, evenement)["invites"][0]
    assert ligne["suggestion"] == "aya@gmail.com" and ligne["action"] == "CORRIGER"
    assert ligne["problemes"][0]["code"] == "ADRESSE_DOUTEUSE"


def test_invitation_jamais_envoyee_et_envoi_bloque(client_admin, evenement, admin):
    # ajout manuel « sans envoyer l'invitation » : choix de l'admin (journal), pas un problème à signaler
    voulu = creer_invite(
        evenement,
        {**DONNEES, "email": "voulu@sib.ci", "telephone": "+225 07 00 00 00 02"},
        source="MANUEL",
        auteur=admin,
        envoyer_invitation=False,
    )
    sans = creer_invite(
        evenement,
        {**DONNEES, "email": "sans@sib.ci", "telephone": "+225 07 00 00 00 01"},
        source="MANUEL",
        envoyer_invitation=False,
    )
    bloque = nouvel_invite(evenement, email="bloque@sib.ci")
    EmailEnvoye.objects.filter(pk=dernier(bloque).pk).update(
        statut=StatutEmail.EN_ATTENTE, cree_le=timezone.now() - timedelta(minutes=30)
    )
    recent = nouvel_invite(evenement, email="recent@sib.ci")  # en attente depuis peu : normal
    EmailEnvoye.objects.filter(pk=dernier(recent).pk).update(statut=StatutEmail.EN_ATTENTE)
    lignes = {x["inviteId"]: x for x in a_contacter(client_admin, evenement)["invites"]}
    assert lignes[sans.pk]["problemes"][0]["code"] == "JAMAIS_ENVOYE" and lignes[sans.pk]["action"] == "RENVOYER"
    assert lignes[bloque.pk]["problemes"][0]["code"] == "BLOQUE"
    assert recent.pk not in lignes
    assert voulu.pk not in lignes


def test_magazine_en_echec_seulement_pour_un_present(client_admin, evenement, admin):
    evenement.programme.magazine_actif, evenement.programme.lien_magazine = True, "https://mag.example"
    evenement.programme.save()
    inv = nouvel_invite(evenement, email="mag@sib.ci")
    e = dernier(inv)
    e.statut = StatutEmail.ENVOYE
    e.save()
    services.emarger(evenement, admin, invite_id=inv.pk, mode=ModeEmargement.MANUEL, appareil=Appareil.ORDINATEUR)
    echouer(inv, "TimeoutError: timed out", TypeEmail.MAGAZINE)
    ligne = a_contacter(client_admin, evenement)["invites"][0]
    assert ligne["problemes"][0]["type"] == "MAGAZINE" and ligne["statut"] == "PRESENT"


def test_a_corriger_en_premier_puis_par_nom(client_admin, evenement):
    echouer(nouvel_invite(evenement, email="b@sib.ci", nom="Bamba"), "TimeoutError: timed out")
    echouer(nouvel_invite(evenement, email="z@sib.ci", nom="Zadi"), "SMTPRecipientsRefused: 550 5.1.1 user unknown")
    actions = [x["action"] for x in a_contacter(client_admin, evenement)["invites"]]
    assert actions == ["CORRIGER", "RENVOYER"]


def test_reserve_aux_admins_de_la_ceremonie(evenement, admin_autre):
    assert client_connecte(admin_autre).get(f"/api/evenements/{evenement.pk}/suivi-emails/").status_code in (403, 404)
