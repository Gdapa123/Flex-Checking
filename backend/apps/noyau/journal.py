"""Journal d'activité : toute action d'un admin ou d'un super admin y est inscrite.

`details` ne doit contenir aucune donnée personnelle (pas de nom, d'email ni de téléphone
d'invité) : on y range des identifiants, des codes et des valeurs de configuration.
"""

from .models import JournalActivite

# action -> catégorie affichée (filtre « Type » du design)
CATEGORIES = {
    "EMARGEMENT": "Émargement",
    "ANNULATION_EMARGEMENT": "Émargement",
    "INVITE_AJOUT": "Invité",
    "INVITE_MODIFICATION": "Invité",
    "INVITE_SUPPRESSION": "Invité",
    "EMAIL_RENVOI": "Email",
    "EXPORT": "Export",
    "PROGRAMME_CREATION": "Configuration",
    "PROGRAMME_MODIFICATION": "Configuration",
    "PROGRAMME_ACTIVATION": "Configuration",
    "PROGRAMME_DESACTIVATION": "Configuration",
    "PROGRAMME_SUPPRESSION": "Configuration",
    "EVENEMENT_CREATION": "Configuration",
    "EVENEMENT_MODIFICATION": "Configuration",
    "EVENEMENT_SUPPRESSION": "Configuration",
    "EVENEMENT_SLUG": "Configuration",
    "EVENEMENT_ADMINS": "Configuration",
    "INSCRIPTIONS_OUVERTURE": "Configuration",
    "INSCRIPTIONS_FERMETURE": "Configuration",
    "PARAMETRES": "Configuration",
    "ADMIN_CREATION": "Compte",
    "ADMIN_MODIFICATION": "Compte",
    "ADMIN_ACTIVATION": "Compte",
    "ADMIN_DESACTIVATION": "Compte",
    "ADMIN_MOT_DE_PASSE": "Compte",
    "ADMIN_SUPPRESSION": "Compte",
    "CONNEXION": "Compte",
    "DECONNEXION": "Compte",
    "MOT_DE_PASSE_CHANGE": "Compte",
}


def journaliser(auteur, action, cible=None, **details):
    if action not in CATEGORIES:
        raise ValueError(f"Action de journal inconnue : {action}")
    return JournalActivite.objects.create(
        auteur=auteur if (auteur is not None and getattr(auteur, "is_authenticated", False)) else None,
        action=action,
        cible_type=cible.__class__.__name__ if cible is not None else "",
        cible_id=cible.pk if cible is not None else None,
        details=details,
    )
