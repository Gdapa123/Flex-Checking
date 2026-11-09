"""Carte d'invitation du programme téléversée par le super admin (fichier, pas un lien) et jointe à l'agenda."""

import base64
import io

import pytest
from PIL import Image

from apps.noyau.ics import ics_evenement
from apps.noyau.models import CarteInvitation, JournalActivite

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def png(taille=(60, 40), exif=False):
    sortie = io.BytesIO()
    image = Image.new("RGB", taille, (200, 30, 30))
    if exif:
        donnees = Image.Exif()
        donnees[0x010F] = "Appareil secret"  # Make
        image.save(sortie, "JPEG", exif=donnees)
    else:
        image.save(sortie, "PNG")
    return sortie.getvalue()


def envoyer(client, ev, donnees, nom="carte.png"):
    return client.put(
        f"/api/evenements/{ev.pk}/carte-invitation/",
        {"nom": nom, "contenu": base64.b64encode(donnees).decode()},
        format="json",
    )


def test_televersement_png_puis_agenda_et_page_publique(client_sa, client, evenement):
    r = envoyer(client_sa, evenement, png())
    assert r.status_code == 200
    carte = r.json()["carteInvitation"]
    assert carte["nom"] == "carte.png" and carte["type"] == "image/png" and carte["taille"] > 0
    assert carte["lien"].endswith(f"/api/public/evenements/{evenement.slug_inscription}/carte-invitation/")
    assert JournalActivite.objects.filter(action="CARTE_INVITATION_AJOUT", cible_id=evenement.pk).exists()

    pub = client.get(f"/api/public/evenements/{evenement.slug_inscription}/carte-invitation/")
    assert pub.status_code == 200 and pub["Content-Type"] == "image/png"
    assert pub.content.startswith(b"\x89PNG")
    assert "sandbox" in pub["Content-Security-Policy"]

    ics = ics_evenement(evenement).decode()
    assert f"ATTACH;FMTTYPE=image/png:{carte['lien']}" in ics
    assert carte["lien"] in ics.replace("\\n", "\n")


def test_pdf_accepte_tel_quel(client_sa, evenement):
    r = envoyer(client_sa, evenement, PDF, nom="Carte PMD.pdf")
    assert r.status_code == 200 and r.json()["carteInvitation"]["type"] == "application/pdf"
    assert bytes(CarteInvitation.objects.get(evenement=evenement).contenu) == PDF


def test_jpeg_reencode_sans_metadonnees(client_sa, evenement):
    brut = png(exif=True)
    assert b"Appareil secret" in brut
    assert envoyer(client_sa, evenement, brut, nom="photo.jpg").status_code == 200
    stocke = bytes(CarteInvitation.objects.get(evenement=evenement).contenu)
    assert stocke.startswith(b"\xff\xd8\xff") and b"Appareil secret" not in stocke


@pytest.mark.parametrize(
    "donnees",
    [
        b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",  # format refusé
        b"<html><script>alert(1)</script></html>",
        b"\x89PNG\r\n\x1a\nfaux",  # en-tête PNG, contenu illisible
        b"%PDF-1.4 sans fin",  # PDF tronqué
    ],
)
def test_fichiers_refuses(client_sa, evenement, donnees):
    r = envoyer(client_sa, evenement, donnees, nom="carte.png")
    assert r.status_code == 400 and r.json()["code"] == "CARTE_INVALIDE"
    assert not CarteInvitation.objects.filter(evenement=evenement).exists()


def test_base64_invalide_et_fichier_trop_lourd(client_sa, evenement):
    r = client_sa.put(
        f"/api/evenements/{evenement.pk}/carte-invitation/", {"nom": "x", "contenu": "pas du base64 !"}, format="json"
    )
    assert r.status_code == 400
    lourd = PDF[:-7] + b"0" * 1_900_000 + b"\n%%EOF\n"
    assert envoyer(client_sa, evenement, lourd, nom="lourd.pdf").status_code == 400


def test_nom_de_fichier_nettoye(client_sa, evenement):
    r = envoyer(client_sa, evenement, PDF, nom="../../etc/carte.pdf")
    assert r.json()["carteInvitation"]["nom"] == "carte.pdf"
    r = envoyer(client_sa, evenement, PDF, nom="carte\r\nX-Injection: 1.pdf")
    assert r.status_code == 400


def test_remplacement_puis_retrait(client_sa, client, evenement):
    envoyer(client_sa, evenement, png())
    envoyer(client_sa, evenement, PDF, nom="nouvelle.pdf")
    assert CarteInvitation.objects.filter(evenement=evenement).count() == 1
    r = client_sa.delete(f"/api/evenements/{evenement.pk}/carte-invitation/")
    assert r.status_code == 200 and r.json()["carteInvitation"] is None
    assert JournalActivite.objects.filter(action="CARTE_INVITATION_SUPPRESSION", cible_id=evenement.pk).exists()
    assert client.get(f"/api/public/evenements/{evenement.slug_inscription}/carte-invitation/").status_code == 404
    assert "ATTACH" not in ics_evenement(evenement).decode()


def test_reserve_au_super_admin(client_admin, evenement):
    assert envoyer(client_admin, evenement, png()).status_code == 403
    assert client_admin.delete(f"/api/evenements/{evenement.pk}/carte-invitation/").status_code == 403


def test_liste_des_ceremonies_sans_contenu_du_fichier(client_sa, evenement):
    envoyer(client_sa, evenement, png())
    r = client_sa.get("/api/evenements/")
    ligne = next(e for e in r.json() if e["id"] == evenement.pk)
    assert ligne["carteInvitation"]["type"] == "image/png" and "contenu" not in ligne["carteInvitation"]


# --- revue de code du 2026-11-09 ------------------------------------------------------------------------------


def test_photo_redressee_selon_l_orientation_exif(client_sa, evenement):
    # photo prise au téléphone : pixels en paysage, EXIF Orientation = 6 (à tourner de 90°)
    sortie = io.BytesIO()
    exif = Image.Exif()
    exif[0x0112] = 6
    Image.new("RGB", (80, 40), (10, 120, 10)).save(sortie, "JPEG", exif=exif)
    assert envoyer(client_sa, evenement, sortie.getvalue(), nom="photo.jpg").status_code == 200
    with Image.open(io.BytesIO(bytes(CarteInvitation.objects.get(evenement=evenement).contenu))) as image:
        assert image.size == (40, 80)  # redressée en portrait
        assert not image.getexif().get(0x0112)


def test_grande_image_ramenee_a_2400_px(client_sa, evenement):
    assert envoyer(client_sa, evenement, png(taille=(4000, 1000))).status_code == 200
    with Image.open(io.BytesIO(bytes(CarteInvitation.objects.get(evenement=evenement).contenu))) as image:
        assert max(image.size) == 2400


def test_ancien_lien_affiche_puis_efface_au_retrait(client_sa, evenement):
    evenement.lien_carte_invitation = "https://mde.ci/ancienne-carte.png"
    evenement.save()
    r = client_sa.get(f"/api/evenements/{evenement.pk}/")
    assert r.json()["carteInvitation"]["lien"] == "https://mde.ci/ancienne-carte.png"
    r = client_sa.delete(f"/api/evenements/{evenement.pk}/carte-invitation/")
    assert r.json()["carteInvitation"] is None
    evenement.refresh_from_db()
    assert evenement.lien_carte_invitation == "" and "ATTACH" not in ics_evenement(evenement).decode()


def test_ancien_lien_efface_quand_un_fichier_est_envoye(client_sa, evenement):
    evenement.lien_carte_invitation = "https://mde.ci/ancienne-carte.png"
    evenement.save()
    envoyer(client_sa, evenement, png())
    client_sa.delete(f"/api/evenements/{evenement.pk}/carte-invitation/")
    evenement.refresh_from_db()
    assert "ancienne-carte" not in ics_evenement(evenement).decode()


def test_etag_304_et_pdf_telecharge(client_sa, client, evenement):
    envoyer(client_sa, evenement, PDF, nom="carte.pdf")
    url = f"/api/public/evenements/{evenement.slug_inscription}/carte-invitation/"
    r = client.get(url)
    assert r["Content-Disposition"].startswith("attachment;") and r["Cache-Control"] == "public, no-cache"
    r2 = client.get(url, HTTP_IF_NONE_MATCH=r["ETag"])
    assert r2.status_code == 304 and r2.content == b""


def test_page_publique_mise_a_jour_tout_de_suite(client_sa, client, evenement):
    url = f"/api/public/evenements/{evenement.slug_inscription}/"
    assert "Carte d'invitation" not in client.get(url).json()["agenda"]["description"]  # mis en cache
    envoyer(client_sa, evenement, png())
    assert "Carte d'invitation" in client.get(url).json()["agenda"]["description"]


def test_une_seule_requete_de_carte_par_fichier_ics(evenement, django_assert_num_queries):
    CarteInvitation.objects.create(evenement=evenement, nom="c.pdf", type_mime="application/pdf", taille=4, contenu=PDF)
    with django_assert_num_queries(1):
        ics_evenement(evenement)
