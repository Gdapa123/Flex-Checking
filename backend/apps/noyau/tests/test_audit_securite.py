"""Audit de sécurité : contournement des limites par variantes d'email, verrouillage à distance, CSRF de la
connexion, jeton d'accès après déconnexion, session « borne libre-service », renvois d'email par un admin."""

import pytest
from rest_framework.test import APIClient

from .conftest import MDP, client_connecte, nouvel_invite
from .test_inscription import payload, url

pytestmark = pytest.mark.django_db


def _connexion(c, email, mdp, ip="203.0.113.10"):
    return c.post("/api/auth/connexion/", {"email": email, "motDePasse": mdp}, format="json", REMOTE_ADDR=ip)


# ---------------------------------------------------------------- variantes Unicode d'une adresse


@pytest.mark.parametrize("variante", ["admin@mdé.ci", "admin@ｍde.ci"])
def test_connexion_refuse_les_adresses_non_ascii(admin, variante):
    """Avec une collation MySQL insensible aux accents, « mdé.ci » = « mde.ci » : chaque variante aurait ses propres
    compteurs de tentatives. Elles sont refusées avant toute tentative d'authentification."""
    r = _connexion(APIClient(), variante, MDP)
    assert r.status_code == 400


def test_inscription_et_renvoi_refusent_les_adresses_non_ascii(client, evenement):
    r = client.post(url(evenement, "inscription/"), payload(email="aya@sïb.ci"), content_type="application/json")
    assert r.status_code == 400 and "email" in r.json()
    r = client.post(url(evenement, "renvoi-qr/"), {"email": "aya@sïb.ci"}, content_type="application/json")
    assert r.status_code == 400


# ---------------------------------------------------------------- limites de la connexion


def test_seuls_les_echecs_comptent_pour_le_compte(admin):
    """Des connexions réussies ne bloquent jamais le compte et remettent la série d'échecs à zéro ; 20 échecs
    d'affilée, toutes IP confondues, le bloquent."""
    c = APIClient()
    for i in range(19):
        assert _connexion(c, admin.email, "faux", ip=f"198.51.100.{i}").status_code == 401
    for i in range(3):
        assert _connexion(c, admin.email, MDP, ip=f"192.0.2.{i}").status_code == 200
    attaquant = APIClient()
    for i in range(20):
        assert _connexion(attaquant, admin.email, "faux", ip=f"198.51.101.{i}").status_code == 401
    # nouvel appareil : bloqué ; appareil où l'hôte s'est déjà connecté (cookie signé) : jamais bloqué par un tiers
    assert _connexion(APIClient(), admin.email, MDP, ip="192.0.2.99").status_code == 429
    assert _connexion(c, admin.email, MDP, ip="192.0.2.98").status_code == 200


def test_poste_connu_infalsifiable(admin):
    from apps.comptes.views import COOKIE_POSTE

    attaquant = APIClient()
    attaquant.cookies[COOKIE_POSTE] = "faux-cookie"
    for i in range(21):
        _connexion(attaquant, admin.email, "faux", ip=f"198.51.102.{i}")
    assert _connexion(attaquant, admin.email, MDP, ip="198.51.102.99").status_code == 429


def test_poste_connu_reste_limite(admin):
    """Sur un poste où l'hôte s'est déjà connecté (tablette perdue, borne partagée), les essais restent comptés."""
    c = APIClient()
    assert _connexion(c, admin.email, MDP).status_code == 200
    for i in range(20):
        assert _connexion(c, admin.email, "faux", ip=f"198.51.103.{i}").status_code == 401
    assert _connexion(c, admin.email, MDP, ip="198.51.103.99").status_code == 429
    # ailleurs, l'hôte n'est pas bloqué par les échecs de ce poste
    assert _connexion(APIClient(), admin.email, MDP, ip="192.0.2.50").status_code == 200


def test_rafraichissements_simultanes_sans_deconnexion(admin):
    """Deux onglets rafraîchissent en même temps : le second ne doit pas effacer les cookies du premier."""
    from datetime import timedelta

    from django.utils import timezone
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

    c = client_connecte(admin)
    ancien = c.cookies["fc_refresh"].value
    assert c.post("/api/auth/rafraichir/").status_code == 204
    second = client_connecte(admin)
    second.cookies["fc_refresh"] = ancien
    r = second.post("/api/auth/rafraichir/")
    assert r.status_code == 409 and r.json()["code"] == "SESSION_DEJA_RENOUVELEE", r.content
    assert "fc_access" not in r.cookies and "fc_refresh" not in r.cookies
    # passé le délai de course, la réutilisation d'un ancien jeton reste refusée (session expirée)
    BlacklistedToken.objects.update(blacklisted_at=timezone.now() - timedelta(minutes=5))
    assert second.post("/api/auth/rafraichir/").status_code == 401


def test_compteur_en_base_garde_sa_fenetre(settings):
    """Sans Redis (cache en base), un incrément ne doit pas ramener la fenêtre de comptage à 300 s."""
    import datetime

    from django.core.management import call_command
    from django.db import connection
    from django.utils import timezone
    from django.utils.dateparse import parse_datetime

    from apps.comptes.throttles import CacheDeSecours

    base = {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "cache_limites_test"}
    settings.CACHES = {**settings.CACHES, "limites": base}
    call_command("createcachetable", "cache_limites_test", verbosity=0)
    limites = CacheDeSecours()
    assert [limites.incrementer("essai", 3600) for _ in range(3)] == [1, 2, 3]
    with connection.cursor() as cur:
        cur.execute("SELECT expires FROM cache_limites_test WHERE cache_key LIKE %s", ["%:essai"])
        (fin,) = cur.fetchone()
    fin = parse_datetime(fin) if isinstance(fin, str) else fin
    if timezone.is_naive(fin):
        fin = timezone.make_aware(fin, datetime.UTC)
    assert (fin - timezone.now()).total_seconds() > 3000


def test_limite_par_ip_toutes_adresses_confondues(admin):
    c = APIClient()
    codes = [_connexion(c, f"inconnu{i}@mde.ci", "faux").status_code for i in range(31)]
    assert codes[:30] == [401] * 30 and codes[30] == 429


def test_connexion_exige_le_csrf():
    c = APIClient(enforce_csrf_checks=True)
    assert _connexion(c, "admin@mde.ci", MDP).status_code == 403


def test_connexion_refuse_un_formulaire_multipart(admin):
    """Un formulaire posté depuis un autre site (multipart) n'est jamais interprété."""
    r = APIClient().post("/api/auth/connexion/", {"email": admin.email, "mot_de_passe": MDP})
    assert r.status_code == 415


def test_deconnexion_revoque_le_jeton_d_acces(admin, evenement):
    c = client_connecte(admin)
    acces = c.cookies["fc_access"].value
    assert c.post("/api/auth/deconnexion/").status_code == 204
    vole = APIClient()
    vole.cookies["fc_access"] = acces
    assert vole.get(f"/api/evenements/{evenement.pk}/invites/").status_code == 401
    # les autres appareils du compte restent connectés
    autre = client_connecte(admin)
    assert autre.get(f"/api/evenements/{evenement.pk}/invites/").status_code == 200


# ---------------------------------------------------------------- borne libre-service


@pytest.fixture
def borne(admin, evenement):
    c = client_connecte(admin)
    assert c.post("/api/auth/borne/").status_code == 204
    return c


def test_borne_ne_donne_acces_qu_au_scan(borne, admin, evenement):
    inv = nouvel_invite(evenement, email="awa@sib.ci", nom="Traoré", prenom="Awa")
    assert borne.get("/api/auth/moi/").json()["borne"] is True
    # liste complète des invités, fiche, export, statistiques, annulation : refusés
    for chemin in (
        f"/api/evenements/{evenement.pk}/invites/",
        f"/api/invites/{inv.pk}/",
        f"/api/evenements/{evenement.pk}/invites/export/",
        f"/api/evenements/{evenement.pk}/statistiques/",
        f"/api/evenements/{evenement.pk}/",
    ):
        assert borne.get(chemin).status_code == 403, chemin
    assert borne.post(f"/api/invites/{inv.pk}/renvoi-email/", {}, format="json").status_code == 403
    # autorisé : liste des cérémonies, réglages du scan, compteurs sans noms, émargement
    assert borne.get("/api/evenements/").status_code == 200
    assert borne.get("/api/parametres/scan/").status_code == 200
    r = borne.get(f"/api/evenements/{evenement.pk}/emargements/recents/").json()
    assert r["passages"] == [] and r["inscrits"] == 1
    corps = {"code": inv.code, "mode": "CODE", "appareil": "TABLETTE"}
    e = borne.post(f"/api/evenements/{evenement.pk}/emargement/", corps, format="json")
    assert e.status_code == 200 and e.json()["resultat"] == "PRESENT"
    assert borne.post(f"/api/emargements/{e.json()['emargementId']}/annulation/", {}, format="json").status_code == 403
    # changement de mot de passe interdit depuis la borne
    r = borne.post("/api/auth/mot-de-passe/", {"actuel": MDP, "nouveau": "Autre-Mdp-2026"}, format="json")
    assert r.status_code == 403


def test_recherche_de_la_borne_reduite(borne, evenement):
    nouvel_invite(evenement, email="awa@sib.ci", nom="Traoré", prenom="Awa", entreprise="SIB")
    base = f"/api/evenements/{evenement.pk}/borne/recherche/"
    assert borne.get(base, {"q": "Tr"}).json() == {"total": 0, "resultats": []}  # moins de 3 caractères
    assert borne.get(base, {"q": ""}).json()["total"] == 0
    r = borne.get(base, {"q": "Traor"}).json()
    assert r["total"] == 1
    assert set(r["resultats"][0]) == {"id", "choix", "nomComplet", "entreprise", "statut", "presentLe"}  # ni email
    assert borne.get(base, {"q": "awa@sib.ci"}).json()["total"] == 0  # pas de recherche par email
    # chaque mot compte au moins 3 caractères : des lettres isolées ne listent pas les invités
    assert borne.get(base, {"q": "a e i"}).json()["total"] == 0
    assert borne.get(base, {"q": "Tr a"}).json()["total"] == 0


def test_mode_borne_conserve_au_rafraichissement(borne, evenement):
    assert borne.post("/api/auth/rafraichir/").status_code == 204
    assert borne.get("/api/auth/moi/").json()["borne"] is True
    assert borne.get(f"/api/evenements/{evenement.pk}/invites/").status_code == 403


def test_mot_de_passe_de_l_hote_rend_une_session_complete(borne, evenement):
    acces_borne = borne.cookies["fc_access"].value
    r = borne.post("/api/auth/verifier-mot-de-passe/", {"motDePasse": MDP}, format="json")
    assert r.status_code == 204
    assert borne.get("/api/auth/moi/").json()["borne"] is False
    assert borne.get(f"/api/evenements/{evenement.pk}/invites/").status_code == 200
    # l'ancien jeton de la borne ne vaut plus rien
    ancien = APIClient()
    ancien.cookies["fc_access"] = acces_borne
    assert ancien.get("/api/evenements/").status_code == 401


# ---------------------------------------------------------------- renvois d'email par un admin


def test_renvois_d_email_limites_par_invite(client_admin, evenement):
    inv = nouvel_invite(evenement, email="awa@sib.ci")
    codes = [client_admin.post(f"/api/invites/{inv.pk}/renvoi-email/", {}, format="json").status_code for _ in range(6)]
    assert codes[:5] == [202] * 5 and codes[5] == 429


def test_limites_par_ip_regroupent_ipv6_par_prefixe_64():
    from apps.comptes.throttles import ident_reseau

    assert ident_reseau("203.0.113.7") == "203.0.113.7"
    assert ident_reseau("::ffff:203.0.113.7") == "203.0.113.7"
    assert ident_reseau("2001:db8:1:2:aaaa::1") == ident_reseau("2001:db8:1:2:ffff::9") == "2001:db8:1:2::/64"
    assert ident_reseau("2001:db8:1:3::1") != ident_reseau("2001:db8:1:2::1")
    assert ident_reseau("inconnu") == "inconnu"


def test_borne_emarge_seulement_un_nom_propose_par_la_recherche(borne, evenement):
    a = nouvel_invite(evenement, email="awa@sib.ci", nom="Traoré", prenom="Awa")
    b = nouvel_invite(evenement, email="yao@sib.ci", nom="Kouadio", prenom="Yao")
    url_emargement = f"/api/evenements/{evenement.pk}/emargement/"
    corps = {"mode": "MANUEL", "appareil": "TABLETTE"}
    # identifiant seul (boucle inviteId=1..N) : refusé
    r = borne.post(url_emargement, {**corps, "inviteId": a.pk}, format="json")
    assert r.status_code == 403 and r.json()["code"] == "CHOIX_BORNE_INVALIDE"
    choix = borne.get(f"/api/evenements/{evenement.pk}/borne/recherche/", {"q": "Traoré"}).json()["resultats"][0]
    # jeton d'un autre invité : refusé
    r = borne.post(url_emargement, {**corps, "inviteId": b.pk, "choixBorne": choix["choix"]}, format="json")
    assert r.status_code == 403
    r = borne.post(url_emargement, {**corps, "inviteId": a.pk, "choixBorne": choix["choix"]}, format="json")
    assert r.status_code == 200 and r.json()["resultat"] == "PRESENT"


def test_borne_ne_voit_ni_hotes_ni_lien_d_inscription(borne, evenement):
    ev = borne.get("/api/evenements/").json()[0]
    assert set(ev) == {"id", "nomAffiche", "date", "statut", "tokens", "nbInscrits", "nbPresents"}


def test_rafraichissement_exige_le_csrf(admin):
    c = client_connecte(admin)
    c.credentials()  # plus d'en-tête X-CSRFToken
    assert c.post("/api/auth/rafraichir/").status_code == 403


def test_jetons_et_traces_masques_dans_les_journaux():
    import logging

    from apps.noyau.logs import MasquerDonneesPersonnelles, MasquerParametresUrl

    try:
        raise ValueError("Duplicate entry '12-aya@exemple.ci'")
    except ValueError:
        import sys

        rec = logging.LogRecord("x", logging.ERROR, "", 0, "erreur /sondage/abcDEF123", (), sys.exc_info())
    MasquerDonneesPersonnelles().filter(rec)
    assert "abcDEF123" not in rec.getMessage() and "aya@exemple.ci" not in rec.exc_text
    acces = logging.LogRecord(
        "u", logging.INFO, "", 0, '%s - "%s %s"', ("1.2.3.4", "GET", "/api/public/sondages/jeton123/"), None
    )
    MasquerParametresUrl().filter(acces)
    assert "jeton123" not in acces.getMessage()
