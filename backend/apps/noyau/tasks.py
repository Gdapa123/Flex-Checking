import logging

from celery import shared_task
from django.utils import timezone

from .models import EmailEnvoye, StatutEmail

logger = logging.getLogger(__name__)

# 3 nouvelles tentatives avec délai progressif (secondes), puis ECHEC.
DELAIS = [30, 120, 480]


@shared_task(bind=True, max_retries=len(DELAIS), acks_late=True)
def envoyer_email(self, email_id):
    from .emails import construire_message

    email = EmailEnvoye.objects.select_related("invite__evenement__programme").filter(pk=email_id).first()
    if email is None or email.statut == StatutEmail.ENVOYE:
        return
    email.tentatives += 1
    try:
        construire_message(email).send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 — toute erreur SMTP/rendu compte comme un échec
        email.erreur = f"{type(exc).__name__}: {exc}"[:2000]
        if email.tentatives <= len(DELAIS):
            email.save(update_fields=["tentatives", "erreur"])
            logger.warning("Email %s : échec de la tentative %s, nouvel essai programmé.", email.pk, email.tentatives)
            raise self.retry(exc=exc, countdown=DELAIS[email.tentatives - 1]) from exc
        email.statut = StatutEmail.ECHEC
        email.save(update_fields=["tentatives", "erreur", "statut"])
        logger.error("Email %s : échec définitif après %s tentatives.", email.pk, email.tentatives)
        return
    email.statut = StatutEmail.ENVOYE
    email.envoye_le = timezone.now()
    email.erreur = ""
    email.save(update_fields=["tentatives", "statut", "envoye_le", "erreur"])
