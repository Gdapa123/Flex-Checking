from django.db import migrations, models

# Email n°2 envoyé à tout invité présent, avec ou sans lien de magazine (2026-11-10) : textes par défaut
# sans mention obligatoire du magazine. Anciens textes remplacés seulement s'ils n'ont pas été personnalisés.
ANCIEN_OBJET_2 = "Bienvenue · Le magazine de la Graduation {programme} {annee}"
ANCIEN_CORPS_2 = (
    "Bonjour {civilite} {prenom} {nom},\n\n"
    "Votre présence est enregistrée. Nous sommes heureux de vous accueillir ce soir. "
    "Retrouvez dès maintenant le magazine de la promotion {programme} et la brochure Executive Education.\n\n"
    "{lien_magazine}"
)
# copies figées des nouveaux textes (une migration ne dépend jamais des constantes du code)
OBJET_2 = "Bienvenue à la cérémonie de Graduation {programme} {annee}"
CORPS_2 = (
    "Bonjour {civilite} {prenom} {nom},\n\n"
    "Votre présence est enregistrée. Nous sommes heureux de vous accueillir à la cérémonie de Graduation "
    "{programme} {annee}.\n\n"
    "{lien_magazine}"
)


def _remplacer(apps, depuis_objet, vers_objet, depuis_corps, vers_corps):
    Parametres = apps.get_model("noyau", "Parametres")
    Parametres.objects.filter(objet_email_2=depuis_objet).update(objet_email_2=vers_objet)
    Parametres.objects.filter(corps_email_2=depuis_corps).update(corps_email_2=vers_corps)


def appliquer(apps, schema_editor):
    _remplacer(apps, ANCIEN_OBJET_2, OBJET_2, ANCIEN_CORPS_2, CORPS_2)


def annuler(apps, schema_editor):
    _remplacer(apps, OBJET_2, ANCIEN_OBJET_2, CORPS_2, ANCIEN_CORPS_2)


class Migration(migrations.Migration):
    dependencies = [
        ("noyau", "0014_objet_email_1"),
    ]

    operations = [
        migrations.AlterField(
            model_name="parametres",
            name="objet_email_2",
            field=models.CharField(default=OBJET_2, max_length=200),
        ),
        migrations.AlterField(
            model_name="parametres",
            name="corps_email_2",
            field=models.TextField(default=CORPS_2),
        ),
        migrations.RunPython(appliquer, annuler),
    ]
