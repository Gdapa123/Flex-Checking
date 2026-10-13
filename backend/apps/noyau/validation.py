"""Règles de validation partagées (miroir de frontend/src/lib/schemas.js)."""

import re

from django.utils.dateparse import parse_date
from rest_framework import serializers

EMAIL_RE = re.compile(r"^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[a-z]{2,}$", re.IGNORECASE)
HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
CONTROLE_RE = re.compile(r"[\x00-\x1f\x7f]")


ENTIER_RE = re.compile(r"[0-9]{1,9}")


def entier(valeur):
    """Entier positif d'un paramètre d'URL, ou None. Uniquement les chiffres ASCII : `str.isdigit()`
    accepte « ² » ou « ١ », que `int()` refuse ensuite (erreur serveur)."""
    valeur = str(valeur or "")
    return int(valeur) if ENTIER_RE.fullmatch(valeur) else None


def date_iso(valeur):
    """Date AAAA-MM-JJ d'un paramètre d'URL, ou None (y compris pour une date impossible comme le 30/02)."""
    try:
        return parse_date(str(valeur or ""))
    except ValueError:
        return None


def donnees_objet(request):
    """Corps de requête JSON sous forme d'objet ; {} si le corps est une liste, un nombre ou une chaîne
    (`request.data.get` provoquerait sinon une erreur serveur)."""
    return request.data if hasattr(request.data, "get") else {}


def sans_controle(valeur):
    """Refuse les caractères de contrôle (saut de ligne, retour chariot, tabulation…) dans une saisie d'une
    ligne : ils casseraient l'objet des emails, les fichiers .ics et les exports."""
    if CONTROLE_RE.search(valeur or ""):
        raise serializers.ValidationError("Caractères non autorisés.")
    return valeur


def valider_nom(valeur, libelle):
    valeur = sans_controle((valeur or "").strip())
    if len(valeur) < 2:
        raise serializers.ValidationError(f"Indiquez votre {libelle}.")
    if len(valeur) > 80:
        raise serializers.ValidationError("80 caractères maximum.")
    return valeur


def valider_texte_obligatoire(valeur, message, maximum=120):
    valeur = sans_controle((valeur or "").strip())
    if len(valeur) < 2:
        raise serializers.ValidationError(message)
    if len(valeur) > maximum:
        raise serializers.ValidationError(f"{maximum} caractères maximum.")
    return valeur


def valider_email(valeur):
    valeur = sans_controle((valeur or "").strip().lower())
    if not valeur:
        raise serializers.ValidationError("Indiquez votre adresse email.")
    # ASCII uniquement : la collation MySQL (utf8mb4_unicode_ci) confondrait « mdé.ci » et « mde.ci » ; une variante
    # accentuée échapperait aux limites de renvoi tout en atteignant la vraie adresse
    if not valeur.isascii() or not EMAIL_RE.match(valeur) or len(valeur) > 254:
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
