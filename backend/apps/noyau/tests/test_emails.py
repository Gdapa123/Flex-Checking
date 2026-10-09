import pytest
from django.core import mail

from apps.noyau.emails import Source, planifier, rendre
from apps.noyau.models import EmailEnvoye, StatutEmail, TypeEmail

from .conftest import nouvel_invite

pytestmark = pytest.mark.django_db


class BackendEnPanne:
    def __init__(self, *a, **k):
        pass

    def send_messages(self, messages):
        raise ConnectionRefusedError("SMTP indisponible")

    def open(self):
        pass

    def close(self):
        pass


def test_echec_apres_trois_relances(evenement, settings):
    inv = nouvel_invite(evenement)
    settings.EMAIL_BACKEND = "apps.noyau.tests.test_emails.BackendEnPanne"
    e = planifier(inv, TypeEmail.INVITATION)
    e.refresh_from_db()
    assert e.statut == StatutEmail.ECHEC
    assert e.tentatives == 4  # 1 envoi + 3 nouvelles tentatives
    assert "SMTP indisponible" in e.erreur


def test_rendu_variables_et_echappement(evenement):
    inv = nouvel_invite(evenement, prenom="<b>Aya</b>")
    r = rendre(TypeEmail.INVITATION, Source.depuis_invite(inv))
    assert "&lt;b&gt;Aya&lt;/b&gt;" in r["html"]
    assert "{" not in r["objet"]
    assert inv.code in r["texte"]
    assert "max-width:600px" in r["html"].replace(" ", "")


def test_magazine_contient_lien_en_clair(evenement):
    inv = nouvel_invite(evenement)
    r = rendre(TypeEmail.MAGAZINE, Source.depuis_invite(inv))
    assert "Lire le magazine" in r["html"] and "https://mde.ci/magazine/amp" in r["html"]
    assert r["pieces_jointes"] == []


def test_envoi_ok(evenement):
    inv = nouvel_invite(evenement)
    e = EmailEnvoye.objects.get(invite=inv)
    assert e.statut == StatutEmail.ENVOYE and e.envoye_le and len(mail.outbox) == 1
