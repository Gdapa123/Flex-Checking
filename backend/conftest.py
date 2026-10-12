import pytest


@pytest.fixture(autouse=True)
def _cache_vide():
    from django.core.cache import caches

    for alias in ("default", "limites", "limites_local"):
        caches[alias].clear()
    yield
