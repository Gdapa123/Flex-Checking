"""Mot de passe présent dans des fuites de données connues : refusé (OWASP ASVS 2.1.7, NIST SP 800-63B 5.1.1.2).

Consultation de l'API « Pwned Passwords » (Have I Been Pwned) par k-anonymat : seuls les 5 premiers caractères de
l'empreinte SHA-1 du mot de passe sont envoyés ; le service renvoie toutes les empreintes commençant ainsi (avec
remplissage aléatoire) et la comparaison se fait ici. Ni le mot de passe ni son empreinte complète ne quittent le
serveur. Service injoignable ou lent (délai de 3 s) : le mot de passe est accepté (les autres règles s'appliquent
toujours) et l'incident est journalisé — un service tiers ne doit jamais empêcher de changer son mot de passe.
"""

import hashlib
import logging
import urllib.request

from django.conf import settings
from django.core.exceptions import ValidationError

journal = logging.getLogger("securite")

URL_PWNED = "https://api.pwnedpasswords.com/range/"
DELAI_S = 3


def nombre_de_fuites(mot_de_passe):
    """Nombre d'apparitions dans les fuites connues, ou None si le service n'a pas répondu."""
    empreinte = hashlib.sha1(mot_de_passe.encode("utf-8")).hexdigest().upper()  # noqa: S324 — imposé par l'API
    prefixe, suffixe = empreinte[:5], empreinte[5:]
    requete = urllib.request.Request(
        URL_PWNED + prefixe, headers={"Add-Padding": "true", "User-Agent": "Flex-Checking (verification mot de passe)"}
    )
    try:
        with urllib.request.urlopen(requete, timeout=DELAI_S) as reponse:  # noqa: S310 — URL fixe en https
            for ligne in reponse.read().decode("utf-8", "replace").splitlines():
                candidat, _, nombre = ligne.partition(":")
                if candidat.strip() == suffixe:
                    return int(nombre.strip() or 0)
        return 0
    except Exception as exc:  # noqa: BLE001 — réseau, délai, réponse illisible
        journal.warning("Vérification des fuites de mots de passe indisponible (%s)", exc.__class__.__name__)
        return None


class MotDePasseNonCompromis:
    """Validateur Django (AUTH_PASSWORD_VALIDATORS), désactivable par VERIFIER_MOTS_DE_PASSE_FUITES."""

    def validate(self, password, user=None):
        if not getattr(settings, "VERIFIER_MOTS_DE_PASSE_FUITES", True):
            return
        if nombre_de_fuites(password):
            raise ValidationError(
                "Ce mot de passe figure dans des fuites de données publiques : choisissez-en un autre.",
                code="password_compromised",
            )

    def get_help_text(self):
        return "Le mot de passe ne doit pas figurer dans des fuites de données connues."
