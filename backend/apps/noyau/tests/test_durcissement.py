"""Audit de sécurité du 2026-10-22 : sessions d'un compte désactivé, anonymat du sondage, codes tirés au hasard
à la borne, caractères de contrôle, variables d'email, relance des emails, rejeu après annulation, capacité sous
concurrence, seed_demo hors développement."""

import threading
from datetime import timedelta

import pytest
from django.core import mail
from django.core.management import CommandError, call_command
from django.db import connection
from django.utils import timezone

from apps.noyau import emails, services
from apps.noyau.exceptions import ErreurMetier
from apps.noyau.models import EmailEnvoye, Emargement, Invite, StatutEmail, TypeEmail
from apps.noyau.sondages import planifier_sondages
from apps.noyau.tasks import relancer_emails_en_attente

from .conftest import client_connecte, creer_evenement, nouvel_invite
from .test_sondage import ceremonie_hier, lendemain, present  # noqa: F401 (fixture partagée)

pytestmark = pytest.mark.django_db


def test_desactivation_ferme_les_sessions(client_sa, admin, evenement):
    c = client_connecte(admin)
    assert client_sa.patch(f"/api/admins/{admin.pk}/", {"actif": False}, format="json").status_code == 200
    assert client_sa.patch(f"/api/admins/{admin.pk}/", {"actif": True}, format="json").status_code == 200
    # session ouverte avant la désactivation : ne revit pas à la réactivation
    assert c.get(f"/api/evenements/{evenement.pk}/").status_code == 401
    assert c.post("/api/auth/rafraichir/").status_code == 401


def _renvoyer_sondage(c, invite):
    return c.post(f"/api/invites/{invite.pk}/renvoi-email/", {"type": "SONDAGE"}, format="json").status_code


def test_renvoi_du_sondage_ne_revele_pas_qui_a_repondu(ceremonie_hier, admin):  # noqa: F811
    from apps.noyau.models import InvitationSondage

    ceremonie_hier.admins.add(admin)
    a = present(ceremonie_hier, email="a@exemple.ci")
    b = present(ceremonie_hier, email="b@exemple.ci")
    planifier_sondages(lendemain(ceremonie_hier))
    c = client_connecte(admin)
    # envoi réussi : aucun renvoi individuel, que l'invité ait répondu ou non
    InvitationSondage.objects.filter(invite=a).update(repondu=True)
    codes = [
        c.post(f"/api/invites/{i.pk}/renvoi-email/", {"type": "SONDAGE"}, format="json").status_code for i in (a, b)
    ]
    assert codes == [409, 409]
    # envoi en échec : même réponse pour les deux, mais seul celui qui n'a pas répondu reçoit l'email
    EmailEnvoye.objects.filter(type=TypeEmail.SONDAGE).update(statut=StatutEmail.ECHEC)
    mail.outbox.clear()
    codes = [
        c.post(f"/api/invites/{i.pk}/renvoi-email/", {"type": "SONDAGE"}, format="json").status_code for i in (a, b)
    ]
    assert codes == [202, 202]
    assert [m.to for m in mail.outbox] == [["b@exemple.ci"]]


def test_borne_limite_les_codes_tires_au_hasard(admin, evenement):
    borne = client_connecte(admin)
    assert borne.post("/api/auth/borne/").status_code == 204
    url = f"/api/evenements/{evenement.pk}/emargement/"
    codes = [
        borne.post(url, {"code": f"{9000 + i}", "mode": "CODE", "appareil": "TABLETTE"}, format="json").status_code
        for i in range(11)
    ]
    assert codes[:10] == [200] * 10 and codes[10] == 429


def test_modeles_d_email_enregistres(client_sa):
    """Les champs numérotés (objetEmail1, corpsEmail3…) arrivent bien jusqu'au modèle."""
    modeles = {"objetEmail1": "Nouvel objet", "corpsEmail3": "Merci {prenom}"}
    r = client_sa.patch("/api/parametres/", modeles, format="json")
    assert r.status_code == 200
    d = client_sa.get("/api/parametres/").json()
    assert d["objetEmail1"] == "Nouvel objet" and d["corpsEmail3"] == "Merci {prenom}"


def test_caracteres_de_controle_refuses(client_sa, client_admin, evenement):
    r = client_sa.patch("/api/parametres/", {"objetEmail1": "Invitation\r\nBcc: x@exemple.ci"}, format="json")
    assert r.status_code == 400
    corps = {"code": "1234", "mode": "CODE", "appareil": "TABLETTE", "poste": "Entrée\x00"}
    assert client_admin.post(f"/api/evenements/{evenement.pk}/emargement/", corps, format="json").status_code == 400


def test_variables_remplacees_en_une_seule_passe():
    assert emails._remplacer("Bonjour {prenom}, code {code}", {"prenom": "{code}", "code": "1234"}) == (
        "Bonjour {code}, code 1234"
    )


def test_message_id_stable_par_envoi(evenement):
    inv = nouvel_invite(evenement)
    envoi = EmailEnvoye.objects.filter(invite=inv).first()
    premier = emails.construire_message(envoi).extra_headers["Message-ID"]
    assert premier == emails.construire_message(envoi).extra_headers["Message-ID"]
    assert str(envoi.pk) in premier


def test_relance_d_une_tentative_perdue(evenement):
    inv = nouvel_invite(evenement)
    envoi = EmailEnvoye.objects.filter(invite=inv).first()
    EmailEnvoye.objects.filter(pk=envoi.pk).update(
        statut=StatutEmail.EN_ATTENTE, tentatives=2, cree_le=timezone.now() - timedelta(hours=2)
    )
    mail.outbox.clear()
    relancer_emails_en_attente()
    assert EmailEnvoye.objects.get(pk=envoi.pk).statut == StatutEmail.ENVOYE


def test_scan_hors_ligne_rejoue_apres_annulation(evenement, admin, super_admin):
    inv = nouvel_invite(evenement)
    scan_hors_ligne = timezone.now() - timedelta(minutes=20)
    r = services.emarger(evenement, admin, invite_id=inv.pk, mode="MANUEL", appareil="TABLETTE")
    services.annuler_emargement(Emargement.objects.get(pk=r["emargement_id"]), super_admin, "erreur de personne")
    # un autre poste, resté hors ligne, avait scanné l'invité AVANT l'annulation : il ne repasse pas présent
    r = services.emarger(
        evenement, admin, invite_id=inv.pk, mode="QR_CAMERA", appareil="TELEPHONE", date_client=scan_hors_ligne
    )
    assert r["resultat"] == services.ANNULE_DEPUIS
    assert Invite.objects.get(pk=inv.pk).statut.code == "INSCRIT"
    # un nouveau scan en direct, lui, refait passer l'invité présent
    r = services.emarger(evenement, admin, invite_id=inv.pk, mode="MANUEL", appareil="TABLETTE")
    assert r["resultat"] == services.PRESENT


@pytest.mark.django_db(transaction=True)
def test_concurrence_derniere_place(programme):
    from .conftest import donnees_reference

    donnees_reference()
    ev = creer_evenement(programme, capacite=1)
    resultats, barriere = [], threading.Barrier(5)

    def inscrire(i):
        donnees = {
            "civilite": "MME",
            "nom": "Kouassi",
            "prenom": "Aya",
            "email": f"place{i}@exemple.ci",
            "telephone": "0712345678",
            "entreprise": "SIB",
            "fonction": "Analyste",
            "consentement_donnees": True,
        }
        try:
            barriere.wait()
            services.inscrire(ev, donnees)
            resultats.append("OK")
        except ErreurMetier as e:
            resultats.append(e.code)
        finally:
            connection.close()

    fils = [threading.Thread(target=inscrire, args=(i,)) for i in range(5)]
    for f in fils:
        f.start()
    for f in fils:
        f.join()
    assert resultats.count("OK") == 1 and resultats.count("COMPLET") == 4
    assert ev.invites.count() == 1


def test_seed_demo_refuse_hors_developpement(settings):
    settings.DEBUG = False
    with pytest.raises(CommandError):
        call_command("seed_demo", verbosity=0)
