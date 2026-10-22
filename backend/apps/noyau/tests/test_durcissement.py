"""Audit de sécurité du 2026-10-22 : sessions d'un compte désactivé, anonymat du sondage, codes tirés au hasard
à la borne, caractères de contrôle, variables d'email, relance des emails, rejeu après annulation, capacité sous
concurrence, seed_demo hors développement."""

import threading
from datetime import timedelta
from urllib.parse import urlsplit

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
    # envoi en échec : traitement identique (réponse, email, statut), que l'invité ait répondu ou non
    EmailEnvoye.objects.filter(type=TypeEmail.SONDAGE).update(statut=StatutEmail.ECHEC)
    mail.outbox.clear()
    reponses = [c.post(f"/api/invites/{i.pk}/renvoi-email/", {"type": "SONDAGE"}, format="json") for i in (a, b)]
    assert [r.status_code for r in reponses] == [202, 202] and reponses[0].content == reponses[1].content
    assert sorted(m.to[0] for m in mail.outbox) == ["a@exemple.ci", "b@exemple.ci"]
    for i in (a, b):
        assert EmailEnvoye.objects.filter(invite=i, type=TypeEmail.SONDAGE).latest("cree_le").statut == "ENVOYE"


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
    # l'hôte public fait partie de l'identifiant : la base de test et la production ne se confondent pas
    from django.conf import settings

    assert (urlsplit(settings.APP_PUBLIC_URL).hostname or "local") in premier


def test_relance_d_une_tentative_perdue(evenement):
    inv = nouvel_invite(evenement)
    envoi = EmailEnvoye.objects.filter(invite=inv).first()
    deux_heures = timezone.now() - timedelta(hours=2)
    # en plein cycle de nouvelles tentatives (dernière il y a 1 min) : pas de relance anticipée
    EmailEnvoye.objects.filter(pk=envoi.pk).update(
        statut=StatutEmail.EN_ATTENTE,
        tentatives=1,
        cree_le=deux_heures,
        derniere_tentative_le=timezone.now() - timedelta(minutes=1),
    )
    relancer_emails_en_attente()
    assert EmailEnvoye.objects.get(pk=envoi.pk).statut == StatutEmail.EN_ATTENTE
    # dernière tentative il y a 2 h : son nouvel essai a été perdu, l'email est relancé
    EmailEnvoye.objects.filter(pk=envoi.pk).update(derniere_tentative_le=deux_heures)
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
    # rejeu d'un scan de plus de 12 h (l'heure retenue serait « maintenant ») : l'annulation l'emporte aussi
    tres_ancien = timezone.now() - timedelta(hours=13)
    r = services.emarger(
        evenement, admin, invite_id=inv.pk, mode="QR_CAMERA", appareil="TELEPHONE", date_client=tres_ancien
    )
    assert r["resultat"] == services.ANNULE_DEPUIS
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


def test_c_est_moi_touche_hors_ligne_puis_synchronise(admin, evenement):
    """Le jeton de « C'est moi » vaut 5 min à l'heure du passage : synchronisé 20 min plus tard, il reste accepté."""
    import time as horloge

    from django.core import signing

    from apps.noyau.vues_scan import SEL_CHOIX_BORNE, choix_borne_valide, jeton_choix_borne

    inv = nouvel_invite(evenement)
    maintenant = timezone.now()
    jeton = jeton_choix_borne(admin, evenement, inv.pk)
    assert choix_borne_valide(jeton, admin, evenement, inv.pk)
    assert not choix_borne_valide(jeton, admin, evenement, inv.pk + 1)  # autre invité
    ancien = signing.dumps([admin.pk, evenement.pk, inv.pk, int(horloge.time()) - 20 * 60], salt=SEL_CHOIX_BORNE)
    assert not choix_borne_valide(ancien, admin, evenement, inv.pk)  # passage « maintenant » : trop tard
    assert choix_borne_valide(ancien, admin, evenement, inv.pk, maintenant - timedelta(minutes=18))  # hors ligne
    assert not choix_borne_valide("[1, 2, 3]", admin, evenement, inv.pk)  # jeton non signé
