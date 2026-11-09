"""Jetons de session (JWT) : la méthode de signature et le contenu ne peuvent pas être modifiés par le client.

Chaque test part d'un vrai jeton d'accès (cookie `fc_access` rendu par la connexion), le modifie comme le ferait
un attaquant, puis le présente à l'API : il doit être refusé (401), jamais accepté ni provoquer d'erreur serveur.
"""

import base64
import json
from datetime import timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from django.conf import settings
from django.utils.timezone import now as timezone_now
from rest_framework.test import APIClient
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken

from apps.comptes.jetons import purger_jetons

from .conftest import client_connecte

pytestmark = pytest.mark.django_db


def b64(donnees):
    return base64.urlsafe_b64encode(json.dumps(donnees, separators=(",", ":")).encode()).rstrip(b"=").decode()


def decouper(jeton):
    entete, contenu, signature = jeton.split(".")
    pad = lambda s: s + "=" * (-len(s) % 4)  # noqa: E731
    return (
        json.loads(base64.urlsafe_b64decode(pad(entete))),
        json.loads(base64.urlsafe_b64decode(pad(contenu))),
        signature,
    )


@pytest.fixture
def session(admin):
    client = client_connecte(admin)
    return client, client.cookies[settings.JWT_COOKIE_ACCESS].value


def appel(jeton, cookie=settings.JWT_COOKIE_ACCESS):
    client = APIClient()
    client.cookies[cookie] = jeton
    return client.get("/api/auth/moi/")


def test_configuration_imposee():
    assert api_settings.ALGORITHM == "HS256"
    assert api_settings.SIGNING_KEY == settings.JWT_SIGNING_KEY != settings.SECRET_KEY
    assert len(api_settings.SIGNING_KEY) >= 32
    assert api_settings.ISSUER == "flex-checking" and api_settings.AUDIENCE == "flex-checking-api"
    assert api_settings.JWK_URL is None and api_settings.LEEWAY == 0


def test_jeton_authentique_accepte_et_sans_donnee_personnelle(session, admin):
    _, jeton = session
    assert appel(jeton).status_code == 200
    entete, contenu, _ = decouper(jeton)
    assert entete == {"alg": "HS256", "typ": "JWT"}
    assert contenu["iss"] == "flex-checking" and contenu["aud"] == "flex-checking-api"
    # uniquement des identifiants techniques et des dates : ni email, ni nom, ni rôle, ni mot de passe
    assert set(contenu) <= {"token_type", "exp", "iat", "jti", "user_id", "vs", "borne", "iss", "aud"}
    assert admin.email not in json.dumps(contenu) and admin.nom not in json.dumps(contenu)


def test_alg_none_refuse(session):
    _, jeton = session
    entete, contenu, _ = decouper(jeton)
    for alg in ("none", "None", "NONE"):
        assert appel(f"{b64({**entete, 'alg': alg})}.{b64(contenu)}.").status_code == 401


def test_changement_d_algorithme_refuse_meme_avec_la_bonne_cle(session):
    # l'attaquant connaîtrait la clé : un autre algorithme annoncé dans l'en-tête reste refusé
    _, jeton = session
    _, contenu, _ = decouper(jeton)
    for alg in ("HS384", "HS512"):
        forge = jwt.encode(contenu, settings.JWT_SIGNING_KEY, algorithm=alg)
        assert appel(forge).status_code == 401, alg


def test_cle_rsa_inseree_dans_l_entete_refusee(session):
    # confusion d'algorithme : RS256 signé avec la clé de l'attaquant, clé publique jointe dans l'en-tête (« jwk »)
    _, jeton = session
    _, contenu, _ = decouper(jeton)
    cle = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(cle.public_key()))
    forge = jwt.encode(contenu, cle, algorithm="RS256", headers={"jwk": jwk, "kid": "attaquant"})
    assert appel(forge).status_code == 401
    forge = jwt.encode(contenu, settings.JWT_SIGNING_KEY, algorithm="HS256", headers={"jku": "https://pirate.example/"})
    # en-tête « jku » ignoré : aucune clé n'est jamais téléchargée ; signature correcte → reste un jeton valide
    assert appel(forge).status_code == 200


def test_contenu_modifie_refuse(session, super_admin):
    # devenir un autre compte (super admin) ou sortir du mode borne en gardant la signature d'origine
    _, jeton = session
    entete, contenu, signature = decouper(jeton)
    for modif in ({"user_id": super_admin.pk}, {"exp": contenu["exp"] + 86400}, {"vs": contenu.get("vs", 0) + 1}):
        assert appel(f"{b64(entete)}.{b64({**contenu, **modif})}.{signature}").status_code == 401, modif


def test_ancienne_cle_et_autre_emetteur_refuses(session):
    _, jeton = session
    _, contenu, _ = decouper(jeton)
    # signé avec le secret Django au lieu de la clé propre aux JWT
    assert appel(jwt.encode(contenu, settings.SECRET_KEY, algorithm="HS256")).status_code == 401
    # bonne clé, mais émetteur ou destinataire différent, ou absent (jetons émis avant ce durcissement)
    for modif in ({"iss": "autre-systeme"}, {"aud": "autre-api"}):
        assert appel(jwt.encode({**contenu, **modif}, settings.JWT_SIGNING_KEY, algorithm="HS256")).status_code == 401
    for claim in ("iss", "aud"):
        sans = {k: v for k, v in contenu.items() if k != claim}
        assert appel(jwt.encode(sans, settings.JWT_SIGNING_KEY, algorithm="HS256")).status_code == 401, claim


def test_rafraichissement_et_temps_reel_refusent_un_jeton_forge(session):
    client, jeton = session
    refresh = client.cookies[settings.JWT_COOKIE_REFRESH].value
    entete, contenu, _ = decouper(refresh)
    forge = f"{b64({**entete, 'alg': 'none'})}.{b64(contenu)}."
    c = APIClient(enforce_csrf_checks=True)
    c.get("/api/auth/csrf/")
    c.credentials(HTTP_X_CSRFTOKEN=c.cookies["fc_csrftoken"].value)
    c.cookies[settings.JWT_COOKIE_REFRESH] = forge
    assert c.post("/api/auth/rafraichir/").status_code == 401
    # WebSocket : le consommateur lit le jeton avec AccessToken, qui vérifie la même signature
    e, p, _ = decouper(jeton)
    with pytest.raises(TokenError):
        AccessToken(f"{b64({**e, 'alg': 'none'})}.{b64(p)}.")
    with pytest.raises(TokenError):
        AccessToken(jwt.encode(p, settings.JWT_SIGNING_KEY, algorithm="HS512"))


def test_marqueur_borne_retire_refuse(admin):
    # une borne libre-service ne peut pas se donner une session complète en retirant « borne » du jeton
    borne = client_connecte(admin)
    assert borne.post("/api/auth/borne/").status_code == 204
    entete, contenu, signature = decouper(borne.cookies[settings.JWT_COOKIE_ACCESS].value)
    assert contenu["borne"] is True
    sans_borne = {k: v for k, v in contenu.items() if k != "borne"}
    assert appel(f"{b64(entete)}.{b64(sans_borne)}.{signature}").status_code == 401
    assert appel(f"{b64(entete)}.{b64({**contenu, 'borne': False})}.{signature}").status_code == 401


def test_jeton_de_rafraichissement_jamais_stocke_en_base(admin):
    client = client_connecte(admin)
    assert OutstandingToken.objects.filter(user=admin).exists()
    assert not OutstandingToken.objects.exclude(token="").exists()
    # la session continue de fonctionner : rotation, liste noire de l'ancien jeton, déconnexion
    ancien = client.cookies[settings.JWT_COOKIE_REFRESH].value
    assert client.post("/api/auth/rafraichir/").status_code == 204
    assert BlacklistedToken.objects.filter(token__jti=decouper(ancien)[1]["jti"]).exists()
    assert not OutstandingToken.objects.exclude(token="").exists()
    rejeu = APIClient(enforce_csrf_checks=True)
    rejeu.get("/api/auth/csrf/")
    rejeu.credentials(HTTP_X_CSRFTOKEN=rejeu.cookies["fc_csrftoken"].value)
    rejeu.cookies[settings.JWT_COOKIE_REFRESH] = ancien
    assert rejeu.post("/api/auth/rafraichir/").status_code in (401, 409)  # 409 : course entre onglets (< 30 s)
    assert client.get("/api/auth/moi/").status_code == 200
    assert client.post("/api/auth/deconnexion/").status_code == 204


def test_purge_vide_les_anciens_jetons_et_supprime_les_expires(admin):
    from django.utils import timezone

    maintenant = timezone.now()
    ancien = OutstandingToken.objects.create(user=admin, jti="a" * 32, token="x", expires_at=maintenant)
    OutstandingToken.objects.filter(pk=ancien.pk).update(
        token="eyJ.ancien.jeton", expires_at=maintenant + timedelta(hours=1)
    )
    expire = OutstandingToken.objects.create(
        user=admin, jti="b" * 32, token="", expires_at=maintenant - timedelta(hours=1)
    )
    resultat = purger_jetons()
    assert resultat == {"textesVides": 1, "supprimes": 1}
    assert OutstandingToken.objects.get(pk=ancien.pk).token == ""
    assert not OutstandingToken.objects.filter(pk=expire.pk).exists()


def test_cron_purge_les_jetons(settings, admin):
    settings.CRON_SECRET = "s" * 40
    OutstandingToken.objects.create(user=admin, jti="c" * 32, token="", expires_at=timezone_now() - timedelta(days=1))
    r = APIClient().get("/api/taches-planifiees/sondages/", HTTP_AUTHORIZATION=f"Bearer {'s' * 40}")
    assert r.status_code == 200 and r.json()["jetons"]["supprimes"] == 1


def test_jwt_masque_dans_les_journaux_et_les_erreurs(session):
    import logging

    from apps.noyau.erreurs import enregistrer
    from apps.noyau.logs import MasquerDonneesPersonnelles
    from apps.noyau.models import ErreurTechnique

    _, jeton = session
    record = logging.LogRecord("x", logging.ERROR, __file__, 1, "jeton refusé : %s", (jeton,), None)
    MasquerDonneesPersonnelles().filter(record)
    assert jeton not in record.getMessage() and "[jwt]" in record.getMessage()
    enregistrer("SERVEUR", "TokenError", f"jeton {jeton}", details=f"cookie fc_access={jeton}")
    e = ErreurTechnique.objects.latest("pk")
    assert jeton not in e.message and jeton not in e.details
