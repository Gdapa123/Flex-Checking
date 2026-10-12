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
