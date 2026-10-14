"""Sondage de satisfaction : page publique (lien personnel), déclencheur du cron et résultats."""

import hmac
import secrets

from django.conf import settings
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.comptes.permissions import EstSuperAdmin
from apps.comptes.throttles import LimiteIpPartagee

from . import sondages
from .serializers import tokens_programme

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
        return Response(sondages.planifier_sondages())


class SondagesGlobalView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(responses={200: None}, summary="Satisfaction : cumul et détail par cérémonie (super admin)")
    def get(self, request):
        return Response(sondages.resume_global())
