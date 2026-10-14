"""Supprime les invités dont la date d'inscription est dans le futur (anciennes données de démonstration).

Leurs emails et émargements sont supprimés avec eux (cascade). Le formulaire et l'ajout manuel datent l'inscription
à l'heure du serveur : sur des données réelles, cette migration ne supprime rien.
"""

from django.db import migrations
from django.utils import timezone


def supprimer(apps, schema_editor):
    Invite = apps.get_model("noyau", "Invite")
    Invite.objects.filter(inscrit_le__gt=timezone.now()).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("noyau", "0007_anciens_slugs"),
    ]

    operations = [
        migrations.RunPython(supprimer, migrations.RunPython.noop),
    ]
