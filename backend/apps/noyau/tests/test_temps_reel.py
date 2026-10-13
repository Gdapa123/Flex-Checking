"""WebSocket temps réel : authentification, origine, périmètre par événement et notifications."""

from datetime import timedelta

import pytest
from asgiref.sync import async_to_sync, sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application

from .conftest import nouvel_invite

pytestmark = pytest.mark.django_db

ORIGINE = (b"origin", b"http://localhost")


@pytest.fixture(autouse=True)
def _garder_connexion_de_test(monkeypatch):
    """Channels ferme les connexions « obsolètes » autour de chaque accès base ; dans un test, la
    connexion est dans une transaction englobante et doit rester ouverte."""
    monkeypatch.setattr("channels.db.close_old_connections", lambda: None)


def _communicateur(user=None, jeton=None, origine=ORIGINE):
    entetes = [origine] if origine else []
    if user is not None or jeton is not None:
        entetes.append((b"cookie", f"fc_access={jeton or AccessToken.for_user(user)}".encode()))
    return WebsocketCommunicator(application, "/api/ws/", headers=entetes)


def ecouter(user=None, action=None, **kw):
    """Se connecte, exécute `action` (code synchrone, accès base), puis rend les messages reçus et le
    code de fermeture éventuel."""

    async def scenario():
        ws = _communicateur(user, **kw)
        connecte, _ = await ws.connect()
        if not connecte:
            return None, []
        recus, fermeture = [], None
        premier = await ws.receive_output(timeout=2)  # « pret » ou fermeture immédiate
        if premier["type"] == "websocket.close":
            return premier.get("code"), []
        for etape in action if isinstance(action, list) else [action] if action else []:
            await sync_to_async(etape)()
            # receive_nothing n'interrompt pas l'application (contrairement à un délai dépassé sur receive_output)
            while fermeture is None and not await ws.receive_nothing(timeout=0.3):
                sortie = await ws.receive_output()
                if sortie["type"] == "websocket.close":
                    fermeture = sortie.get("code")
                else:
                    recus.append(sortie["text"])
        if fermeture is None:
            await ws.disconnect()
        return fermeture, recus

    return async_to_sync(scenario)()


def test_sans_session_ferme_4001():
    fermeture, recus = ecouter()
    assert fermeture == 4001 and recus == []


def test_jeton_expire_ferme_4001(admin):
    jeton = AccessToken.for_user(admin)
    jeton.set_exp(lifetime=-timedelta(seconds=1))
    fermeture, _ = ecouter(jeton=str(jeton))
    assert fermeture == 4001


def test_origine_inconnue_refusee(admin):
    fermeture, recus = ecouter(admin, origine=(b"origin", b"https://site-pirate.example"))
    assert fermeture is None and recus == []  # poignée de main refusée


def test_compte_desactive_ferme_4003(admin):
    admin.actif = False
    admin.save()
    fermeture, _ = ecouter(admin)
    assert fermeture == 4003


def test_admin_notifie_pour_son_evenement_seulement(admin, evenement, autre_evenement):
    _, recus = ecouter(admin, action=lambda: nouvel_invite(evenement))
    assert any('"invites"' in m and f"[{evenement.pk}]" in m for m in recus)
    assert all("nom" not in m.lower() or "kouassi" not in m.lower() for m in recus)  # aucune donnée personnelle

    _, recus = ecouter(admin, action=lambda: nouvel_invite(autre_evenement, email="x@sib.ci"))
    assert recus == []


def test_super_admin_notifie_pour_tous(super_admin, autre_evenement):
    _, recus = ecouter(super_admin, action=lambda: nouvel_invite(autre_evenement))
    assert any('"statistiques"' in m for m in recus)


def test_desactivation_en_cours_de_connexion(admin):
    def desactiver():
        admin.actif = False
        admin.save()

    fermeture, _ = ecouter(admin, action=desactiver)
    assert fermeture == 4003


def test_affectation_met_a_jour_le_perimetre(admin, autre_evenement):
    _, recus = ecouter(
        admin, action=[lambda: autre_evenement.admins.add(admin), lambda: nouvel_invite(autre_evenement)]
    )
    assert any('"moi"' in m for m in recus)
    assert any(f"[{autre_evenement.pk}]" in m for m in recus)


def test_sans_relais_temps_reel_ferme_4004(admin, monkeypatch):
    """Sans Redis (environnement de test Vercel), code explicite : le navigateur affiche « Actualisation auto »
    au lieu de « Reconnexion… » et n'insiste pas."""
    monkeypatch.setattr("channels.consumer.get_channel_layer", lambda alias=None: None)
    fermeture, recus = ecouter(admin)
    assert fermeture == 4004 and recus == []
