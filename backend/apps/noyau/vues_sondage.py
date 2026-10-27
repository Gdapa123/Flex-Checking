"""Sondage de satisfaction : page publique (lien personnel), déclencheur du cron et résultats."""

import hmac
import logging
import re
import secrets
from urllib.parse import quote, urlencode

from django.conf import settings
from django.http import Http404, HttpResponseRedirect
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.parsers import FormParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.comptes.permissions import EstSuperAdmin
from apps.comptes.throttles import LimiteIpPartagee

from . import sondages
from .donnees_personnelles import anonymiser_donnees_expirees
from .exceptions import ErreurMetier
from .serializers import tokens_programme
from .validation import CONTROLE_MULTILIGNE_RE, sans_controle_multiligne

logger = logging.getLogger(__name__)

COOKIE_APPAREIL = "fc_appareil"
LONGUEUR_MIN_SECRET = 32
DUREE_COOKIE = 30 * 24 * 3600  # assez pour la fenêtre de 24 h et un éventuel renvoi, sans traceur durable


class SondageThrottle(LimiteIpPartagee):
    scope = "sondage"


class ReponseSondageSerializer(serializers.Serializer):
    note_globale = serializers.IntegerField(min_value=1, max_value=5)
    note_accueil = serializers.IntegerField(min_value=1, max_value=5)
    recommandation = serializers.IntegerField(min_value=0, max_value=10)
    commentaire = serializers.CharField(required=False, allow_blank=True, max_length=1000, trim_whitespace=True)
    # identifiant tiré par le navigateur (localStorage) : second repère si les cookies sont effacés ou bloqués
    appareil = serializers.RegexField(r"^[A-Za-z0-9_-]{16,64}$", required=False, allow_blank=True)

    def validate_commentaire(self, valeur):
        return sans_controle_multiligne(valeur)


def _invitation(jeton):
    invitation = sondages.invitation_par_jeton(jeton)
    if invitation is None:
        raise Http404
    return invitation


def _donnees(invitation):
    invite = invitation.invite
    ev = invite.evenement
    etat = sondages.etat_lien(invitation)
    # lien clos : plus aucune donnée personnelle (le lien peut traîner dans une boîte mail partagée)
    ouvert = etat == "OUVERT"
    return {
        "etat": etat,
        "prenom": invite.prenom if ouvert else "",
        "civilite": invite.civilite_affichee if ouvert else "",
        "expireLe": invitation.expire_le.isoformat(),
        "evenement": {
            "nomAffiche": ev.nom_affiche,
            "programme": ev.programme.nom,
            "annee": ev.annee,
            "date": ev.date,
            "tokens": tokens_programme(ev.programme),
        },
    }


def _poser_cookie(request, reponse):
    if request.COOKIES.get(COOKIE_APPAREIL):
        return
    reponse.set_cookie(
        COOKIE_APPAREIL,
        secrets.token_urlsafe(24),
        max_age=DUREE_COOKIE,
        path="/api/public/sondages/",
        secure=settings.JWT_COOKIE_SECURE,
        httponly=True,
        samesite="Lax",
    )


class SondagePublicView(APIView):
    """Lien personnel de l'email n°3 : lecture (état du lien) et réponse unique."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SondageThrottle]

    @extend_schema(responses={200: None, 404: None}, summary="État du sondage (OUVERT, EXPIRE, REPONDU)")
    def get(self, request, jeton):
        reponse = Response(_donnees(_invitation(jeton)))
        reponse["Cache-Control"] = "no-store"
        _poser_cookie(request, reponse)
        return reponse

    @extend_schema(request=ReponseSondageSerializer, responses={201: None, 409: None, 410: None})
    def post(self, request, jeton):
        invitation = _invitation(jeton)
        ser = ReponseSondageSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = dict(ser.validated_data)
        local = d.pop("appareil", "")
        cookie = request.COOKIES.get(COOKIE_APPAREIL, "")[:64]
        if not cookie and not local:
            raise serializers.ValidationError({"appareil": "Identifiant d’appareil manquant."})
        sondages.repondre(invitation, {"commentaire": "", **d}, appareil_cookie=cookie, appareil_local=local)
        reponse = Response({"etat": "REPONDU"}, status=status.HTTP_201_CREATED)
        _poser_cookie(request, reponse)
        return reponse


# champs du formulaire de l'email n°3 et noms repris dans l'adresse de la page (questions manquantes)
CHAMPS_EMAIL = ("note_globale", "note_accueil", "recommandation", "commentaire")
RETOUR_NOTES = {"note_globale": "globale", "note_accueil": "accueil", "recommandation": "reco"}
MAX_COMMENTAIRE = 1000
# forme d'un jeton (`secrets.token_urlsafe(24)`) : tout autre texte est écarté avant la base
JETON_RE = re.compile(r"[A-Za-z0-9_-]{16,64}")
# refus attendus, affichés par la page du sondage d'après l'état du lien
REFUS_AFFICHES = {"DEJA_REPONDU", "SONDAGE_EXPIRE"}


def _commentaire_email(valeur):
    """Comme la page (`SondagePage`) : caractères de contrôle retirés. Le formulaire envoie les sauts de ligne en
    CRLF (deux caractères, alors que `maxlength` en compte un) : ramenés à LF, puis longueur bornée si la messagerie
    ignore `maxlength`."""
    texte = valeur.replace("\r\n", "\n").replace("\r", "\n")
    return CONTROLE_MULTILIGNE_RE.sub("", texte)[:MAX_COMMENTAIRE]


def _notes_valides(ser, donnees):
    """Notes acceptées par le sérialiseur (valeur convertie, pas le texte reçu), reprises par la page."""
    return {
        cle: ser.fields[champ].run_validation(donnees[champ])
        for champ, cle in RETOUR_NOTES.items()
        if champ not in ser.errors
    }


def _vers_page(jeton, **parametres):
    """Retour sur la page du sondage, qui affiche l'état du lien (merci, clos, lien inconnu…)."""
    suite = f"?{urlencode(parametres)}" if parametres else ""
    return HttpResponseRedirect(f"{settings.APP_PUBLIC_URL}/sondage/{quote(jeton, safe='')}{suite}", status=303)


class SondageReponseEmailView(APIView):
    """Formulaire intégré à l'email n°3 : envoi classique (POST de formulaire) depuis la messagerie.

    Pas de jeton CSRF ni d'identifiant d'appareil possibles dans un email : le jeton du lien suffit (une réponse par
    lien). L'appareil enregistré est un tirage aléatoire, sans lien avec l'invité (réponses anonymes).
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SondageThrottle]
    parser_classes = [FormParser]

    @extend_schema(exclude=True)
    def get(self, request, jeton):
        return _vers_page(jeton)

    @extend_schema(exclude=True)
    def post(self, request, jeton):
        invitation = sondages.invitation_par_jeton(jeton) if JETON_RE.fullmatch(jeton) else None
        if invitation is None:
            return _vers_page(jeton)  # la page affiche « lien non valide »
        donnees = {k: request.data.get(k, "") for k in CHAMPS_EMAIL}
        donnees["commentaire"] = _commentaire_email(donnees["commentaire"])
        ser = ReponseSondageSerializer(data=donnees)
        if not ser.is_valid():
            # le commentaire étant nettoyé, seules des notes peuvent manquer : la page reprend les autres
            return _vers_page(jeton, incomplet=1, **_notes_valides(ser, donnees))
        try:
            sondages.repondre(
                invitation,
                {"commentaire": "", **ser.validated_data},
                appareil_cookie=secrets.token_urlsafe(24),
                appareil_local="",
            )
        except ErreurMetier as exc:
            if exc.code not in REFUS_AFFICHES:
                logger.warning("Réponse au sondage depuis l'email refusée : %s", exc.code)
        return _vers_page(jeton)


class CronSondagesView(APIView):
    """Déclencheur du cron de la plateforme (environnement sans Celery Beat). Protégé par `CRON_SECRET`."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    @extend_schema(responses={200: None, 404: None}, summary="Envoi planifié des sondages (cron)")
    def get(self, request):
        attendu = settings.CRON_SECRET
        recu = request.headers.get("Authorization", "")
        # secret absent ou trop court (devinable) : route désactivée
        if len(attendu) < LONGUEUR_MIN_SECRET or not hmac.compare_digest(recu.encode(), f"Bearer {attendu}".encode()):
            raise Http404  # route invisible sans le secret
        resultat = sondages.planifier_sondages()
        # sans Celery Beat, la conservation limitée des données personnelles passe par le même cron quotidien
        resultat["anonymisation"] = anonymiser_donnees_expirees()
        return Response(resultat)


class SondagesGlobalView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(responses={200: None}, summary="Satisfaction : cumul et détail par cérémonie (super admin)")
    def get(self, request):
        return Response(sondages.resume_global())
