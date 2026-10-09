"""Règles de validation partagées (miroir de frontend/src/lib/schemas.js)."""

import re

from rest_framework import serializers

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[a-z]{2,}$", re.IGNORECASE)
HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def valider_nom(valeur, libelle):
    valeur = (valeur or "").strip()
    if len(valeur) < 2:
        raise serializers.ValidationError(f"Indiquez votre {libelle}.")
    if len(valeur) > 80:
        raise serializers.ValidationError("80 caractères maximum.")
    return valeur


def valider_email(valeur):
    valeur = (valeur or "").strip().lower()
    if not valeur:
        raise serializers.ValidationError("Indiquez votre adresse email.")
    if not EMAIL_RE.match(valeur) or len(valeur) > 254:
        raise serializers.ValidationError("Adresse email invalide, par exemple nom@entreprise.ci.")
    return valeur


def valider_telephone(valeur):
    """Numéro ivoirien : 10 chiffres après l'indicatif +225. Stocké « +225 07 12 34 56 78 »."""
    chiffres = re.sub(r"\D", "", valeur or "")
    if chiffres.startswith("225") and len(chiffres) == 13:
        chiffres = chiffres[3:]
    if not chiffres:
        raise serializers.ValidationError("Indiquez votre numéro de téléphone.")
    if len(chiffres) != 10:
        raise serializers.ValidationError("Le numéro doit comporter 10 chiffres, par exemple 07 12 34 56 78.")
    return "+225 " + " ".join(chiffres[i : i + 2] for i in range(0, 10, 2))


def valider_couleur(valeur):
    if not HEX_RE.match(valeur or ""):
        raise serializers.ValidationError("Couleur au format #RRGGBB attendue.")
    return valeur.upper()
