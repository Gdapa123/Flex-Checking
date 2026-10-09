"""Espace invité : public, sans compte, avec limitation de débit."""

import hashlib

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle
from rest_framework.views import APIView

from . import emails, services
from .ics import ics_evenement
from .models import Evenement, Invite, TypeEmail
from .serializers import InscriptionSerializer, tokens_programme
from .validation import valider_email

MESSAGE_RENVOI = (
    "Si cette adresse est inscrite, votre invitation vient d’être renvoyée. "
    "Pensez à vérifier vos courriers indésirables."
)


class InscriptionThrottle(AnonRateThrottle):
    scope = "inscription"


class RenvoiIpThrottle(AnonRateThrottle):
    scope = "renvoi_ip"


class RenvoiEmailThrottle(SimpleRateThrottle):
    """3 renvois par heure et par adresse (clé hachée : aucune adresse en clair dans le cache)."""

    scope = "renvoi_email"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return None
        cle = hashlib.sha256(f"{view.kwargs.get('slug')}:{email}".encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": cle}


def evenement_public(slug):
    return get_object_or_404(Evenement.objects.select_related("programme"), slug_inscription=slug)


class EvenementPublicView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: None, 404: None}, summary="Infos publiques d'un événement (+ couleurs)")
    def get(self, request, slug):
        ev = evenement_public(slug)
        return Response(
            {
                "slug": ev.slug_inscription,
                "nomAffiche": ev.nom_affiche,
                "programme": ev.programme.nom,
                "annee": ev.annee,
                "tokens": tokens_programme(ev.programme),
                "date": ev.date,
                "heureDebut": ev.heure_debut.strftime("%H:%M"),
                "heureAccueil": ev.heure_accueil.strftime("%H:%M"),
                "lieu": ev.lieu,
                "lienCarte": ev.lien_carte,
                "dateLimiteInscription": ev.date_limite_inscription,
                "etat": services.etat_inscriptions(ev),
            }
        )


class InscriptionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [InscriptionThrottle]

    @extend_schema(request=InscriptionSerializer, responses={201: None, 400: None, 409: None})
    def post(self, request, slug):
        ev = evenement_public(slug)
        ser = InscriptionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        invite = services.inscrire(ev, ser.validated_data)
        return Response(
            {
                "invite": {
                    "civilite": invite.civilite,
                    "civiliteAffichee": invite.civilite_affichee,
                    "prenom": invite.prenom,
                    "nom": invite.nom,
                    "statut": "INSCRIT",
                },
            },
            status=status.HTTP_201_CREATED,
        )


class RenvoiSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=254)

    def validate_email(self, v):
        return valider_email(v)


class RenvoiQrView(APIView):
    """Renvoie l'invitation. La réponse est toujours identique : elle ne confirme jamais qu'une
    adresse est inscrite."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [RenvoiIpThrottle, RenvoiEmailThrottle]

    @extend_schema(request=RenvoiSerializer, responses={202: None})
    def post(self, request, slug):
        ev = evenement_public(slug)
        ser = RenvoiSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        invite = Invite.objects.filter(evenement=ev, email=ser.validated_data["email"]).first()
        if invite is not None:
            emails.planifier(invite, TypeEmail.INVITATION)
        return Response({"detail": MESSAGE_RENVOI}, status=status.HTTP_202_ACCEPTED)


class AgendaView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={(200, "text/calendar"): bytes}, summary="Fichier .ics de l'événement")
    def get(self, request, slug):
        ev = evenement_public(slug)
        reponse = HttpResponse(ics_evenement(ev), content_type="text/calendar; charset=utf-8")
        nom = f"graduation-{slugify(ev.programme.nom)}-{ev.annee}.ics"
        reponse["Content-Disposition"] = f'attachment; filename="{nom}"'
        return reponse
