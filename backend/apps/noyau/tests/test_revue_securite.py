"""Revue de sécurité du 2026-11-13 : corrections vérifiées."""

import asyncio
import json

import pytest
from django.core import mail
from rest_framework.test import APIClient

from apps.comptes.models import Admin
from apps.noyau.models import JournalActivite
from config.concurrence import LimiteConcurrence

from .conftest import DONNEES, MDP, client_connecte, nouvel_invite
from .test_emargement import scan

pytestmark = pytest.mark.django_db


def test_qr_autre_ceremonie_nom_visible_seulement_dans_le_perimetre(
    client_admin, client_sa, evenement, autre_evenement
):
    autre = nouvel_invite(autre_evenement, email="b@sib.ci")
    assert scan(client_admin, evenement, qrToken=autre.qr_token).json()["evenementAutre"] is None
    assert scan(client_sa, evenement, qrToken=autre.qr_token).json()["evenementAutre"] == autre_evenement.nom_affiche


def test_lieu_sur_une_ligne_et_objet_sans_saut_de_ligne(client_sa, evenement):
    r = client_sa.patch(f"/api/evenements/{evenement.pk}/", {"lieu": "Salle A\nBcc: x@y.ci"}, format="json")
    assert r.status_code == 400 and "lieu" in r.json(), r.content

    from apps.noyau import emails

    assert emails._remplacer("Graduation {lieu}", {"lieu": "A\nB"}) == "Graduation A\nB"
    evenement.lieu = "Salle A\nBcc: x@y.ci"  # valeur ancienne en base : l'objet reste sur une ligne
    evenement.save(update_fields=["lieu"])
    inv = nouvel_invite(evenement, email="c@sib.ci")
    for message in mail.outbox:
        assert "\n" not in message.subject and "\r" not in message.subject
    assert inv.pk


@pytest.mark.parametrize(
    "champ,valeur",
    [
        ("prenom", "Urgent : réglez sur https://payer-mde.co"),
        ("prenom", "Voir www.payer.ci"),
        ("nom", "payer-mde.co"),
        ("nom", "a@b.ci"),
        ("entreprise", "SIB https://x.ci"),
        ("fonction", "www.x.com"),
    ],
)
def test_liens_refuses_dans_les_champs_d_un_invite(evenement, champ, valeur):
    r = APIClient().post(
        f"/api/public/evenements/{evenement.slug_inscription}/inscription/",
        {**DONNEES, "fonction": "Directrice", champ: valeur, "consentementDonnees": True},
        format="json",
    )
    assert r.status_code == 400 and champ in json.dumps(r.json()), r.content


def test_noms_ordinaires_acceptes(evenement):
    r = APIClient().post(
        f"/api/public/evenements/{evenement.slug_inscription}/inscription/",
        {
            **DONNEES,
            "prenom": "J.-B. Marie",
            "nom": "N'Guessan-Koffi",
            "entreprise": "Jumia.ci",
            "fonction": "Directrice",
            "consentementDonnees": True,
        },
        format="json",
    )
    assert r.status_code == 201, r.content


def test_connexion_renouvelle_le_jeton_csrf(admin):
    c = APIClient(enforce_csrf_checks=True)
    c.get("/api/auth/csrf/")
    avant = c.cookies["fc_csrftoken"].value
    c.credentials(HTTP_X_CSRFTOKEN=avant)
    r = c.post("/api/auth/connexion/", {"email": admin.email, "motDePasse": MDP}, format="json")
    assert r.status_code == 200
    assert r.cookies["fc_csrftoken"].value != avant


def test_jeton_reutilise_ferme_toutes_les_sessions(admin):
    from datetime import timedelta

    from django.utils import timezone
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

    victime = client_connecte(admin)
    vole = victime.cookies["fc_refresh"].value
    voleur = client_connecte(admin)
    voleur.cookies["fc_refresh"] = vole
    assert voleur.post("/api/auth/rafraichir/").status_code == 204  # le voleur passe en premier
    BlacklistedToken.objects.update(blacklisted_at=timezone.now() - timedelta(minutes=5))
    version = Admin.objects.get(pk=admin.pk).version_session
    victime.cookies["fc_refresh"] = vole
    assert victime.post("/api/auth/rafraichir/").status_code == 401
    assert Admin.objects.get(pk=admin.pk).version_session == version + 1
    assert JournalActivite.objects.filter(action="SESSION_REUTILISEE", cible_id=admin.pk).count() == 1
    # la session du voleur est fermée elle aussi
    assert voleur.get("/api/auth/moi/").status_code == 401
    assert voleur.post("/api/auth/rafraichir/").status_code == 401


def _executer(application, messages, attente=0.0):
    envoyes, file = [], list(messages)

    async def recevoir():
        if attente:
            await asyncio.sleep(attente)
        return file.pop(0) if file else {"type": "http.disconnect"}

    async def envoyer(m):
        envoyes.append(m)

    scope = {"type": "http", "path": "/api/x/"}
    return envoyes, recevoir, envoyer, scope


def test_corps_lu_avant_de_prendre_une_place(monkeypatch):
    """Un envoi lent n'occupe pas de place de la file ; le corps est transmis intact à l'application."""
    import config.concurrence as c

    monkeypatch.setattr(c, "LECTURE_CORPS_MAX", 0.05)
    recu = {}

    async def application(scope, receive, send):
        m = await receive()
        recu["corps"] = m["body"]
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    limite = LimiteConcurrence(application, limite=1)

    async def scenario():
        # client lent : refusé (408) sans avoir pris l'unique place
        envoyes, recevoir, envoyer, scope = _executer(
            application, [{"type": "http.request", "body": b"x", "more_body": True}], attente=1
        )
        await limite(scope, recevoir, envoyer)
        assert envoyes[0]["status"] == 408
        # corps en deux morceaux : rejoué à l'application
        envoyes, recevoir, envoyer, scope = _executer(
            application,
            [{"type": "http.request", "body": b"ab", "more_body": True}, {"type": "http.request", "body": b"cd"}],
        )
        await limite(scope, recevoir, envoyer)
        assert envoyes[0]["status"] == 200
        assert limite.semaphore._value == 1

    asyncio.run(scenario())
    assert recu["corps"] == b"ab"
