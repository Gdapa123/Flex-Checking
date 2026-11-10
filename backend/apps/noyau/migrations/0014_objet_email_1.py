from django.db import migrations, models

# objet par défaut précédent : remplacé seulement s'il n'a pas été personnalisé par le super admin
ANCIEN_OBJET_1 = "Votre invitation · Graduation {programme} {annee}"
# copie figée du nouveau texte (une migration ne dépend jamais des constantes du code)
OBJET_1 = "Votre inscription à la cérémonie de Graduation {programme} {annee}"


def appliquer(apps, schema_editor):
    apps.get_model("noyau", "Parametres").objects.filter(objet_email_1=ANCIEN_OBJET_1).update(objet_email_1=OBJET_1)


def annuler(apps, schema_editor):
    apps.get_model("noyau", "Parametres").objects.filter(objet_email_1=OBJET_1).update(objet_email_1=ANCIEN_OBJET_1)


class Migration(migrations.Migration):
    dependencies = [
        ("noyau", "0013_carte_invitation"),
    ]

    operations = [
        migrations.AlterField(
            model_name="parametres",
            name="objet_email_1",
            field=models.CharField(default=OBJET_1, max_length=200),
        ),
        migrations.RunPython(appliquer, annuler),
    ]
