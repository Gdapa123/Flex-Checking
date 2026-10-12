from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from apps.noyau.models import EmailEnvoye, Invite, StatutEmail
from apps.noyau.services import tirer_code

from .conftest import DONNEES, creer_evenement, nouvel_invite

pytestmark = pytest.mark.django_db


def url(ev, suffixe=""):
    return f"/api/public/evenements/{ev.slug_inscription}/{suffixe}"


def payload(**kw):
    d = {
        "civilite": "MME",
        "nom": "Kouassi",
        "prenom": "Aya",
        "email": "aya.kouassi@sib.ci",
        "telephone": "07 12 34 56 78",
        "fonction": "Directrice financière",
        "entreprise": "SIB",
        "consentementDonnees": True,
    }
    d.update(kw)
    return d


def test_infos_publiques(client, evenement):
    r = client.get(url(evenement))
    assert r.status_code == 200
    d = r.json()
    assert d["nomAffiche"] == f"Graduation AMP {evenement.date.year}"
    assert d["etat"] == "OUVERT"
    assert d["tokens"]["p"] == "#8F1C1F"


def test_lien_invalide(client, db):
    assert client.get("/api/public/evenements/inexistant/").status_code == 404


def test_inscription_reussie_envoie_email_1(client, evenement):
    r = client.post(url(evenement, "inscription/"), payload(), content_type="application/json")
    assert r.status_code == 201, r.content
    inv = Invite.objects.get()
    assert inv.statut.code == "INSCRIT"
    assert len(inv.code) == 4 and inv.code.isdigit()
    assert len(inv.qr_token) >= 32
    assert inv.telephone == "+225 07 12 34 56 78"
    assert inv.consentement_le is not None
    assert EmailEnvoye.objects.get(invite=inv).statut == StatutEmail.ENVOYE
    assert len(mail.outbox) == 1
    m = mail.outbox[0]
    assert m.to == ["aya.kouassi@sib.ci"]
    assert "Flex’Checking · MDE Business School" in m.from_email
    assert m.subject == f"Votre invitation · Graduation AMP {evenement.date.year}"
    noms = [a[0] for a in m.attachments]
    assert "qr-code.png" in noms and "graduation.ics" in noms
    html = m.alternatives[0][0]
    assert "cid:qr" in html and inv.code in html
    # le QR n'encode que le jeton : aucune donnée personnelle dans le corps texte de l'ics
    ics = next(a[1] for a in m.attachments if a[0] == "graduation.ics")
    assert "aya" not in (ics.decode() if isinstance(ics, bytes) else ics).lower()


@pytest.mark.parametrize(
    "modif,code",
    [
        ({"inscriptions_ouvertes": False}, "FERME"),
        ({"capacite": 1}, "COMPLET"),
    ],
)
def test_refus_etat(client, programme, modif, code):
    ev = creer_evenement(programme, **modif)
    if code == "COMPLET":
        nouvel_invite(ev, email="deja@sib.ci")
    r = client.post(url(ev, "inscription/"), payload(), content_type="application/json")
    assert r.status_code == 409 and r.json()["code"] == code


def test_refus_date_limite(client, programme):
    hier = timezone.localdate() - timedelta(days=1)
    ev = creer_evenement(programme, date_limite_inscription=hier, date=timezone.localdate() + timedelta(days=3))
    r = client.post(url(ev, "inscription/"), payload(), content_type="application/json")
    assert r.json()["code"] == "DATE_LIMITE"


def test_refus_deja_inscrit(client, evenement):
    nouvel_invite(evenement)
    r = client.post(
        url(evenement, "inscription/"), payload(email="AYA.Kouassi@sib.ci"), content_type="application/json"
    )
    assert r.status_code == 409 and r.json()["code"] == "DEJA_INSCRIT"


def test_refus_sans_consentement(client, evenement):
    r = client.post(url(evenement, "inscription/"), payload(consentementDonnees=False), content_type="application/json")
    assert r.status_code == 400 and r.json()["code"] == "CONSENTEMENT"


def test_validation_champs(client, evenement):
    r = client.post(
        url(evenement, "inscription/"),
        payload(email="aya@orange", telephone="07 12 34", nom="K"),
        content_type="application/json",
    )
    assert r.status_code == 400
    d = r.json()
    assert set(d) >= {"email", "telephone", "nom"}


def test_renvoi_reponse_identique_et_limite(client, evenement):
    nouvel_invite(evenement)
    mail.outbox.clear()
    r1 = client.post(url(evenement, "renvoi-qr/"), {"email": DONNEES["email"]}, content_type="application/json")
    r2 = client.post(url(evenement, "renvoi-qr/"), {"email": "inconnu@sib.ci"}, content_type="application/json")
    assert r1.status_code == r2.status_code == 202
    assert r1.json() == r2.json()
    assert len(mail.outbox) == 1
    for _ in range(2):
        client.post(url(evenement, "renvoi-qr/"), {"email": DONNEES["email"]}, content_type="application/json")
    r = client.post(url(evenement, "renvoi-qr/"), {"email": DONNEES["email"]}, content_type="application/json")
    assert r.status_code == 429


def test_unicite_des_codes(evenement):
    codes = {nouvel_invite(evenement, email=f"x{i}@sib.ci").code for i in range(150)}
    assert len(codes) == 150
    assert tirer_code(evenement) not in codes


def test_agenda_ics(client, evenement):
    r = client.get(url(evenement, "agenda.ics"))
    assert r.status_code == 200 and r["Content-Type"].startswith("text/calendar")
    assert b"BEGIN:VEVENT" in r.content
    assert f"/i/{evenement.slug_inscription}/pratique#itineraire".encode() in r.content


def test_infos_agenda_publiques(client, evenement):
    """Bornes UTC pour Google Agenda / Outlook : accueil 17:15, fin = lancement 18:00 + 3 h (Abidjan = UTC)."""
    agenda = client.get(url(evenement)).json()["agenda"]
    jour = evenement.date.strftime("%Y-%m-%d")
    assert agenda["debut"] == f"{jour}T17:15:00Z"
    assert agenda["fin"] == f"{jour}T21:00:00Z"
    assert "Itinéraire" in agenda["description"]


@pytest.mark.parametrize(
    "champ,message", [("entreprise", "Indiquez votre entreprise."), ("fonction", "Indiquez votre fonction.")]
)
def test_entreprise_et_fonction_obligatoires(client, evenement, champ, message):
    for valeur in (None, "", " "):
        corps = payload(**{champ: valeur}) if valeur is not None else {k: v for k, v in payload().items() if k != champ}
        r = client.post(url(evenement, "inscription/"), corps, content_type="application/json")
        assert r.status_code == 400 and r.json()[champ] == [message], (valeur, r.content)
