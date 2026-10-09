"""Icônes des emails, dessinées en PNG (les clients mail n'affichent pas le SVG).

Reprend les tracés de la famille d'icônes du design (trait 2 px, grille 24) : calendar, clock,
mapPin, check, calendarPlus, navigation, external. Rendu à 4× puis réduit pour l'anticrénelage.
"""

import io
from functools import lru_cache

from PIL import Image, ImageDraw

ECHELLE = 4
TAILLE = 40  # px du PNG final (affiché en 20 px, net sur écrans haute densité)


def _rgb(hexa):
    h = hexa.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) + (255,)


def _dessiner(nom, d, couleur, k):
    """k : facteur de conversion des unités 24 -> pixels."""
    w = round(2 * k)

    def p(x, y):
        return (x * k, y * k)

    def ligne(*pts):
        d.line([p(*pt) for pt in pts], fill=couleur, width=w, joint="curve")
        for pt in (pts[0], pts[-1]):
            cx, cy = p(*pt)
            d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=couleur)

    if nom in ("calendar", "calendarPlus"):
        d.rounded_rectangle([p(3, 4), p(21, 22)], radius=2 * k, outline=couleur, width=w)
        ligne((16, 2), (16, 6))
        ligne((8, 2), (8, 6))
        ligne((3, 10), (21, 10))
        if nom == "calendarPlus":
            ligne((12, 14), (12, 18))
            ligne((10, 16), (14, 16))
    elif nom == "clock":
        d.ellipse([p(2, 2), p(22, 22)], outline=couleur, width=w)
        ligne((12, 6), (12, 12), (16, 14))
    elif nom == "mapPin":
        d.ellipse([p(4, 2), p(20, 18)], outline=couleur, width=w)
        d.polygon([p(5.2, 13.5), p(12, 22), p(18.8, 13.5), p(12, 16)], fill=couleur)
        d.ellipse([p(4 + 1.6, 2 + 1.6), p(20 - 1.6, 18 - 1.6)], fill=(0, 0, 0, 0))
        d.ellipse([p(4, 2), p(20, 18)], outline=couleur, width=w)
        d.ellipse([p(9, 7), p(15, 13)], outline=couleur, width=w)
    elif nom == "check":
        ligne((20, 6), (9, 17), (4, 12))
    elif nom == "navigation":
        d.polygon([p(3, 11), p(22, 2), p(13, 21), p(11, 13)], outline=couleur, width=w)
        d.line([p(3, 11), p(22, 2), p(13, 21), p(11, 13), p(3, 11)], fill=couleur, width=w, joint="curve")
    elif nom == "external":
        ligne((15, 3), (21, 3), (21, 9))
        ligne((10, 14), (21, 3))
        ligne((18, 13), (18, 19))
        d.arc([p(14, 17), p(18, 21)], 0, 90, fill=couleur, width=w)
        ligne((16, 21), (5, 21))
        d.arc([p(3, 17), p(7, 21)], 90, 180, fill=couleur, width=w)
        ligne((3, 19), (3, 8))
        d.arc([p(3, 6), p(7, 10)], 180, 270, fill=couleur, width=w)
        ligne((5, 6), (11, 6))
    else:
        raise ValueError(nom)


@lru_cache(maxsize=256)
def icone_png(nom, couleur):
    grand = TAILLE * ECHELLE
    image = Image.new("RGBA", (grand, grand), (0, 0, 0, 0))
    _dessiner(nom, ImageDraw.Draw(image), _rgb(couleur), grand / 24)
    image = image.resize((TAILLE, TAILLE), Image.LANCZOS)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG", optimize=True)
    return tampon.getvalue()
