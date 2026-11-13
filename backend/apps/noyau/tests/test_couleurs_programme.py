"""Couleur du texte (sur la couleur principale) et couleur des titres (sur fond blanc), réglées par programme
(2026-11-10). Vides = automatiques."""

from apps.noyau.emails import Source, rendre
from apps.noyau.models import TypeEmail
from apps.noyau.theme import tokens_du_programme

from .conftest import nouvel_invite


def test_automatiques_par_defaut(programme):
    t = tokens_du_programme(programme)
    assert programme.couleur_texte == "" and programme.couleur_titres == ""
    assert t["on_primary"] == "#FFFFFF" and t["heading"] == "#1B1D20"


def test_reglage_par_le_super_admin(client_sa, programme):
    url = f"/api/programmes/{programme.pk}/"
    r = client_sa.patch(url, {"couleurTexte": "#fff8e0", "couleurTitres": "#8f1c1f"}, format="json")
    assert r.status_code == 200
    d = r.json()
    assert d["couleurTexte"] == "#FFF8E0" and d["couleurTitres"] == "#8F1C1F"
    assert d["tokens"]["op"] == "#FFF8E0" and d["tokens"]["ti"] == "#8F1C1F"
    # retour à l'automatique
    r = client_sa.patch(url, {"couleurTexte": "", "couleurTitres": ""}, format="json")
    assert r.json()["tokens"]["op"] == "#FFFFFF" and r.json()["tokens"]["ti"] == "#1B1D20"


def test_couleur_invalide_refusee(client_sa, programme):
    for valeur in ("rouge", "#12345", "#GGGGGG", "javascript:alert(1)"):
        r = client_sa.patch(f"/api/programmes/{programme.pk}/", {"couleurTexte": valeur}, format="json")
        assert r.status_code == 400, valeur


def test_reserve_au_super_admin(client_admin, programme):
    r = client_admin.patch(f"/api/programmes/{programme.pk}/", {"couleurTitres": "#000000"}, format="json")
    assert r.status_code == 403


def test_page_publique_et_emails(client, evenement):
    prog = evenement.programme
    prog.couleur_texte, prog.couleur_titres = "#FFF8E0", "#123456"
    prog.save()
    d = client.get(f"/api/public/evenements/{evenement.slug_inscription}/").json()
    assert d["tokens"]["op"] == "#FFF8E0" and d["tokens"]["ti"] == "#123456"
    r = rendre(TypeEmail.INVITATION, Source.depuis_invite(nouvel_invite(evenement)))
    assert "color:#123456" in r["html"]  # titres
    assert "color:#FFF8E0" in r["html"]  # texte du bouton principal
    assert "logo-blanc-" in r["html"]  # logo choisi selon le fond, pas selon le texte choisi
