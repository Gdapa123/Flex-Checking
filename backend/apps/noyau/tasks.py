import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .erreurs import enregistrer_exception
from .models import EmailEnvoye, SourceErreur, StatutEmail

logger = logging.getLogger(__name__)

# 3 nouvelles tentatives avec délai progressif (secondes), puis ECHEC.
DELAIS = [30, 120, 480]


@shared_task(bind=True, max_retries=len(DELAIS), acks_late=True)
def envoyer_email(self, email_id):
    # un seul envoi à la fois par email (une relance planifiée peut croiser une tâche encore en file)
    # (`is False` : si Redis est indisponible, le cache répond None et l'envoi a lieu quand même)
    verrou = f"email-envoi:{email_id}"
    if cache.add(verrou, 1, timeout=300) is False:
        return
    try:
        _envoyer(self, email_id, verrou)
    finally:
        cache.delete(verrou)


def _envoyer(self, email_id, verrou):
    from .emails import construire_message

    email = EmailEnvoye.objects.select_related("invite__evenement__programme").filter(pk=email_id).first()
    if email is None or email.statut == StatutEmail.ENVOYE:
        return
    email.tentatives += 1
    try:
        construire_message(email).send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 — toute erreur SMTP/rendu compte comme un échec
        email.erreur = f"{type(exc).__name__}: {exc}"[:2000]
        # Sans file d'attente (environnement de test Vercel) : une seule tentative, pour ne jamais bloquer la
        # requête de l'utilisateur ; l'email apparaît alors « à renvoyer » pour un renvoi manuel.
        if email.tentatives <= len(DELAIS) and not settings.ENVOI_SANS_FILE:
            email.save(update_fields=["tentatives", "erreur"])
            logger.warning("Email %s : échec de la tentative %s, nouvel essai programmé.", email.pk, email.tentatives)
            cache.delete(verrou)  # la nouvelle tentative doit pouvoir reprendre le verrou
            raise self.retry(exc=exc, countdown=DELAIS[email.tentatives - 1]) from exc
        email.statut = StatutEmail.ECHEC
        email.save(update_fields=["tentatives", "erreur", "statut"])
        logger.error("Email %s : échec définitif après %s tentatives.", email.pk, email.tentatives)
        enregistrer_exception(SourceErreur.EMAIL, exc, lieu=f"Email « {email.get_type_display()} »")
        return
    email.statut = StatutEmail.ENVOYE
    email.envoye_le = timezone.now()
    email.erreur = ""
    email.save(update_fields=["tentatives", "statut", "envoye_le", "erreur"])


@shared_task
def relancer_emails_en_attente():
    """Emails jamais partis (file d'attente indisponible au moment de l'inscription) : relancés.

    Seuls les emails sans aucune tentative et créés depuis plus de 15 minutes sont repris ; ceux
    qui attendent une nouvelle tentative programmée sont déjà dans la file.
    """
    limite = timezone.now() - timedelta(minutes=15)
    ids = list(
        EmailEnvoye.objects.filter(statut=StatutEmail.EN_ATTENTE, tentatives=0, cree_le__lt=limite).values_list(
            "pk", flat=True
        )[:500]
    )
    relances = 0
    for email_id in ids:
        # file encombrée : un email déjà relancé et toujours en file n'est pas remis en file toutes les 5 min
        # (`is False` : Redis indisponible → relance quand même)
        if cache.add(f"email-relance:{email_id}", 1, timeout=1800) is False:
            continue
        envoyer_email.delay(email_id)
        relances += 1
    return relances


@shared_task
def purger():
    """Fichiers d'export oubliés et erreurs techniques de plus de 30 jours."""
    from .erreurs import purger as purger_erreurs
    from .taches import purger_exports

    purger_exports()
    purger_erreurs()
