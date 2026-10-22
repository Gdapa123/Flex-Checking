"""Sondage de satisfaction (email n°3) : envoi le lendemain à 8 h, lien 24 h, une réponse par lien et par appareil."""

from datetime import time, timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.noyau import dates, services
from apps.noyau.models import (
    Appareil,
    EmailEnvoye,
    InvitationSondage,
    ModeEmargement,
    ReponseSondage,
    StatutEmail,
    TypeEmail,
)
from apps.noyau.sondages import planifier_sondages

from .conftest import client_connecte, creer_evenement, nouvel_invite

pytestmark = pytest.mark.django_db

REPONSE = {"noteGlobale": 5, "noteAccueil": 4, "recommandation": 9, "commentaire": "Très belle soirée"}


def lendemain(ev, h=8, m=5):
    return dates.combiner(ev.date + timedelta(days=1), time(h, m))


@pytest.fixture
def ceremonie_hier(programme):
    hier = timezone.localdate() - timedelta(days=1)
    return creer_evenement(programme, date=hier, date_limite_inscription=hier - timedelta(days=5))


def present(ev, admin=None, **kw):
    inv = nouvel_invite(ev, **kw)
    services.emarger(ev, admin, invite_id=inv.pk, mode=ModeEmargement.MANUEL, appareil=Appareil.ORDINATEUR)
    return inv


def jeton(invite):
    return InvitationSondage.objects.get(invite=invite).jeton


def public():
    return APIClient()


# ---------------------------------------------------------------- envoi planifié
def test_envoi_le_lendemain_aux_seuls_presents(ceremonie_hier):
    p = present(ceremonie_hier, email="p@exemple.ci")
    nouvel_invite(ceremonie_hier, email="absent@exemple.ci")
    mail.outbox.clear()
    assert planifier_sondages(lendemain(ceremonie_hier, 7, 59))["programmes"] == 0  # avant 8 h : rien
    assert planifier_sondages(lendemain(ceremonie_hier))["programmes"] == 1
    assert [m.to for m in mail.outbox] == [["p@exemple.ci"]]
    assert f"/sondage/{jeton(p)}" in mail.outbox[0].body
    assert mail.outbox[0].subject == "Votre avis sur la Graduation AMP " + str(ceremonie_hier.annee)
    inv = InvitationSondage.objects.get(invite=p)
    assert inv.expire_le - inv.cree_le == timedelta(hours=24)
    # idempotent : aucun second email
    assert planifier_sondages(lendemain(ceremonie_hier, 9, 0))["programmes"] == 0
    assert EmailEnvoye.objects.filter(type=TypeEmail.SONDAGE).count() == 1


def test_pas_d_envoi_hors_lendemain_ni_programme_desactive(programme, ceremonie_hier):
    avant_hier = creer_evenement(programme, date=timezone.localdate() - timedelta(days=2))
    present(avant_hier, email="vieux@exemple.ci")
    present(ceremonie_hier, email="p@exemple.ci")
    programme.sondage_actif = False
    programme.save()
    assert planifier_sondages(lendemain(ceremonie_hier))["programmes"] == 0
    programme.sondage_actif = True
    programme.save()
    assert planifier_sondages(lendemain(ceremonie_hier))["programmes"] == 1  # seulement la cérémonie de la veille


def test_rattrapage_presence_validee_le_lendemain(ceremonie_hier):
    present(ceremonie_hier, email="a@exemple.ci")
    planifier_sondages(lendemain(ceremonie_hier))
    present(ceremonie_hier, email="tard@exemple.ci")
    assert planifier_sondages(lendemain(ceremonie_hier, 10, 0))["programmes"] == 1


def test_sans_file_envoi_dans_le_budget_puis_reprise(ceremonie_hier, settings):
    settings.ENVOI_SANS_FILE = True
    for k in range(3):
        present(ceremonie_hier, email=f"s{k}@exemple.ci")
    mail.outbox.clear()
    r = planifier_sondages(lendemain(ceremonie_hier), budget_s=-1)  # budget épuisé : liens créés, rien envoyé
    assert r == {"programmes": 3, "envoyes": 0}
    assert EmailEnvoye.objects.filter(type=TypeEmail.SONDAGE, statut=StatutEmail.EN_ATTENTE).count() == 3
    assert mail.outbox == []
    r = planifier_sondages(lendemain(ceremonie_hier, 12, 0))  # second cron : reprend les emails en attente
    assert r == {"programmes": 0, "envoyes": 3}
    assert len(mail.outbox) == 3


def test_sondage_jamais_envoye_apres_cloture_ni_apres_annulation(ceremonie_hier, settings):
    from apps.noyau.tasks import envoyer_email

    settings.ENVOI_SANS_FILE = True
    a, b = present(ceremonie_hier, email="a@exemple.ci"), present(ceremonie_hier, email="b@exemple.ci")
    planifier_sondages(lendemain(ceremonie_hier), budget_s=-1)
    InvitationSondage.objects.filter(invite=a).update(expire_le=timezone.now() - timedelta(minutes=1))
    services.annuler_presence(b, None, "Erreur")
    mail.outbox.clear()
    for e in EmailEnvoye.objects.filter(type=TypeEmail.SONDAGE):
        envoyer_email(e.pk)
    assert mail.outbox == []
    assert set(EmailEnvoye.objects.filter(type=TypeEmail.SONDAGE).values_list("statut", flat=True)) == {"ECHEC"}


def test_cron_protege_par_le_secret(ceremonie_hier, settings):
    c = public()
    settings.CRON_SECRET = ""
    assert c.get("/api/taches-planifiees/sondages/").status_code == 404
    settings.CRON_SECRET = "court"  # secret trop court : route désactivée même avec le bon en-tête
    assert c.get("/api/taches-planifiees/sondages/", HTTP_AUTHORIZATION="Bearer court").status_code == 404
    secret = "s" * 40
    settings.CRON_SECRET = secret
    assert c.get("/api/taches-planifiees/sondages/", HTTP_AUTHORIZATION="Bearer faux").status_code == 404
    r = c.get("/api/taches-planifiees/sondages/", HTTP_AUTHORIZATION=f"Bearer {secret}")
    assert r.status_code == 200 and set(r.json()) == {"programmes", "envoyes", "anonymisation"}


# ---------------------------------------------------------------- page publique
@pytest.fixture
def lien(ceremonie_hier):
    inv = present(ceremonie_hier, email="p@exemple.ci")
    planifier_sondages(lendemain(ceremonie_hier))
    return jeton(inv)


def url(j):
    return f"/api/public/sondages/{j}/"


def test_lecture_du_lien(lien, ceremonie_hier):
    c = public()
    r = c.get(url(lien))
    assert r.status_code == 200
    d = r.json()
    assert d["etat"] == "OUVERT" and d["prenom"] == "Aya"
    assert d["evenement"]["nomAffiche"] == ceremonie_hier.nom_affiche and "tokens" in d["evenement"]
    assert "email" not in str(d)  # aucune adresse exposée
    assert c.cookies["fc_appareil"]["httponly"]
    assert c.get(url("inconnu")).status_code == 404


def test_reponse_unique_par_lien(lien):
    c = public()
    c.get(url(lien))
    r = c.post(url(lien), REPONSE, format="json")
    assert r.status_code == 201
    rep = ReponseSondage.objects.get()
    assert (rep.note_globale, rep.note_accueil, rep.recommandation) == (5, 4, 9)
    assert len(rep.appareil) == 64  # empreinte, jamais l'identifiant brut
    assert c.get(url(lien)).json()["etat"] == "REPONDU"
    r = public().post(url(lien), {**REPONSE, "appareil": "autre-appareil-0123456789"}, format="json")
    assert r.status_code == 409 and r.json()["code"] == "DEJA_REPONDU"


def test_un_seul_avis_par_appareil(ceremonie_hier):
    a, b = present(ceremonie_hier, email="a@exemple.ci"), present(ceremonie_hier, email="b@exemple.ci")
    planifier_sondages(lendemain(ceremonie_hier))
    c = public()
    c.get(url(jeton(a)))
    assert c.post(url(jeton(a)), REPONSE, format="json").status_code == 201
    r = c.post(url(jeton(b)), REPONSE, format="json")  # même cookie
    assert r.status_code == 409 and r.json()["code"] == "APPAREIL_DEJA_UTILISE"
    assert ReponseSondage.objects.count() == 1


def test_identifiant_navigateur_seul(ceremonie_hier):
    a, b = present(ceremonie_hier, email="a@exemple.ci"), present(ceremonie_hier, email="b@exemple.ci")
    planifier_sondages(lendemain(ceremonie_hier))
    local = "navigateur-0123456789abcdef"
    assert public().post(url(jeton(a)), {**REPONSE, "appareil": local}, format="json").status_code == 201
    r = public().post(url(jeton(b)), {**REPONSE, "appareil": local}, format="json")
    assert r.status_code == 409 and r.json()["code"] == "APPAREIL_DEJA_UTILISE"


def test_lien_expire(lien):
    InvitationSondage.objects.update(expire_le=timezone.now() - timedelta(minutes=1))
    c = public()
    d = c.get(url(lien)).json()
    assert d["etat"] == "EXPIRE" and d["prenom"] == "" and d["civilite"] == ""  # plus de donnée personnelle
    r = c.post(url(lien), REPONSE, format="json")
    assert r.status_code == 410 and r.json()["code"] == "SONDAGE_EXPIRE"


def test_validation_des_notes_et_appareil(lien):
    c = public()
    c.get(url(lien))
    assert c.post(url(lien), {**REPONSE, "noteGlobale": 6}, format="json").status_code == 400
    assert c.post(url(lien), {**REPONSE, "recommandation": 11}, format="json").status_code == 400
    assert c.post(url(lien), {**REPONSE, "commentaire": "x" * 1001}, format="json").status_code == 400
    assert c.post(url(lien), {**REPONSE, "commentaire": "Bravo\x1b[2J\x00"}, format="json").status_code == 400
    assert public().post(url(lien), REPONSE, format="json").status_code == 400  # ni cookie ni identifiant


# ---------------------------------------------------------------- résultats
def test_resultats_admin_et_super_admin(ceremonie_hier, admin, super_admin):
    ceremonie_hier.admins.add(admin)
    invites = [present(ceremonie_hier, email=f"i{k}@exemple.ci") for k in range(3)]
    planifier_sondages(lendemain(ceremonie_hier))
    for k, (note, reco) in enumerate([(5, 10), (4, 7), (2, 3)]):
        public().post(
            url(jeton(invites[k])),
            {"noteGlobale": note, "noteAccueil": 4, "recommandation": reco, "appareil": f"appareil-{k:016d}"},
            format="json",
        )
    r = client_connecte(admin).get(f"/api/evenements/{ceremonie_hier.pk}/sondage/").json()
    assert (r["envoyes"], r["reponses"], r["tauxReponse"]) == (3, 3, 100)
    assert r["noteGlobale"] == 3.7 and r["noteAccueil"] == 4.0
    assert r["nps"] == 0  # 1 promoteur, 1 passif, 1 détracteur
    assert [x["nb"] for x in r["repartitionGlobale"]] == [0, 1, 0, 1, 1]
    assert r["etat"] == "EN_COURS"
    g = client_connecte(super_admin).get("/api/analytique/sondages/").json()
    assert g["reponses"] == 3 and g["ceremonies"][0]["evenementId"] == ceremonie_hier.pk
    assert client_connecte(admin).get("/api/analytique/sondages/").status_code == 403


def test_resultats_reserves_aux_admins_de_la_ceremonie(ceremonie_hier, client_admin):
    assert client_admin.get(f"/api/evenements/{ceremonie_hier.pk}/sondage/").status_code == 404


def test_suivi_et_renvoi_du_sondage(ceremonie_hier, admin):
    ceremonie_hier.admins.add(admin)
    inv = present(ceremonie_hier, email="p@exemple.ci")
    c = client_connecte(admin)
    # pas encore de lien : renvoi individuel refusé
    r = c.post(f"/api/invites/{inv.pk}/renvoi-email/", {"type": "SONDAGE"}, format="json")
    assert r.status_code == 409
    planifier_sondages(lendemain(ceremonie_hier))
    EmailEnvoye.objects.filter(type=TypeEmail.SONDAGE).update(statut=StatutEmail.ECHEC)
    suivi = c.get(f"/api/evenements/{ceremonie_hier.pk}/suivi-emails/").json()["SONDAGE"]
    assert suivi["echecs"] == 1 and suivi["actif"] is True
    r = c.post(f"/api/evenements/{ceremonie_hier.pk}/suivi-emails/renvoyer-echecs/", {"type": "SONDAGE"}, format="json")
    assert r.json() == {"traites": 1}
    InvitationSondage.objects.update(expire_le=timezone.now() - timedelta(minutes=1))
    EmailEnvoye.objects.filter(type=TypeEmail.SONDAGE).update(statut=StatutEmail.ECHEC)
    r = c.post(f"/api/evenements/{ceremonie_hier.pk}/suivi-emails/renvoyer-echecs/", {"type": "SONDAGE"}, format="json")
    assert r.json() == {"traites": 0}  # lien expiré : pas de renvoi


def test_email_de_test_et_apercu_du_sondage(evenement, client_admin, admin):
    mail.outbox.clear()
    r = client_admin.post(f"/api/evenements/{evenement.pk}/suivi-emails/test/", {"type": "SONDAGE"}, format="json")
    assert r.status_code == 200
    assert "/sondage/exemple-de-lien-non-valide" in mail.outbox[0].body
    apercu = client_admin.get(f"/api/evenements/{evenement.pk}/apercu-emails/").json()
    assert "Donner mon avis" in apercu["SONDAGE"]["html"]


def test_reponse_anonyme_en_base(lien):
    c = public()
    c.get(url(lien))
    c.post(url(lien), REPONSE, format="json")
    champs = {f.name for f in ReponseSondage._meta.get_fields()}
    assert not champs & {"invitation", "invite"}  # aucun lien vers l'invité
    rep = ReponseSondage.objects.get()
    assert rep.cree_le.minute == 0 and rep.cree_le.second == 0  # heure arrondie : pas de rapprochement
    assert InvitationSondage.objects.get(jeton=lien).repondu is True
    # suppression de l'invité (droit à l'effacement) : son lien part, la réponse anonyme reste dans les résultats
    InvitationSondage.objects.get(jeton=lien).invite.delete()
    assert ReponseSondage.objects.count() == 1


def test_rapport_pdf_avec_satisfaction(lien, ceremonie_hier, admin):
    ceremonie_hier.admins.add(admin)
    c = public()
    c.get(url(lien))
    c.post(url(lien), {**REPONSE, "commentaire": "<b>Bravo</b> & merci"}, format="json")
    r = client_connecte(admin).get(f"/api/evenements/{ceremonie_hier.pk}/rapport/")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
