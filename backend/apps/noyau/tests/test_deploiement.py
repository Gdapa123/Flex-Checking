"""Environnement sans Redis (Vercel) : base configurée par URL et limites anti-abus partagées."""

import environ
import pytest
from django.core.cache import caches
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APIClient

from config.bases import base_depuis_url, caches_sans_redis


def _url(url):
    return environ.Env.db_url_config(url)


def test_url_postgres_options_conservees():
    base = base_depuis_url(_url("postgres://u:p@h/db?sslmode=verify-full&channel_binding=require"))
    assert base["OPTIONS"]["sslmode"] == "verify-full"  # jamais abaissé à « require »
    assert base["OPTIONS"]["channel_binding"] == "require"
    assert base["OPTIONS"]["connect_timeout"] == 5
    assert base["CONN_MAX_AGE"] == 0


def test_url_postgres_chiffrement_impose_par_defaut():
    assert base_depuis_url(_url("postgres://u:p@h/db"))["OPTIONS"]["sslmode"] == "require"
    assert base_depuis_url(_url("postgres://u:p@h/db"), "verify-full")["OPTIONS"]["sslmode"] == "verify-full"


def test_url_mysql_sans_sslmode():
    assert "sslmode" not in base_depuis_url(_url("mysql://u:p@h/db"))["OPTIONS"]


def test_pool_postgres_garde_le_chiffrement():
    """Le pool réutilise les connexions sans rien changer à leur sécurité ; jamais de pool pour MySQL."""
    base = base_depuis_url(_url("postgres://u:p@h/db?channel_binding=require"), "verify-full", pool_max=10)
    assert base["OPTIONS"]["sslmode"] == "verify-full"
    assert base["OPTIONS"]["channel_binding"] == "require"
    assert base["OPTIONS"]["pool"]["max_size"] == 10
    assert base["CONN_HEALTH_CHECKS"] is True  # connexion coupée détectée avant usage
    assert base["CONN_MAX_AGE"] == 0  # exigé par Django avec un pool
    assert "pool" not in base_depuis_url(_url("postgres://u:p@h/db"))["OPTIONS"]
    assert "pool" not in base_depuis_url(_url("mysql://u:p@h/db"), pool_max=10)["OPTIONS"]


@pytest.mark.django_db(transaction=True)
def test_limites_connexion_partagees_entre_instances():
    """Sans Redis, une nouvelle instance (mémoire locale vide) ne remet pas le compteur de connexion à zéro."""
    with override_settings(CACHES=caches_sans_redis()):
        call_command("createcachetable", verbosity=0)
        try:
            corps = {"email": "cible@mde.ci", "motDePasse": "mauvais-mot-de-passe"}
            codes = [APIClient().post("/api/auth/connexion/", corps, format="json").status_code for _ in range(5)]
            assert 429 not in codes
            caches["default"].clear()
            caches["limites_local"].clear()  # nouvelle instance : mémoire du processus vide
            assert APIClient().post("/api/auth/connexion/", corps, format="json").status_code == 429
        finally:
            caches["limites"].clear()


def test_envoi_sans_file_une_seule_tentative(evenement, settings):
    """Sans worker (Vercel), un email en échec ne bloque pas la requête par 4 tentatives d'affilée."""
    from apps.noyau.emails import planifier
    from apps.noyau.models import EmailEnvoye, StatutEmail, TypeEmail

    from .conftest import nouvel_invite

    inv = nouvel_invite(evenement)
    settings.ENVOI_SANS_FILE = True
    settings.EMAIL_BACKEND = "apps.noyau.tests.test_emails.BackendEnPanne"
    e = planifier(inv, TypeEmail.INVITATION)
    e = EmailEnvoye.objects.get(pk=e.pk)
    assert e.statut == StatutEmail.ECHEC and e.tentatives == 1


def test_compteur_de_codes_invalides_partage(client_admin, evenement):
    """Le verrouillage après trop de codes invalides tient même si la mémoire locale est vidée
    (autre instance, redémarrage)."""
    from django.core.cache import caches

    from apps.noyau.vues_scan import MAX_CODES_INVALIDES

    url = f"/api/evenements/{evenement.pk}/emargement/"
    corps = {"code": "0000", "mode": "CODE", "appareil": "ORDINATEUR"}
    for _ in range(MAX_CODES_INVALIDES):
        client_admin.post(url, corps, format="json")
    caches["limites_local"].clear()
    caches["default"].clear()
    assert client_admin.post(url, corps, format="json").status_code == 429
