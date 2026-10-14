"""Recale les inscriptions datées dans le futur (anciennes données de démonstration).

Pour chaque événement concerné, toutes ses inscriptions et leurs emails sont décalés du même intervalle, de sorte
que la plus récente tombe une heure avant maintenant : l'étalement des dates est conservé. Le formulaire et l'ajout
manuel datent l'inscription à l'heure du serveur : sur des données réelles, cette migration ne change rien.
"""

from datetime import timedelta

from django.db import migrations
from django.db.models import Max
from django.utils import timezone


def recaler(apps, schema_editor):
    Invite = apps.get_model("noyau", "Invite")
    EmailEnvoye = apps.get_model("noyau", "EmailEnvoye")
    maintenant = timezone.now()
    evenements = (
        Invite.objects.filter(inscrit_le__gt=maintenant).values_list("evenement_id", flat=True).distinct()
    )
    for evenement_id in list(evenements):
        invites = Invite.objects.filter(evenement_id=evenement_id)
        plus_recente = invites.aggregate(m=Max("inscrit_le"))["m"]
        decalage = plus_recente - maintenant + timedelta(hours=1)
        for invite in invites.iterator():
            invite.inscrit_le -= decalage
            if invite.consentement_le:  # consentement donné au moment de l'inscription
                invite.consentement_le -= decalage
            invite.save(update_fields=["inscrit_le", "consentement_le"])
        for envoi in EmailEnvoye.objects.filter(invite__evenement_id=evenement_id, type="INVITATION"):
            envoi.cree_le -= decalage
            if envoi.envoye_le:
                envoi.envoye_le -= decalage
            envoi.save(update_fields=["cree_le", "envoye_le"])


class Migration(migrations.Migration):
    dependencies = [
        ("noyau", "0007_anciens_slugs"),
    ]

    operations = [
        migrations.RunPython(recaler, migrations.RunPython.noop),
    ]
