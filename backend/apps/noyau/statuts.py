"""Codes des statuts d'invité. Le code métier référence toujours ces constantes,
jamais les libellés (table de référence `Statut`)."""

INSCRIT = "INSCRIT"
PRESENT = "PRESENT"

VALEURS_INITIALES = [
    (INSCRIT, "Inscrit", 1),
    (PRESENT, "Présent", 2),
]
