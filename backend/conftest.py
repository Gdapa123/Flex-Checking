import pytest


@pytest.fixture(autouse=True)
def _cache_vide():
    from django.core.cache import cache

    cache.clear()
    yield
