"""Corrections du 2026-11-09 : agenda (titre, deux rappels, carte d'invitation), deux pièces jointes seulement dans
l'email n°1, deux boutons dans l'email n°2 (magazine de la cérémonie, brochure Executive Education)."""

import email
import re

import pytest
from django.core import mail

from apps.noyau.emails import Source, construire_message, nom_logo, planifier, rendre
from apps.noyau.ics import ics_evenement
from apps.noyau.models import EmailEnvoye, Parametres, TypeEmail
from apps.noyau.theme import deriver_tokens

from .conftest import nouvel_invite


def test_agenda_titre_deux_rappels_et_carte(evenement):
    evenement.lien_carte_invitation = "https://mde.ci/cartes/pmd.png"
    evenement.save()
    ics = ics_evenement(evenement).decode()
    assert f"SUMMARY:Cérémonie de Graduation {evenement.programme.nom} {evenement.annee}" in ics
    assert ics.count("BEGIN:VALARM") == 2
    assert "TRIGGER:-P1D" in ics and "TRIGGER:-PT1H" in ics
    assert "ATTACH:https://mde.ci/cartes/pmd.png" in ics
    assert "Carte d'invitation : https://mde.ci/cartes/pmd.png" in ics.replace("\\n", "\n")


def test_agenda_sans_carte(evenement):
    ics = ics_evenement(evenement).decode()
    assert "ATTACH" not in ics and "Carte d'invitation" not in ics


def test_page_publique_titre_d_agenda(client, evenement):
    r = client.get(f"/api/public/evenements/{evenement.slug_inscription}/")
    assert r.json()["agenda"]["titre"] == evenement.nom_agenda
    assert "dateLimiteInscription" not in r.json()


def test_invitation_deux_pieces_jointes_seulement(evenement, settings):
    settings.APP_PUBLIC_URL = "https://inscription.mde.ci"
    inv = nouvel_invite(evenement)
    e = EmailEnvoye.objects.filter(invite=inv, type=TypeEmail.INVITATION).latest("pk")
    brut = construire_message(e).message().as_bytes()
    parties = list(email.message_from_bytes(brut).walk())
    jointes = [p.get_filename() for p in parties if p.get_filename()]
    assert sorted(jointes) == ["graduation.ics", "qr-code.png"]
    # seule image intégrée : le QR code ; logo et icônes servis par lien
    integrees = [p for p in parties if p.get("Content-ID")]
    assert [p["Content-ID"] for p in integrees] == ["<qr>"]
    html = next(p for p in parties if p.get_content_type() == "text/html").get_payload(decode=True).decode()
    assert "https://inscription.mde.ci/api/public/emails/images/logo-" in html
    assert "/api/public/emails/images/ic-calendar-" in html


def test_invitation_formule_de_fin_en_bas_sans_signature(evenement):
    r = rendre(TypeEmail.INVITATION, Source.depuis_invite(nouvel_invite(evenement)))
    html = r["html"]
    assert html.index("Itinéraire") < html.index("À très bientôt !")
    corps = Parametres.charger().corps_email_1
    assert corps.endswith("À très bientôt !") and "MDE Business School" not in corps


@pytest.mark.parametrize(
    ("lien_ceremonie", "attendu"),
    [("", "https://mde.ci"), ("https://mde.ci/brochure-ee.pdf", "https://mde.ci/brochure-ee.pdf")],
)
def test_magazine_deux_boutons(evenement, lien_ceremonie, attendu):
    prog = evenement.programme
    prog.magazine_actif, prog.lien_magazine = True, "https://mde.ci/magazine/programme"
    prog.save()
    evenement.lien_magazine = "https://mde.ci/magazine/promo-2026"
    evenement.lien_brochure = lien_ceremonie
    evenement.save()
    r = rendre(TypeEmail.MAGAZINE, Source.depuis_invite(nouvel_invite(evenement)))
    assert 'href="https://mde.ci/magazine/promo-2026"' in r["html"]  # lien de la cérémonie avant celui du programme
    assert f'href="{attendu}"' in r["html"] and "Brochure Executive Education" in r["html"]
    assert f"Brochure Executive Education : {attendu}" in r["texte"]
    assert r["pieces_jointes"] == []


def test_magazine_envoye_avec_le_lien_de_la_ceremonie(evenement):
    prog = evenement.programme
    prog.magazine_actif, prog.lien_magazine = True, ""
    prog.save()
    evenement.lien_magazine = "https://mde.ci/magazine/promo-2026"
    evenement.save()
    inv = nouvel_invite(evenement)
    mail.outbox.clear()
    planifier(inv, TypeEmail.MAGAZINE)
    assert evenement.magazine_disponible
    assert any("https://mde.ci/magazine/promo-2026" in m.body for m in mail.outbox)


def test_images_des_emails(client, programme):
    t = deriver_tokens(programme.couleur_principale, programme.couleur_secondaire)
    noms = [
        nom_logo("blanc"),
        nom_logo("rouge"),
        "logo-blanc-00000000",  # empreinte périmée (ancien email) : le logo actuel
        f"ic-calendar-{t['primary'].strip('#').upper()}",
        "ic-check-18794E",
    ]
    for nom in noms:
        r = client.get(f"/api/public/emails/images/{nom}.png")
        assert r.status_code == 200 and r["Content-Type"] == "image/png", nom
        assert "immutable" in r["Cache-Control"]
        assert r.content.startswith(b"\x89PNG")


@pytest.mark.parametrize(
    "nom",
    [
        "inconnu",
        "logo-blanc",  # sans empreinte
        "ic-autre-FFFFFF",
        "ic-calendar-ZZZZZZ",
        "ic-calendar-123456",  # couleur d'aucun programme : jamais dessinée
        "logo-blanc.png",
        "..%2Fsettings",
    ],
)
def test_images_des_emails_noms_refuses(client, programme, nom):
    assert client.get(f"/api/public/emails/images/{nom}.png").status_code == 404


def test_logo_versionne_dans_l_email(evenement, settings):
    settings.APP_PUBLIC_URL = "https://inscription.mde.ci"
    r = rendre(TypeEmail.INVITATION, Source.depuis_invite(nouvel_invite(evenement)))
    assert re.search(r"/api/public/emails/images/logo-(blanc|rouge)-[0-9a-f]{8}\.png", r["html"])


@pytest.mark.parametrize("lien", ["ftp://mde.ci/fichier", "https:// mde.ci", "javascript:alert(1)"])
def test_liens_refuses_miroir_du_frontend(client_sa, evenement, lien):
    # miroir de `schemaLien` (schemas.js) : http(s) seulement
    r = client_sa.patch(f"/api/evenements/{evenement.pk}/", {"lienCarteInvitation": lien}, format="json")
    assert r.status_code == 400 and "lienCarteInvitation" in r.json()
    r = client_sa.patch("/api/parametres/", {"lienBrochureDefaut": lien}, format="json")
    assert r.status_code == 400 and "lienBrochureDefaut" in r.json()


# --- 2026-11-10 : email n°2 envoyé à tout invité présent, boutons selon les liens --------------------------------


def _sans_liens(evenement, brochure_defaut=""):
    prog = evenement.programme
    prog.magazine_actif, prog.lien_magazine = False, ""
    prog.save()
    evenement.lien_magazine = evenement.lien_brochure = ""
    evenement.save()
    p = Parametres.charger()
    p.lien_brochure_defaut = brochure_defaut
    p.save()


def test_email_2_sans_aucun_lien_sans_boutons(evenement):
    _sans_liens(evenement)
    r = rendre(TypeEmail.MAGAZINE, Source.depuis_invite(nouvel_invite(evenement)))
    assert "Votre présence est enregistrée" in r["html"]
    for absent in ("Lire le magazine", "Brochure Executive Education", "Le magazine AMP", "vous attend"):
        assert absent not in r["html"] and absent not in r["texte"]


def test_email_2_brochure_seule(evenement):
    _sans_liens(evenement, brochure_defaut="https://mde.ci")
    r = rendre(TypeEmail.MAGAZINE, Source.depuis_invite(nouvel_invite(evenement)))
    assert 'href="https://mde.ci"' in r["html"] and "Brochure Executive Education" in r["html"]
    assert "Lire le magazine" not in r["html"] and "Le magazine AMP" not in r["html"]


def test_email_2_texte_par_defaut_sans_mention_du_magazine(evenement):
    p = Parametres.charger()
    assert "magazine" not in p.objet_email_2.lower()
    assert "magazine" not in p.corps_email_2.replace("{lien_magazine}", "")
    assert "ce soir" not in p.corps_email_2


def test_page_publique_annonce_magazine_et_brochure(client, evenement):
    # guide « Comment ça se passe ? » : l'étape de l'email n°2 dépend des liens (2026-11-10)
    _sans_liens(evenement, brochure_defaut="https://mde.ci")
    url = f"/api/public/evenements/{evenement.slug_inscription}/"
    d = client.get(url).json()
    assert d["magazineActif"] is False and d["brochureActive"] is True
    evenement.lien_magazine = "https://mde.ci/magazine/promo"
    evenement.save()
    assert client.get(url).json()["magazineActif"] is True
