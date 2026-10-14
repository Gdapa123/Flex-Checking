"""Libellés lisibles des entrées du journal, reconstitués à l'affichage (les noms d'invités ne
sont jamais stockés dans le journal)."""

from collections import defaultdict

from .models import Evenement, Invite, ModeEmargement, Programme, libelle_email

FORMATS = {"xlsx": "Excel", "csv": "CSV"}
CHAMPS = {
    "civilite": "civilité",
    "nom": "nom",
    "prenom": "prénom",
    "email": "email",
    "telephone": "téléphone",
    "entreprise": "entreprise",
    "fonction": "fonction",
}


def precharger_cibles(entrees):
    """Charge en une requête par type les objets visés par une page du journal."""
    ids = defaultdict(set)
    for e in entrees:
        if e.cible_type and e.cible_id:
            ids[e.cible_type].add(e.cible_id)
        if e.details.get("evenement"):
            ids["Evenement"].add(e.details["evenement"])
    cibles = {}
    if ids.get("Invite"):
        for i in Invite.objects.filter(pk__in=ids["Invite"]).select_related("evenement__programme"):
            cibles[("Invite", i.pk)] = i
    if ids.get("Evenement"):
        for ev in Evenement.objects.filter(pk__in=ids["Evenement"]).select_related("programme"):
            cibles[("Evenement", ev.pk)] = ev
    if ids.get("Programme"):
        for p in Programme.objects.filter(pk__in=ids["Programme"]):
            cibles[("Programme", p.pk)] = p
    if ids.get("Admin"):
        from apps.comptes.models import Admin

        for a in Admin.objects.filter(pk__in=ids["Admin"]):
            cibles[("Admin", a.pk)] = a
    return cibles


def _mode(code):
    try:
        return ModeEmargement(code).label
    except ValueError:
        return code or ""


def decrire(e, cibles):  # noqa: C901 — table de correspondance volontairement explicite
    d = e.details or {}
    cible = cibles.get((e.cible_type, e.cible_id))
    ev = cibles.get(("Evenement", d.get("evenement")))
    nom_ev = ev.nom_affiche if ev else ""
    nom_inv = cible.nom_complet if isinstance(cible, Invite) else "Invité supprimé"

    match e.action:
        case "EMARGEMENT":
            morceaux = [nom_inv, "Présent", _mode(d.get("mode"))]
            if d.get("poste"):
                morceaux.append(d["poste"])
            if d.get("hors_ligne"):
                morceaux.append("synchronisé hors ligne")
            return " · ".join(morceaux + ([nom_ev] if nom_ev else []))
        case "ANNULATION_EMARGEMENT":
            return f"Annulation · {nom_inv} repasse au statut Inscrit"
        case "INVITE_AJOUT":
            suffixe = " · invitation envoyée" if d.get("email_envoye") else ""
            return f"Ajout manuel · {nom_inv}{suffixe}" + (f" · {nom_ev}" if nom_ev else "")
        case "INVITE_MODIFICATION":
            champs = ", ".join(CHAMPS.get(c, c) for c in d.get("champs", []))
            return f"Fiche modifiée · {nom_inv} ({champs})"
        case "EMAIL_RENVOI":
            libelle = libelle_email(d.get("type") or "INVITATION", court=True)
            accord = "renvoyée" if (d.get("type") or "INVITATION") == "INVITATION" else "renvoyé"
            if d.get("nb"):
                return f"{libelle} {accord} à {d['nb']} invités" + (f" · {nom_ev}" if nom_ev else "")
            return f"{libelle} {accord} · {nom_inv}"
        case "EMAIL_TEST":
            libelle = libelle_email(d.get("type") or "INVITATION", court=True)
            return f"{libelle} · email de test envoyé à l’auteur" + (f" · {nom_ev}" if nom_ev else "")
        case "EXPORT":
            quoi = {
                "invites": "invités",
                "presences": "présences",
                "emails": "suivi des emails",
                "journal": "journal",
            }.get(d.get("type", "invites"), "invités")
            nb = d.get("nb")
            return " · ".join(
                filter(
                    None,
                    [
                        f"Export {FORMATS.get(d.get('format'), d.get('format', ''))}",
                        f"{nb} lignes" if nb is not None else "",
                        quoi,
                        nom_ev,
                    ],
                )
            )
        case "PROGRAMME_CREATION":
            return f"Programme {cible.nom if cible else ''} créé"
        case "PROGRAMME_MODIFICATION":
            if d.get("couleurs"):
                return f"Couleurs du programme {cible.nom if cible else ''} mises à jour"
            return f"Programme {cible.nom if cible else ''} modifié"
        case "PROGRAMME_ACTIVATION":
            return f"Programme {cible.nom if cible else ''} réactivé"
        case "PROGRAMME_DESACTIVATION":
            return f"Programme {cible.nom if cible else ''} désactivé"
        case "PROGRAMME_SUPPRESSION":
            return f"Programme {d.get('nom', '')} supprimé"
        case "EVENEMENT_CREATION":
            return f"Événement créé · {cible.nom_affiche if cible else ''}"
        case "EVENEMENT_MODIFICATION":
            return f"Événement modifié · {cible.nom_affiche if cible else ''}"
        case "EVENEMENT_SUPPRESSION":
            return f"Événement supprimé · {d.get('nom', '')}"
        case "EVENEMENT_SLUG":
            return f"Lien d’inscription régénéré · {cible.nom_affiche if cible else ''}"
        case "EVENEMENT_ADMINS":
            return f"Admins affectés mis à jour · {cible.nom_affiche if cible else ''}"
        case "INSCRIPTIONS_OUVERTURE":
            return f"Inscriptions ouvertes · {cible.nom_affiche if cible else ''}"
        case "INSCRIPTIONS_FERMETURE":
            return f"Inscriptions fermées · {cible.nom_affiche if cible else ''}"
        case "PARAMETRES":
            if "duree_resultat_scan" in d:
                return f"Durée d’affichage du scan : {d['duree_resultat_scan']} s"
            return "Paramètres mis à jour"
        case "ADMIN_CREATION":
            return f"Compte créé pour {cible.email if cible else ''}"
        case "ADMIN_MODIFICATION":
            return f"Compte modifié · {cible.nom if cible else ''}"
        case "ADMIN_ACTIVATION":
            return f"Compte réactivé · {cible.nom if cible else ''}"
        case "ADMIN_DESACTIVATION":
            return f"Compte désactivé · {cible.nom if cible else ''}"
        case "ADMIN_MOT_DE_PASSE":
            return f"Mot de passe réinitialisé · {cible.nom if cible else ''}"
        case "CONNEXION":
            return "Connexion"
        case "DECONNEXION":
            return "Déconnexion"
        case "MOT_DE_PASSE_CHANGE":
            return "Mot de passe modifié"
    return e.action
