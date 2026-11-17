import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from .erreurs import enregistrer_exception
from .models import EmailEnvoye, SourceErreur, StatutEmail, TypeEmail

logger = logging.getLogger(__name__)

# 3 nouvelles tentatives avec délai progressif (secondes), puis ECHEC. La dernière attend 30 min : un fournisseur SMTP
# qui bloque une rafale de connexions (17/11/2026) le fait souvent pendant plus de 10 min.
DELAIS = [30, 120, 1800]
# relance d'un email jamais tenté : au-delà du temps d'écoulement d'une rafale au débit limité (`EMAIL_DEBIT_MAX`,
# 20/min : environ 1 000 emails en 1 h) ; plus tôt, la relance doublait des tâches encore en file, qui consommaient
# chacune une place du débit (revue du 2026-11-17)
RELANCE_JAMAIS_PARTI = timedelta(hours=1)
# relance d'un nouvel essai perdu : bien au-delà du dernier délai (30 min) et de l'attente due au débit
RELANCE_ESSAI_PERDU = timedelta(hours=2)


# débit limité (`EMAIL_DEBIT_MAX`) : le fournisseur SMTP bloque les rafales de connexions
@shared_task(bind=True, max_retries=len(DELAIS), acks_late=True, rate_limit=settings.EMAIL_DEBIT_MAX)
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


def _sondage_perime(invite):
    from . import statuts
    from .models import InvitationSondage

    invitation = InvitationSondage.objects.filter(invite=invite).first()
    if invitation is None or invitation.expire:
        return "Sondage non envoyé : lien clos (24 h écoulées)."
    if invite.statut.code != statuts.PRESENT:
        return "Sondage non envoyé : la présence de l’invité a été annulée."
    return ""


def _envoyer(self, email_id, verrou):
    from . import statuts
    from .emails import construire_message

    email = (
        EmailEnvoye.objects.select_related("invite__evenement__programme", "invite__statut").filter(pk=email_id).first()
    )
    if email is None or email.statut == StatutEmail.ENVOYE:
        return
    if email.type == TypeEmail.MAGAZINE and email.invite.statut.code != statuts.PRESENT:
        # présence annulée pendant que l'email attendait son tour (débit limité, nouvelle tentative) : comme le renvoi
        # manuel, l'email n°2 n'est envoyé qu'à un invité présent
        email.statut, email.erreur = StatutEmail.ECHEC, "Email n°2 non envoyé : la présence de l’invité a été annulée."
        email.save(update_fields=["statut", "erreur"])
        return
    if email.type == TypeEmail.SONDAGE and (raison := _sondage_perime(email.invite)):
        # relance tardive (file indisponible, nouvelle tentative) : jamais de lien déjà clos ni d'invité plus présent
        email.statut, email.erreur = StatutEmail.ECHEC, raison
        email.save(update_fields=["statut", "erreur"])
        return
    email.tentatives += 1
    email.derniere_tentative_le = timezone.now()
    try:
        construire_message(email).send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 — toute erreur SMTP/rendu compte comme un échec
        email.erreur = f"{type(exc).__name__}: {exc}"[:2000]
        # Sans file d'attente (environnement de test Vercel) : une seule tentative, pour ne jamais bloquer la
        # requête de l'utilisateur ; l'email apparaît alors « à renvoyer » pour un renvoi manuel.
        if email.tentatives <= len(DELAIS) and not settings.ENVOI_SANS_FILE:
            email.save(update_fields=["tentatives", "derniere_tentative_le", "erreur"])
            logger.warning("Email %s : échec de la tentative %s, nouvel essai programmé.", email.pk, email.tentatives)
            cache.delete(verrou)  # la nouvelle tentative doit pouvoir reprendre le verrou
            raise self.retry(exc=exc, countdown=DELAIS[email.tentatives - 1]) from exc
        email.statut = StatutEmail.ECHEC
        email.save(update_fields=["tentatives", "derniere_tentative_le", "erreur", "statut"])
        logger.error("Email %s : échec définitif après %s tentatives.", email.pk, email.tentatives)
        enregistrer_exception(SourceErreur.EMAIL, exc, lieu=f"Email « {email.get_type_display()} »")
        return
    email.statut = StatutEmail.ENVOYE
    email.envoye_le = timezone.now()
    email.erreur = ""
    email.save(update_fields=["tentatives", "derniere_tentative_le", "statut", "envoye_le", "erreur"])


@shared_task
def relancer_emails_en_attente():
    """Emails jamais partis (file d'attente indisponible au moment de l'inscription) : relancés.

    Sont repris les emails sans aucune tentative créés depuis plus d'une heure (`RELANCE_JAMAIS_PARTI`), et ceux dont
    la DERNIÈRE tentative date de plus de deux heures (`RELANCE_ESSAI_PERDU`, bien au-delà des délais de 30 s, 2 min
    et 30 min) : leur nouvel essai programmé a été perdu (file Redis vidée ou redémarrée). Un email en plein cycle de
    nouvelles tentatives, ou qui attend son tour derrière le débit limité, n'est pas touché.
    """
    maintenant = timezone.now()
    perdu = maintenant - RELANCE_ESSAI_PERDU
    jamais_partis = Q(tentatives=0, cree_le__lt=maintenant - RELANCE_JAMAIS_PARTI)
    tentative_perdue = Q(tentatives__gte=1) & (
        Q(derniere_tentative_le__lt=perdu) | Q(derniere_tentative_le__isnull=True, cree_le__lt=perdu)
    )
    ids = list(
        EmailEnvoye.objects.filter(statut=StatutEmail.EN_ATTENTE)
        .filter(jamais_partis | tentative_perdue)
        .values_list("pk", flat=True)[:500]
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
def envoyer_sondages():
    """Email n°3 : sondage de satisfaction aux présents des cérémonies de la veille (à partir de 8 h)."""
    from .sondages import planifier_sondages

    return planifier_sondages()["programmes"]


@shared_task
def anonymiser_donnees():
    """Données personnelles des cérémonies dont la durée de conservation est écoulée : anonymisées."""
    from .donnees_personnelles import anonymiser_donnees_expirees

    return anonymiser_donnees_expirees()


@shared_task
def purger():
    """Fichiers d'export oubliés, erreurs techniques de plus de 30 jours, jetons de session expirés (et texte des
    jetons enregistrés avant `comptes.jetons`)."""
    from apps.comptes.jetons import purger_jetons

    from .erreurs import purger as purger_erreurs
    from .taches import purger_exports

    purger_exports()
    purger_erreurs()
    purger_jetons()


@shared_task(ignore_result=True)
def envoyer_alerte(sujet, texte):
    """Email d'alerte aux super admins (voir `alertes`) ; un échec est seulement journalisé, sans nouvelle tentative."""
    from .alertes import envoyer

    return envoyer(sujet, texte)
