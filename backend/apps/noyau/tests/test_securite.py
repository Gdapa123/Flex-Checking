"""Revue de sécurité : révocation des sessions, mot de passe temporaire, paramètres invalides, corps de
requête inattendus, injection dans les exports et le fichier .ics, logs sans données personnelles,
contrôle de santé."""

import logging

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.comptes.authentication import emettre_jetons, nouvelle_version_session
from apps.comptes.models import Admin
from apps.noyau.ics import ics_evenement
from apps.noyau.logs import MasquerParametresUrl

from .conftest import DONNEES, MDP, client_connecte, nouvel_invite
from .test_temps_reel import _garder_connexion_de_test, ecouter  # noqa: F401 — fixture partagée

pytestmark = pytest.mark.django_db

NOUVEAU = "Nouveau-Mdp-2026"


# ---------------------------------------------------------------- sessions révoquées


def test_reinitialisation_par_super_admin_revoque_les_sessions(client_sa, admin, evenement):
    c = client_connecte(admin)
    assert c.get(f"/api/evenements/{evenement.pk}/invites/").status_code == 200
    assert client_sa.post(f"/api/admins/{admin.pk}/reinitialiser-mot-de-passe/").status_code == 200
    # jeton d'accès et jeton de rafraîchissement volés avant la réinitialisation : inutilisables
    assert c.get(f"/api/evenements/{evenement.pk}/invites/").status_code == 401
    assert c.post("/api/auth/rafraichir/").status_code == 401


def test_changement_de_mot_de_passe_ferme_les_autres_sessions(admin, evenement):
    autre_appareil = client_connecte(admin)
    c = client_connecte(admin)
    r = c.post("/api/auth/mot-de-passe/", {"actuel": MDP, "nouveau": NOUVEAU}, format="json")
    assert r.status_code == 204
    # la session courante reçoit de nouveaux jetons et continue de fonctionner
    assert c.get(f"/api/evenements/{evenement.pk}/invites/").status_code == 200
    assert c.post("/api/auth/rafraichir/").status_code == 204
    # l'autre session (ex. téléphone perdu) est révoquée
    assert autre_appareil.get(f"/api/evenements/{evenement.pk}/invites/").status_code == 401
    assert autre_appareil.post("/api/auth/rafraichir/").status_code == 401


def test_websocket_refuse_un_jeton_anterieur_au_changement_de_mot_de_passe(admin):
    ancien = emettre_jetons(admin).access_token
    admin.set_password(NOUVEAU)
    nouvelle_version_session(admin)
    admin.save()
    code, _ = ecouter(jeton=str(ancien))
    assert code == 4001


def test_websocket_ferme_quand_le_mot_de_passe_est_reinitialise(admin):
    def reinitialiser():
        a = Admin.objects.get(pk=admin.pk)
        a.set_password(NOUVEAU)
        nouvelle_version_session(a)
        a.save()

    code, _ = ecouter(admin, action=reinitialiser)
    assert code == 4001


def test_mise_a_niveau_du_hachage_ne_ferme_pas_les_sessions(admin, evenement):
    """Django réencode parfois le mot de passe à la connexion (nouveau nombre d'itérations) : les autres
    appareils (postes de scan) ne doivent pas être déconnectés pour autant."""
    c = client_connecte(admin)
    admin.set_password(MDP)  # même mot de passe, hachage différent
    admin.save(update_fields=["password"])
    assert c.get(f"/api/evenements/{evenement.pk}/statistiques/").status_code == 200


def test_jeton_emis_avant_la_version_de_session_reste_valide(admin, evenement):
    """Déploiement : les jetons déjà émis (sans version) ne déconnectent personne."""
    c = APIClient()
    c.cookies["fc_access"] = str(AccessToken.for_user(admin))  # jeton « ancien format », sans « vs »
    assert c.get(f"/api/evenements/{evenement.pk}/statistiques/").status_code == 200
    admin.version_session = 1  # après un changement de mot de passe, il est refusé
    admin.save(update_fields=["version_session"])
    assert c.get(f"/api/evenements/{evenement.pk}/statistiques/").status_code == 401


# ---------------------------------------------------------------- mot de passe temporaire


def test_mot_de_passe_temporaire_bloque_l_api(admin, evenement):
    admin.doit_changer_mot_de_passe = True
    admin.save()
    c = client_connecte(admin)
    assert c.get("/api/auth/moi/").status_code == 200
    r = c.get(f"/api/evenements/{evenement.pk}/invites/")
    assert r.status_code == 403 and "mot de passe" in r.json()["detail"]
    assert c.get("/api/evenements/").status_code == 403
    assert c.post("/api/auth/mot-de-passe/", {"actuel": MDP, "nouveau": NOUVEAU}, format="json").status_code == 204
    assert c.get(f"/api/evenements/{evenement.pk}/invites/").status_code == 200


def test_mot_de_passe_temporaire_bloque_le_super_admin(super_admin):
    super_admin.doit_changer_mot_de_passe = True
    super_admin.save()
    c = client_connecte(super_admin)
    assert c.get("/api/admins/").status_code == 403


def test_mot_de_passe_temporaire_refuse_le_websocket(admin):
    admin.doit_changer_mot_de_passe = True
    admin.save()
    code, _ = ecouter(admin)
    assert code == 4003


# ---------------------------------------------------------------- paramètres et corps invalides


@pytest.mark.parametrize("url", ["/api/invites/", "/api/exports/invites/", "/api/exports/emails/"])
@pytest.mark.parametrize("param", ["evenement", "programme"])
def test_identifiant_non_numerique_refuse_sans_erreur_serveur(client_sa, evenement, url, param):
    r = client_sa.get(url, {param: "abc", "format": "csv"})
    assert r.status_code == 400 and param in r.json()


def test_identifiant_non_numerique_admin(client_admin, evenement):
    r = client_admin.get(f"/api/evenements/{evenement.pk}/invites/", {"evenement": "1 OR 1=1"})
    assert r.status_code == 400


@pytest.mark.parametrize("corps", [["email"], 42, "texte"])
def test_connexion_corps_non_objet(corps):
    r = APIClient().post("/api/auth/connexion/", corps, format="json")
    assert r.status_code == 400


def test_renvoi_qr_corps_non_objet(evenement):
    r = APIClient().post(f"/api/public/evenements/{evenement.slug_inscription}/renvoi-qr/", [1], format="json")
    assert r.status_code == 400


def test_actions_erreurs_corps_non_objet(client_sa):
    assert client_sa.post("/api/erreurs-techniques/actions/", [1], format="json").status_code == 400


# ---------------------------------------------------------------- injection


@pytest.mark.parametrize("champ", ["nom", "prenom", "entreprise", "fonction"])
def test_inscription_refuse_les_sauts_de_ligne(evenement, champ):
    donnees = {**DONNEES, champ: "Aya\r\nBcc: victime@exemple.ci"}
    r = APIClient().post(f"/api/public/evenements/{evenement.slug_inscription}/inscription/", donnees, format="json")
    assert r.status_code == 400 and champ in r.json()


def test_modification_refuse_les_caracteres_de_controle(client_admin, evenement):
    inv = nouvel_invite(evenement)
    r = client_admin.patch(f"/api/invites/{inv.pk}/", {"fonction": "DG\nX"}, format="json")
    assert r.status_code == 400


def test_ics_echappe_le_retour_chariot(evenement):
    evenement.lieu = "Sofitel\rATTENDEE:mailto:pirate@exemple.ci"
    contenu = ics_evenement(evenement).decode()
    assert "\rATTENDEE" not in contenu and "\nATTENDEE" not in contenu


def test_exports_neutralisent_les_formules(client_sa, super_admin, evenement):
    super_admin.nom = '=HYPERLINK("http://pirate","x")'
    super_admin.save()
    inv = nouvel_invite(evenement)
    client_sa.post(f"/api/invites/{inv.pk}/presence/")
    for type_export in ("presences", "journal"):
        contenu = client_sa.get(f"/api/exports/{type_export}/", {"format": "csv"}).content.decode("utf-8-sig")
        assert ";=HYPERLINK" not in contenu and "\n=HYPERLINK" not in contenu
        assert "'=HYPERLINK" in contenu


# ---------------------------------------------------------------- logs et santé


def test_journal_d_acces_sans_recherche():
    record = logging.LogRecord(
        "uvicorn.access",
        logging.INFO,
        "",
        0,
        '%s - "%s %s HTTP/%s" %d',
        ("1.2.3.4:5", "GET", "/api/invites/?q=aya.kouassi%40sib.ci&page=2", "1.1", 200),
        None,
    )
    MasquerParametresUrl().filter(record)
    message = record.getMessage()
    assert "kouassi" not in message and "/api/invites/?[masqué]" in message


def test_sante_independante_de_l_en_tete_host(client):
    assert client.get("/api/sante/", HTTP_HOST="172.18.0.5:8000").status_code == 200
    assert client.get("/api/sante/", HTTP_HOST="10.0.0.7:8000").json() == {"statut": "ok"}
    # le reste de l'application garde le contrôle de l'en-tête Host
    assert client.get("/api/programmes/", HTTP_HOST="pirate.example").status_code == 400


# ---------------------------------------------------------------- paramètres d'URL (revue 2)


@pytest.mark.parametrize(
    "url,params",
    [
        ("/api/invites/", {"evenement": "²"}),
        ("/api/invites/", {"programme": "١"}),
        ("/api/journal/", {"page": "²"}),
        ("/api/journal/", {"auteur": "³"}),
        ("/api/journal/", {"du": "2024-02-30"}),
        ("/api/journal/", {"au": "2024-13-01"}),
        ("/api/erreurs-techniques/", {"page": "²"}),
        ("/api/exports/journal/", {"du": "2024-02-30", "format": "csv"}),
    ],
)
def test_parametres_invalides_sans_erreur_serveur(client_sa, url, params):
    """Chiffres non ASCII (« ² ») et dates impossibles : jamais d'erreur 500."""
    assert client_sa.get(url, params).status_code in (200, 400)


def test_email_refuse_les_caracteres_de_controle(client, evenement):
    for email in ("a\x1bb@sib.ci", "a\x00b@sib.ci", "a\x7fb@sib.ci"):
        r = client.post(
            f"/api/public/evenements/{evenement.slug_inscription}/inscription/",
            {**DONNEES, "fonction": "DG", "email": email, "consentementDonnees": True},
            content_type="application/json",
        )
        assert r.status_code == 400 and "email" in r.json()


def test_telephone_exporte_comme_texte(client_sa, evenement):
    nouvel_invite(evenement)
    contenu = client_sa.get("/api/exports/invites/", {"format": "csv"}).content.decode("utf-8-sig")
    assert "'+225 07 12 34 56 78" in contenu  # sans l'apostrophe, Excel l'évalue (#NULL!)


def test_sante_en_tetes_et_methodes(client):
    r = client.get("/api/sante/")
    assert r["Cache-Control"] == "no-store" and r["X-Content-Type-Options"] == "nosniff"
    assert "default-src 'none'" in r["Content-Security-Policy"]
    r = client.post("/api/sante/")
    assert r.status_code == 405 and r["Allow"] == "GET, HEAD"


def test_permission_par_defaut_exige_un_compte_utilisable(admin):
    """Toute vue sans permission explicite applique la règle du mot de passe temporaire."""
    from rest_framework.settings import api_settings

    from apps.comptes.permissions import CompteUtilisable

    assert api_settings.DEFAULT_PERMISSION_CLASSES == [CompteUtilisable]
    admin.doit_changer_mot_de_passe = True
    admin.save()

    class Requete:
        user = admin

    assert CompteUtilisable().has_permission(Requete(), None) is False
