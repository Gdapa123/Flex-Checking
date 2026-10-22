"""Protection des données personnelles : conservation limitée (anonymisation), page de confidentialité, réglages."""

from datetime import date, timedelta

import pytest
from django.core import mail
from django.utils import timezone

from apps.noyau.donnees_personnelles import anonymiser_donnees_expirees, anonymiser_evenement, mois_avant
from apps.noyau.models import EmailEnvoye, Evenement, Invite, JournalActivite, Parametres, StatutEmail

from .conftest import creer_evenement, nouvel_invite

pytestmark = pytest.mark.django_db


def test_mois_avant():
    assert mois_avant(date(2026, 10, 22), 12) == date(2025, 10, 22)
    assert mois_avant(date(2026, 3, 31), 1) == date(2026, 2, 28)
    assert mois_avant(date(2026, 1, 15), 1) == date(2025, 12, 15)


def _ceremonie_passee(programme, jours):
    jour = timezone.localdate() - timedelta(days=jours)
    return creer_evenement(programme, date=jour, date_limite_inscription=jour - timedelta(days=5))


def test_anonymisation_apres_la_duree_de_conservation(programme):
    p = Parametres.charger()
    p.duree_conservation_mois = 12
    p.save()
    ancienne = _ceremonie_passee(programme, 400)
    recente = _ceremonie_passee(programme, 100)
    inv = Invite.objects.create(
        evenement=ancienne,
        civilite="MME",
        nom="Kouassi",
        prenom="Aya",
        email="aya@sib.ci",
        telephone="0712345678",
        entreprise="SIB",
        fonction="DAF",
        code="1234",
        inscrit_le=timezone.now() - timedelta(days=420),
    )
    ancien_qr = inv.qr_token
    EmailEnvoye.objects.create(invite=inv, type="INVITATION", statut=StatutEmail.ECHEC, erreur="550 aya@sib.ci inconnu")
    garde = Invite.objects.create(
        evenement=recente,
        civilite="M",
        nom="Konan",
        prenom="Yao",
        email="yao@sib.ci",
        telephone="0701020304",
        code="5678",
        inscrit_le=timezone.now() - timedelta(days=120),
    )

    assert anonymiser_donnees_expirees() == {"evenements": 1, "invites": 1}
    inv.refresh_from_db()
    assert (inv.nom, inv.prenom, inv.telephone, inv.entreprise, inv.fonction) == ("Anonyme", "", "", "", "")
    assert inv.email.endswith("@anonyme.invalid") and "aya" not in inv.email
    assert inv.qr_token != ancien_qr and inv.code == "1234"
    assert EmailEnvoye.objects.get(invite=inv).erreur == ""
    assert Evenement.objects.get(pk=ancienne.pk).anonymise_le is not None
    assert JournalActivite.objects.filter(action="DONNEES_ANONYMISATION", cible_id=ancienne.pk).count() == 1
    garde.refresh_from_db()
    assert garde.nom == "Konan" and garde.email == "yao@sib.ci"
    # idempotent : une seconde passe ne refait rien
    assert anonymiser_donnees_expirees() == {"evenements": 0, "invites": 0}
    assert anonymiser_evenement(ancienne) == 0


def test_duree_de_conservation_reglable(programme, client_sa):
    ancienne = _ceremonie_passee(programme, 100)
    nouvel_invite(ancienne)
    assert anonymiser_donnees_expirees()["evenements"] == 0  # 12 mois par défaut
    r = client_sa.patch("/api/parametres/", {"dureeConservationMois": 3}, format="json")
    assert r.status_code == 200 and r.json()["dureeConservationMois"] == 3
    assert anonymiser_donnees_expirees()["evenements"] == 1
    assert client_sa.patch("/api/parametres/", {"dureeConservationMois": 0}, format="json").status_code == 400
    assert client_sa.patch("/api/parametres/", {"dureeConservationMois": 61}, format="json").status_code == 400


def test_page_de_confidentialite_publique(client_sa):
    assert client_sa.patch("/api/parametres/", {"contactDonnees": "dpo@mde.ci"}, format="json").status_code == 200
    from rest_framework.test import APIClient

    r = APIClient().get("/api/public/confidentialite/")
    assert r.status_code == 200 and r.json() == {"contact": "dpo@mde.ci", "dureeConservationMois": 12}
    assert client_sa.patch("/api/parametres/", {"contactDonnees": "pas-un-email"}, format="json").status_code == 400


def test_reglages_reserves_au_super_admin(client_admin):
    assert client_admin.patch("/api/parametres/", {"dureeConservationMois": 1}, format="json").status_code == 403


def test_emails_renvoient_vers_la_politique(evenement):
    mail.outbox.clear()
    nouvel_invite(evenement)
    message = mail.outbox[0]
    assert "/confidentialite" in message.body
    assert "/confidentialite" in message.alternatives[0][0]


def test_cron_sans_file_anonymise_aussi(programme, settings):
    from rest_framework.test import APIClient

    settings.CRON_SECRET = "s" * 40
    p = Parametres.charger()
    p.duree_conservation_mois = 1
    p.save()
    nouvel_invite(_ceremonie_passee(programme, 60))
    r = APIClient().get("/api/taches-planifiees/sondages/", HTTP_AUTHORIZATION=f"Bearer {'s' * 40}")
    assert r.status_code == 200 and r.json()["anonymisation"] == {"evenements": 1, "invites": 1}
