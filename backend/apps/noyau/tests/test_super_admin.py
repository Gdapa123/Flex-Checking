import pytest

from apps.comptes.models import Admin
from apps.noyau.models import JournalActivite, Programme

from .conftest import client_connecte, nouvel_invite

pytestmark = pytest.mark.django_db


def test_programme_crud_et_protection(client_sa, evenement, programme):
    r = client_sa.post(
        "/api/programmes/",
        {"nom": "EMBA", "couleurPrincipale": "#2f3a8f", "couleurSecondaire": "#3cc4b0"},
        format="json",
    )
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["couleurPrincipale"] == "#2F3A8F" and d["tokens"]["op"] == "#FFFFFF"
    assert client_sa.delete(f"/api/programmes/{d['id']}/").status_code == 204
    r = client_sa.delete(f"/api/programmes/{programme.pk}/")  # programme avec événements : confirmation exigée
    assert r.status_code == 400 and r.json()["code"] == "CONFIRMATION_REQUISE"
    r = client_sa.patch(f"/api/programmes/{programme.pk}/", {"actif": False}, format="json")
    assert r.status_code == 200 and Programme.objects.get(pk=programme.pk).actif is False
    assert JournalActivite.objects.filter(action="PROGRAMME_DESACTIVATION").exists()


def test_couleur_invalide_et_magazine_sans_lien(client_sa, programme):
    assert (
        client_sa.patch(f"/api/programmes/{programme.pk}/", {"couleurPrincipale": "rouge"}, format="json").status_code
        == 400
    )
    r = client_sa.patch(f"/api/programmes/{programme.pk}/", {"magazineActif": True, "lienMagazine": ""}, format="json")
    assert r.status_code == 400


def test_evenement_creation_slug_qr(client_sa, programme, admin):
    r = client_sa.post(
        "/api/evenements/",
        {
            "programme": programme.pk,
            "date": "2027-11-14",
            "heureDebut": "18:00",
            "heureAccueil": "17:15",
            "lieu": "Sofitel",
            "capacite": 200,
            "dateLimiteInscription": "2027-11-07",
            "admins": [admin.pk],
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["nomAffiche"] == "Graduation AMP 2027" and d["slugInscription"].startswith("amp-2027-")
    slug = d["slugInscription"]
    r = client_sa.post(f"/api/evenements/{d['id']}/regenerer-slug/")
    assert r.json()["slugInscription"] != slug
    r = client_sa.get(f"/api/evenements/{d['id']}/qr-inscription.png")
    assert r.status_code == 200 and r.content[:4] == b"\x89PNG"
    r = client_sa.patch(f"/api/evenements/{d['id']}/", {"inscriptionsOuvertes": False}, format="json")
    assert r.json()["etatInscriptions"] == "FERME"
    assert JournalActivite.objects.filter(action="INSCRIPTIONS_FERMETURE").exists()


def test_evenement_dates_incoherentes(client_sa, programme):
    r = client_sa.post(
        "/api/evenements/",
        {
            "programme": programme.pk,
            "date": "2027-11-14",
            "heureDebut": "18:00",
            "heureAccueil": "19:00",
            "lieu": "X",
            "capacite": 10,
            "dateLimiteInscription": "2027-11-20",
        },
        format="json",
    )
    assert r.status_code == 400
    assert {"dateLimiteInscription"} <= set(r.json()) or {"heureAccueil"} <= set(r.json())


def test_comptes_admins(client_sa, super_admin, evenement):
    r = client_sa.post(
        "/api/admins/",
        {"nom": "Nadège Assi", "email": "nadege@mde.ci", "role": "ADMIN", "evenements": [evenement.pk]},
        format="json",
    )
    assert r.status_code == 201, r.content
    mdp = r.json()["motDePasseTemporaire"]
    a = Admin.objects.get(email="nadege@mde.ci")
    assert a.doit_changer_mot_de_passe and a.check_password(mdp) and list(a.evenements.all()) == [evenement]
    r = client_sa.post(f"/api/admins/{a.pk}/reinitialiser-mot-de-passe/")
    assert r.status_code == 200 and r.json()["motDePasseTemporaire"] != mdp
    assert client_sa.patch(f"/api/admins/{a.pk}/", {"actif": False}, format="json").status_code == 200
    r = client_sa.patch(f"/api/admins/{super_admin.pk}/", {"actif": False}, format="json")
    assert r.status_code == 409


def test_parametres_et_apercu(client_sa, evenement):
    r = client_sa.patch("/api/parametres/", {"dureeResultatScan": 5, "sonActif": False}, format="json")
    assert r.status_code == 200 and r.json()["dureeResultatScan"] == 5
    assert client_sa.patch("/api/parametres/", {"dureeResultatScan": 4}, format="json").status_code == 400
    e = JournalActivite.objects.filter(action="PARAMETRES").first()
    assert e.details["duree_resultat_scan"] == 5
    r = client_sa.post(
        "/api/parametres/apercu-email/",
        {"type": "INVITATION", "objet": "Salut {prenom}", "corps": "Bonjour {prenom}\n\n{qr_code}"},
        format="json",
    )
    d = r.json()
    assert d["objet"] == "Salut Aya" and "data:image/png;base64" in d["html"]


def test_journal_filtrable(client_sa, client_admin, evenement):
    inv = nouvel_invite(evenement)
    client_admin.post(f"/api/invites/{inv.pk}/presence/")
    d = client_sa.get("/api/journal/", {"categorie": "Émargement"}).json()
    assert d["total"] == 1
    assert d["resultats"][0]["detail"].startswith("Mme Aya KOUASSI · Présent · Manuel")
    assert "aya" not in str(JournalActivite.objects.get(action="EMARGEMENT").details).lower()
    assert client_sa.get("/api/journal/", {"du": "2000-01-01", "au": "2000-01-02"}).json()["total"] == 0


@pytest.mark.parametrize("type_export", ["invites", "presences", "emails", "journal"])
def test_exports_globaux(client_sa, evenement, type_export):
    nouvel_invite(evenement)
    r = client_sa.get(f"/api/exports/{type_export}/", {"format": "csv"})
    assert r.status_code == 200 and r.content.startswith(b"\xef\xbb\xbf")


def test_tous_invites_filtres(client_sa, evenement, autre_evenement):
    nouvel_invite(evenement)
    nouvel_invite(autre_evenement, email="x@sib.ci")
    assert client_sa.get("/api/invites/").json()["total"] == 2
    assert client_sa.get("/api/invites/", {"evenement": evenement.pk}).json()["total"] == 1
    assert client_sa.get("/api/invites/", {"programme": autre_evenement.programme_id}).json()["total"] == 1


def test_changement_mot_de_passe(admin):
    c = client_connecte(admin)
    r = c.post("/api/auth/mot-de-passe/", {"actuel": "MotDePasse-Test-1", "nouveau": "Nouveau-Mdp-2026"}, format="json")
    assert r.status_code == 204


def test_schema_openapi(client_sa):
    r = client_sa.get("/api/schema/")
    assert r.status_code == 200 and b"emargement" in r.content


def test_ancien_lien_reste_lisible_apres_regeneration(client_sa, evenement):
    from rest_framework.test import APIClient

    ancien = evenement.slug_inscription
    nouveau = client_sa.post(f"/api/evenements/{evenement.pk}/regenerer-slug/").json()["slugInscription"]
    public = APIClient()
    r = public.get(f"/api/public/evenements/{ancien}/")
    assert r.status_code == 200
    # l'ancien lien ne révèle jamais le nouveau et n'accepte plus d'inscriptions
    assert r.json()["slug"] == ancien and nouveau not in r.content.decode() and r.json()["etat"] == "FERME"
    r = public.get(f"/api/public/evenements/{ancien}/agenda.ics")
    assert r.status_code == 200 and nouveau not in r.content.decode()
    r = public.post(
        f"/api/public/evenements/{ancien}/inscription/",
        {"civilite": "MME", "prenom": "A", "nom": "B", "email": "a.b@exemple.ci", "telephone": "0700000000"},
        format="json",
    )
    assert r.status_code == 404
    assert public.get(f"/api/public/evenements/{nouveau}/").json()["slug"] == nouveau
