"""Dérivation des tokens de couleur d'un programme (miroir de frontend/src/theme/tokens.js).

Les deux implémentations sont vérifiées par les mêmes cas de référence :
shared/token-fixtures.json.
"""

import math

NOIR = "#000000"
BLANC = "#FFFFFF"
TEXTE_FONCE = "#141414"


def hex_vers_rgb(couleur):
    h = couleur.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return [int(h[i : i + 2], 16) for i in (0, 2, 4)]


def rgb_vers_hex(rgb):
    # arrondi identique à Math.round en JavaScript (et non à l'arrondi bancaire de Python)
    return "#" + "".join(f"{math.floor(max(0, min(255, v)) + 0.5):02X}" for v in rgb)


def melanger(a, b, poids):
    """Mélange `a` avec `poids` (0–1) de `b`, comme mde.js `mix`."""
    x, y = hex_vers_rgb(a), hex_vers_rgb(b)
    return rgb_vers_hex([x[i] * (1 - poids) + y[i] * poids for i in range(3)])


def luminance(couleur):
    def canal(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (canal(v) for v in hex_vers_rgb(couleur))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    l1, l2 = luminance(a), luminance(b)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)


def couleur_sur(fond):
    """Blanc ou #141414 selon le meilleur contraste."""
    return BLANC if contraste(fond, BLANC) >= contraste(fond, TEXTE_FONCE) else TEXTE_FONCE


def deriver_tokens(principale, secondaire):
    p, s = principale.upper(), secondaire.upper()
    return {
        "primary": p,
        "secondary": s,
        "primary_hover": melanger(p, NOIR, 0.15),
        "primary_soft": melanger(p, BLANC, 0.88),
        "secondary_soft": melanger(s, BLANC, 0.85),
        "on_primary": couleur_sur(p),
        "on_secondary": couleur_sur(s),
        "header": melanger(p, BLANC, 0.86),
        # dégradé d'en-tête (approximation sans color-mix, pour les emails)
        "gradient_dark": melanger(p, NOIR, 0.38),
        "gradient_light": melanger(p, BLANC, 0.18),
    }
