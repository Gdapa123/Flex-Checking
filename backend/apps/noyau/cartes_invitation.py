"""Carte d'invitation du programme : contrôle et préparation du fichier téléversé par le super admin.

Le fichier arrive en base64 dans un corps JSON (l'API n'accepte que du JSON, voir `settings.DEFAULT_PARSER_CLASSES`).
Seuls JPEG, PNG et PDF sont admis, reconnus à leur contenu et non à leur nom. Les images sont réencodées par Pillow :
métadonnées (position GPS, appareil) retirées et tout contenu caché éliminé. Miroir côté navigateur :
`frontend/src/lib/carteInvitation.js` (mêmes types, même taille maximale, réduction des images trop lourdes).
"""

import base64
import binascii
import io
import os

from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError

from .exceptions import ErreurMetier
from .validation import sans_controle

# 1,8 Mo : une fois en base64 (× 4/3), le corps JSON reste sous la limite de Django (2,5 Mo,
# DATA_UPLOAD_MAX_MEMORY_SIZE) et sous celle de Vercel (4,5 Mo)
TAILLE_MAX = 1_800_000
PIXELS_MAX = 40_000_000  # garde contre les images « bombes » (dimensions énormes, fichier minuscule)
# côté le plus long après réencodage : la carte est lue sur un téléphone ou imprimée en A5 (miroir de COTE_MAX)
COTE_MAX = 2400
# type MIME → (format Pillow, extension) : seule liste des formats acceptés
TYPES = {"image/jpeg": ("JPEG", "jpg"), "image/png": ("PNG", "png"), "application/pdf": (None, "pdf")}


def _refus(message):
    return ErreurMetier("CARTE_INVALIDE", message, status=400)


def _type_reel(donnees):
    if donnees.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if donnees.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if donnees.startswith(b"%PDF-") and b"%%EOF" in donnees[-2048:]:
        return "application/pdf"
    return None


def _encoder(image, format_pillow, qualite, icc):
    sortie = io.BytesIO()
    options = {"optimize": True}
    if icc:
        options["icc_profile"] = icc  # profil de couleurs gardé : couleurs fidèles sur les écrans larges
    if format_pillow == "JPEG":
        options["quality"] = qualite
    image.save(sortie, format_pillow, **options)
    return sortie.getvalue()


def _reencoder(donnees, type_mime):
    """Image réencodée sans métadonnées (position GPS, appareil), redressée selon son orientation EXIF (photo prise
    au téléphone), ramenée à 2400 px de côté au plus et à 1,8 Mo (qualité JPEG abaissée, ou PNG converti en JPEG)."""
    try:
        with Image.open(io.BytesIO(donnees)) as source:
            if source.width * source.height > PIXELS_MAX:
                raise _refus("Image trop grande (dimensions).")
            icc = source.info.get("icc_profile")
            image = ImageOps.exif_transpose(source)  # applique l'orientation avant de retirer l'EXIF
            image.load()
            if max(image.size) > COTE_MAX:
                image.thumbnail((COTE_MAX, COTE_MAX), Image.Resampling.LANCZOS)
            format_pillow = TYPES[type_mime][0]
            if format_pillow == "JPEG" and image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            sortie = _encoder(image, format_pillow, 88, icc)
            if len(sortie) > TAILLE_MAX and format_pillow == "PNG":
                # PNG trop lourd une fois réencodé : JPEG sur fond blanc
                fond = Image.new("RGB", image.size, (255, 255, 255))
                fond.paste(image, mask=image.getchannel("A") if "A" in image.getbands() else None)
                image, format_pillow, type_mime = fond, "JPEG", "image/jpeg"
                sortie = _encoder(image, "JPEG", 88, icc)
            for qualite in (80, 70, 60):
                if len(sortie) <= TAILLE_MAX or format_pillow != "JPEG":
                    break
                sortie = _encoder(image, "JPEG", qualite, icc)
            return sortie, type_mime
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError) as exc:
        raise _refus("Image illisible.") from exc


def preparer(contenu_base64, nom):
    """(contenu, type MIME, nom de fichier) prêts à enregistrer, ou ErreurMetier `CARTE_INVALIDE`."""
    if not isinstance(contenu_base64, str) or not contenu_base64:
        raise _refus("Aucun fichier reçu.")
    if len(contenu_base64) > TAILLE_MAX * 4 // 3 + 8:
        raise _refus("Fichier trop lourd (1,8 Mo au plus).")
    try:
        donnees = base64.b64decode(contenu_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise _refus("Fichier illisible.") from exc
    type_mime = _type_reel(donnees)
    if type_mime is None:
        raise _refus("Format non accepté : image JPEG ou PNG, ou PDF.")
    if TYPES[type_mime][0]:
        donnees, type_mime = _reencoder(donnees, type_mime)
    if len(donnees) > TAILLE_MAX:
        raise _refus("Fichier trop lourd (1,8 Mo au plus).")
    nom = sans_controle(os.path.basename(str(nom or "").replace("\\", "/")).strip())[:120] or "carte-invitation"
    base, point, _ = nom.rpartition(".")
    nom = f"{base or nom}.{extension(type_mime)}"  # extension conforme au contenu réel (PNG devenu JPEG)
    return donnees, type_mime, nom


def extension(type_mime):
    return TYPES.get(type_mime, (None, "bin"))[1]


def lien_public(evenement, slug=None):
    """Adresse publique du fichier (sans donnée personnelle) ; `slug` : lien effectivement utilisé par l'invité."""
    return f"{settings.APP_PUBLIC_URL}/api/public/evenements/{slug or evenement.slug_inscription}/carte-invitation/"


def carte_pour_agenda(evenement, slug=None):
    """(adresse, type MIME) de la carte pour l'agenda : fichier téléversé, sinon ancien lien saisi (avant le
    2026-11-09, effacé dès qu'un fichier est envoyé ou retiré), sinon None. Une requête."""
    from .models import CarteInvitation

    type_mime = CarteInvitation.objects.filter(evenement_id=evenement.pk).values_list("type_mime", flat=True).first()
    if type_mime:
        return lien_public(evenement, slug), type_mime
    if evenement.lien_carte_invitation:
        return evenement.lien_carte_invitation, None
    return None
