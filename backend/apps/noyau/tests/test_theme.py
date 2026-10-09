import json
from pathlib import Path

import pytest
from django.conf import settings

from apps.noyau.theme import contraste, deriver_tokens

FIXTURES = json.loads((Path(settings.ROOT_DIR) / "shared" / "token-fixtures.json").read_text())


@pytest.mark.parametrize("cas", FIXTURES["cas"], ids=lambda c: c["nom"])
def test_tokens_reference(cas):
    t = deriver_tokens(cas["principale"], cas["secondaire"])
    for cle, attendu in cas["attendu"].items():
        assert t[cle] == attendu, cle


@pytest.mark.parametrize("c", FIXTURES["contrastes"])
def test_contrastes(c):
    assert round(contraste(c["a"], c["b"]), 2) == c["ratio"]


def test_on_color_choisit_meilleur_contraste():
    assert deriver_tokens("#8F1C1F", "#FFF200")["on_secondary"] == "#141414"
    assert deriver_tokens("#8F1C1F", "#FFF200")["on_primary"] == "#FFFFFF"


def test_argon2_en_production():
    from config import settings as prod

    assert prod.PASSWORD_HASHERS[0].endswith("Argon2PasswordHasher")
