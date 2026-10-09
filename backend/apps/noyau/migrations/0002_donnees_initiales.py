"""Données indispensables en production : statuts, programmes initiaux, paramètres."""

from django.db import migrations

STATUTS = [("INSCRIT", "Inscrit", 1), ("PRESENT", "Présent", 2)]
PROGRAMMES = [
    ("AMP", "#8F1C1F", "#F7941D"),
    ("PMD", "#1A5E36", "#FFF200"),
    ("Public-AMP", "#77421C", "#F7941D"),
    ("Public-ASD", "#06474F", "#F37740"),
]


def creer(apps, schema_editor):
    Statut = apps.get_model("noyau", "Statut")
    Programme = apps.get_model("noyau", "Programme")
    Parametres = apps.get_model("noyau", "Parametres")
    for code, libelle, ordre in STATUTS:
        Statut.objects.update_or_create(code=code, defaults={"libelle": libelle, "ordre": ordre})
    for nom, p, s in PROGRAMMES:
        Programme.objects.get_or_create(nom=nom, defaults={"couleur_principale": p, "couleur_secondaire": s})
    Parametres.objects.get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [("noyau", "0001_initial")]
    operations = [migrations.RunPython(creer, migrations.RunPython.noop)]
