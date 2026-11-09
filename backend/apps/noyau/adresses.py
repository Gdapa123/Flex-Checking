"""Adresses email probablement mal tapées (« gmial.com », « yahoo.fe », « hotmail.con »).

Une faute dans le domaine passe souvent inaperçue : le serveur d'envoi accepte le message (« envoyé »), puis
l'abandonne plus tard faute de destinataire, sans que l'application le sache. On compare donc le domaine aux
fournisseurs les plus utilisés par les invités : à une ou deux fautes de frappe près, une correction est proposée.
Un domaine exact de la liste, trop éloigné (adresse professionnelle) ou national d'un grand fournisseur (hotmail.be)
n'est jamais signalé.
"""

DOMAINES_COURANTS = (
    "gmail.com",
    "yahoo.fr",
    "yahoo.com",
    "hotmail.com",
    "hotmail.fr",
    "outlook.com",
    "outlook.fr",
    "live.fr",
    "live.com",
    "icloud.com",
    "aol.com",
    "orange.fr",
    "mde.ci",
)
# domaines réels proches d'un fournisseur courant : jamais « corrigés » (ymail.com n'est pas gmail.com)
AUTRES_DOMAINES_VALIDES = (
    "ymail.com",
    "mail.com",
    "email.com",
    "gmx.com",
    "gmx.fr",
    "me.com",
    "mac.com",
    "proton.me",
    "protonmail.com",
    "laposte.net",
    "free.fr",
    "sfr.fr",
    "orange.ci",
    "aviso.ci",
    "mtn.ci",
    "moov.ci",
)
# fournisseurs qui existent avec des extensions nationales (hotmail.be, yahoo.es, outlook.de, aol.fr…) : un invité de
# la diaspora a une vraie adresse, jamais « corrigée » vers la version française ou .com
FOURNISSEURS_NATIONAUX = {"hotmail", "outlook", "live", "msn", "yahoo", "aol", "gmx", "orange", "laposte"}
EXTENSIONS_REELLES = {
    "com", "net", "org", "fr", "be", "de", "es", "it", "nl", "ch", "ca", "pt", "at", "ie", "lu", "dk", "se", "no", "fi",
    "pl", "gr", "ru", "us", "in", "jp", "sn", "ma", "tn", "dz", "cm", "ci", "co.uk", "co.jp", "co.in", "com.br",
    "com.au", "com.ar", "com.mx", "com.tr",
}  # fmt: skip
# fautes fréquentes trop éloignées pour la distance d'édition, ou entre deux domaines valides
CORRECTIONS_CONNUES = {
    "gmail.fr": "gmail.com",
    "gmail.ci": "gmail.com",
    "googlemail.fr": "gmail.com",
    "yahoo.ci": "yahoo.fr",
    "hotmail.ci": "hotmail.fr",
}


def _distance(a, b):
    """Distance de Damerau-Levenshtein restreinte (insertion, suppression, substitution, inversion de deux
    lettres voisines), arrêtée au-delà de 2."""
    if abs(len(a) - len(b)) > 2:
        return 3
    precedente2, precedente = None, list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        courante = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            courante[j] = min(
                precedente[j] + 1,
                courante[j - 1] + 1,
                precedente[j - 1] + (ca != cb),
            )
            if i > 1 and j > 1 and ca == b[j - 2] and a[i - 2] == cb:
                courante[j] = min(courante[j], precedente2[j - 2] + 1)
        precedente2, precedente = precedente, courante
    return precedente[-1]


def suggerer_correction(email):
    """Adresse corrigée si le domaine ressemble à un fournisseur courant sans l'être, sinon None."""
    local, arobase, domaine = (email or "").strip().lower().rpartition("@")
    if not arobase or not local or not domaine or domaine in DOMAINES_COURANTS or domaine in AUTRES_DOMAINES_VALIDES:
        return None
    if domaine in CORRECTIONS_CONNUES:
        return f"{local}@{CORRECTIONS_CONNUES[domaine]}"
    fournisseur, _, extension = domaine.partition(".")
    if fournisseur in FOURNISSEURS_NATIONAUX and extension in EXTENSIONS_REELLES:
        return None
    # domaine court (« mde.ci ») : seule l'extension peut être fautive (« mde.cii ») ; « ide.ci » est un autre domaine
    candidats = [d for d in DOMAINES_COURANTS if len(d) > 6 or d.partition(".")[0] == fournisseur]
    if not candidats:
        return None
    proches = sorted((_distance(domaine, d), d) for d in candidats)
    distance, meilleur = proches[0]
    # domaine court (« mde.cii ») : une seule faute admise ; deux sinon. Égalité entre deux candidats : pas de choix
    limite = 1 if len(meilleur) <= 6 else 2
    if distance <= limite and (len(proches) < 2 or proches[1][0] > distance):
        return f"{local}@{meilleur}"
    return None
