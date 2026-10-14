import threading
from datetime import timedelta

import pytest
from django.core import mail
from django.db import connection
from django.utils import timezone

from apps.noyau.models import EmailEnvoye, Emargement, Invite, TypeEmail
from apps.noyau.services import annuler_emargement, emarger

from .conftest import client_connecte, nouvel_invite

pytestmark = pytest.mark.django_db


def scan(client, ev, **kw):
    d = {"mode": "QR_CAMERA", "poste": "Accueil principal", "appareil": "TELEPHONE", **kw}
    return client.post(f"/api/evenements/{ev.pk}/emargement/", d, format="json")


def test_premier_passage_present_et_magazine(client_admin, evenement):
    inv = nouvel_invite(evenement)
    mail.outbox.clear()
    r = scan(client_admin, evenement, qrToken=inv.qr_token)
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["resultat"] == "PRESENT" and d["magazineEnvoye"] is True
    assert d["presents"] == 1 and d["inscrits"] == 1
    assert d["invite"]["nomComplet"] == "Mme Aya KOUASSI"
    inv.refresh_from_db()
    assert inv.statut.code == "PRESENT" and inv.mode_emargement == "QR_CAMERA" and inv.present_le
    assert Emargement.objects.filter(invite=inv).count() == 1
    assert len(mail.outbox) == 1 and "magazine" in mail.outbox[0].subject.lower()


def test_idempotence_deja_emarge(client_admin, evenement):
    inv = nouvel_invite(evenement)
    scan(client_admin, evenement, qrToken=inv.qr_token)
    mail.outbox.clear()
    r = scan(client_admin, evenement, code=inv.code, mode="CODE", poste="Borne 1")
    d = r.json()
    assert d["resultat"] == "DEJA_EMARGE"
    assert d["poste"] == "Accueil principal"  # poste du premier passage
    assert Emargement.objects.filter(invite=inv).count() == 1
    assert len(mail.outbox) == 0


def test_code_invalide_et_autre_evenement(client_admin, evenement, autre_evenement):
    assert scan(client_admin, evenement, code="0000", mode="CODE").json()["resultat"] == "CODE_INVALIDE"
    assert scan(client_admin, evenement, qrToken="nimportequoi").json()["resultat"] == "CODE_INVALIDE"
    autre = nouvel_invite(autre_evenement, email="b@sib.ci")
    d = scan(client_admin, evenement, qrToken=autre.qr_token).json()
    assert d["resultat"] == "AUTRE_EVENEMENT"
    assert d["evenementAutre"] == autre_evenement.nom_affiche
    assert d["invite"] is None


def test_un_seul_champ_requis(client_admin, evenement):
    assert scan(client_admin, evenement).status_code == 400
    assert scan(client_admin, evenement, code="1234", qrToken="x").status_code == 400


def test_annulation_reservee_au_super_admin(client_admin, evenement):
    inv = nouvel_invite(evenement)
    d = scan(client_admin, evenement, qrToken=inv.qr_token).json()
    r = client_admin.post(f"/api/emargements/{d['emargementId']}/annulation/", {"motif": "Erreur"}, format="json")
    assert r.status_code == 403
    inv.refresh_from_db()
    assert inv.statut.code == "PRESENT"


def test_annulation_puis_reemargement_sans_second_magazine(client_admin, client_sa, super_admin, evenement):
    inv = nouvel_invite(evenement)
    d = scan(client_admin, evenement, qrToken=inv.qr_token).json()
    r = client_sa.post(f"/api/emargements/{d['emargementId']}/annulation/", {"motif": "Erreur"}, format="json")
    assert r.status_code == 200 and r.json()["presents"] == 0
    inv.refresh_from_db()
    assert inv.statut.code == "INSCRIT" and inv.present_le is None and inv.mode_emargement is None
    em = Emargement.objects.get(pk=d["emargementId"])
    assert em.annule_le and em.annule_par == super_admin and em.motif_annulation == "Erreur"
    mail.outbox.clear()
    d2 = scan(client_admin, evenement, qrToken=inv.qr_token).json()
    assert d2["resultat"] == "PRESENT" and d2["magazineEnvoye"] is False
    assert EmailEnvoye.objects.filter(invite=inv, type=TypeEmail.MAGAZINE).count() == 1
    assert len(mail.outbox) == 0
    # double annulation refusée
    assert client_sa.post(f"/api/emargements/{d['emargementId']}/annulation/", {}, format="json").status_code == 409


def test_magazine_inactif(client_admin, evenement, programme):
    programme.magazine_actif = False
    programme.save()
    inv = nouvel_invite(evenement)
    assert scan(client_admin, evenement, qrToken=inv.qr_token).json()["magazineEnvoye"] is False


def test_scan_hors_ligne_garde_date_client(client_admin, evenement):
    inv = nouvel_invite(evenement)
    avant = timezone.now() - timedelta(minutes=20)
    d = scan(client_admin, evenement, qrToken=inv.qr_token, dateClient=avant.isoformat()).json()
    assert d["resultat"] == "PRESENT"
    inv.refresh_from_db()
    assert abs((inv.present_le - avant).total_seconds()) < 1
    # une date client absurde (future) est ignorée
    inv2 = nouvel_invite(evenement, email="c@sib.ci")
    futur = timezone.now() + timedelta(days=2)
    scan(client_admin, evenement, qrToken=inv2.qr_token, dateClient=futur.isoformat())
    inv2.refresh_from_db()
    assert inv2.present_le < futur - timedelta(days=1)


def test_synchronisation_hors_ligne_rejouee_idempotente(client_admin, evenement):
    """Une file hors ligne rejouée deux fois (réseau instable) ne crée qu'un émargement."""
    inv = nouvel_invite(evenement)
    file = [{"code": inv.code, "mode": "CODE", "dateClient": (timezone.now() - timedelta(minutes=5)).isoformat()}] * 2
    resultats = [scan(client_admin, evenement, **s).json()["resultat"] for s in file]
    assert resultats == ["PRESENT", "DEJA_EMARGE"]
    assert Emargement.objects.filter(invite=inv).count() == 1


def test_limitation_codes(client_admin, evenement):
    for _ in range(30):
        scan(client_admin, evenement, code="0001", mode="CODE")
    assert scan(client_admin, evenement, code="0001", mode="CODE").status_code == 429


def test_limitation_codes_non_contournable_par_le_poste(client_admin, evenement):
    """Changer le nom du poste à chaque essai ne contourne pas la limite."""
    for i in range(30):
        scan(client_admin, evenement, code="0001", mode="CODE", poste=f"Poste {i}")
    assert scan(client_admin, evenement, code="0002", mode="CODE", poste="Autre").status_code == 429


def test_codes_valides_jamais_bloques(client_admin, evenement):
    """Une borne très active (codes valides) n'est pas limitée."""
    codes = [nouvel_invite(evenement, email=f"v{i}@sib.ci").code for i in range(35)]
    resultats = [scan(client_admin, evenement, code=c, mode="CODE").status_code for c in codes]
    assert resultats == [200] * 35


def test_recents(client_admin, evenement):
    inv = nouvel_invite(evenement)
    scan(client_admin, evenement, qrToken=inv.qr_token)
    d = client_admin.get(f"/api/evenements/{evenement.pk}/emargements/recents/").json()
    assert d["presents"] == 1 and d["passages"][0]["nomComplet"] == "Mme Aya KOUASSI"


@pytest.mark.django_db(transaction=True)
def test_concurrence_un_seul_emargement(evenement, admin):
    """Deux scans simultanés du même QR : un seul PRESENT, un seul email n°2."""
    inv = nouvel_invite(evenement)
    resultats, barriere = [], threading.Barrier(4)

    def scanner():
        try:
            barriere.wait()
            r = emarger(evenement, admin, qr_token=inv.qr_token, mode="QR_CAMERA", appareil="TELEPHONE")
            resultats.append(r["resultat"])
        finally:
            connection.close()

    fils = [threading.Thread(target=scanner) for _ in range(4)]
    for f in fils:
        f.start()
    for f in fils:
        f.join()
    assert sorted(resultats) == ["DEJA_EMARGE"] * 3 + ["PRESENT"]
    assert Emargement.objects.filter(invite=inv).count() == 1
    assert EmailEnvoye.objects.filter(invite=inv, type=TypeEmail.MAGAZINE).count() == 1
    assert Invite.objects.get(pk=inv.pk).statut.code == "PRESENT"


def test_annulation_service_direct(evenement, admin):
    inv = nouvel_invite(evenement)
    r = emarger(evenement, admin, invite_id=inv.pk, mode="MANUEL", appareil="ORDINATEUR")
    annuler_emargement(Emargement.objects.get(pk=r["emargement_id"]), admin)
    assert Invite.objects.get(pk=inv.pk).statut.code == "INSCRIT"


def test_autre_admin_ne_peut_pas_emarger(admin_autre, evenement):
    inv = nouvel_invite(evenement)
    c = client_connecte(admin_autre)
    assert scan(c, evenement, qrToken=inv.qr_token).status_code == 404
