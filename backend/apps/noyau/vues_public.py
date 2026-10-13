"""Espace invité : public, sans compte, avec limitation de débit."""

import hashlib
from datetime import UTC

from django.core.cache import cache
from django.http import Http404, HttpResponse
from django.utils.text import slugify
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.comptes.throttles import CacheDeSecours, LimiteIpPartagee, LimiteSensible, email_soumis

from . import caches, emails, services
from .exceptions import ErreurMetier
from .ics import bornes, description_agenda, ics_evenement
from .models import Evenement, Invite, TypeEmail
from .serializers import InscriptionSerializer, tokens_programme
from .validation import valider_email

MESSAGE_RENVOI = (
    "Si cette adresse est inscrite, votre invitation vient d’être renvoyée. "
    "Pensez à vérifier vos courriers indésirables."
)


class InscriptionThrottle(LimiteIpPartagee):
    scope = "inscription"


class RenvoiIpThrottle(LimiteIpPartagee):
    scope = "renvoi_ip"


class RenvoiEmailThrottle(LimiteSensible):
    """3 renvois par heure et par adresse (clé hachée : aucune adresse en clair dans le cache)."""

    scope = "renvoi_email"

    def get_cache_key(self, request, view):
        email = email_soumis(request)
        if not email:
            return None
        cle = hashlib.sha256(f"{view.kwargs.get('slug')}:{email}".encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": cle}


def evenement_public(slug, anciens=True):
    """Événement d'un lien public. `anciens` : accepte aussi un lien remplacé par une régénération (lecture,
    agenda, renvoi de l'invitation) ; les nouvelles inscriptions passent uniquement par le lien actuel."""
    qs = Evenement.objects.select_related("programme")
    ev = qs.filter(slug_inscription=slug).first()
    if ev is None and anciens:
        ev = qs.filter(anciens_slugs__slug=slug).first()
    if ev is None:
        raise Http404
    return ev


class EvenementPublicView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: None, 404: None}, summary="Infos publiques d'un événement (+ couleurs)")
    def get(self, request, slug):
        # page la plus consultée (lien d'inscription partagé à des centaines d'invités) : mise en cache,
        # vidée dès que l'événement, son programme ou ses inscriptions changent
        donnees = cache.get(caches.cle_public(slug))
        if donnees is None:
            ev = evenement_public(slug)
            donnees = self._donnees(ev, slug)
            if ev.slug_inscription == slug:
                cache.set(caches.cle_public(slug), donnees, caches.DUREE)
        return Response(donnees)

    @staticmethod
    def _donnees(ev, slug):
        debut, fin = bornes(ev)
        ancien = ev.slug_inscription != slug
        return {
            # ancien lien : on renvoie le slug demandé, jamais le nouveau (la régénération sert à retirer un lien
            # qui a trop circulé) et les inscriptions y sont présentées comme fermées
            "slug": slug,
            "nomAffiche": ev.nom_affiche,
            "programme": ev.programme.nom,
            "annee": ev.annee,
            "tokens": tokens_programme(ev.programme),
            "date": ev.date,
            "heureDebut": ev.heure_debut.strftime("%H:%M"),
            "heureAccueil": ev.heure_accueil.strftime("%H:%M"),
            "lieu": ev.lieu,
            "lienCarte": ev.lien_carte,
            # bornes UTC pour les liens Google Agenda / Outlook (même contenu que le fichier .ics)
            "agenda": {
                "debut": debut.astimezone(UTC).isoformat().replace("+00:00", "Z"),
                "fin": fin.astimezone(UTC).isoformat().replace("+00:00", "Z"),
                "description": description_agenda(ev, slug),
            },
            "dateLimiteInscription": ev.date_limite_inscription,
            "magazineActif": bool(ev.programme.magazine_actif and ev.programme.lien_magazine),
            "etat": services.FERME if ancien else services.etat_inscriptions(ev),
        }


class InscriptionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [InscriptionThrottle]

    @extend_schema(request=InscriptionSerializer, responses={201: None, 400: None, 409: None})
    def post(self, request, slug):
        ev = evenement_public(slug, anciens=False)
        ser = InscriptionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            invite = services.inscrire(ev, d)
        except ErreurMetier as exc:
            if exc.code != "DEJA_INSCRIT":
                raise
            # Adresse déjà inscrite : même réponse qu'une inscription réussie (le formulaire public ne doit pas
            # révéler qui est inscrit) ; la vraie personne reçoit de nouveau son invitation, au plus 3 fois par heure.
            existant = Invite.objects.filter(evenement=ev, email=d["email"]).first()
            if existant is not None and _renvoi_autorise(ev, d["email"]):
                emails.planifier(existant, TypeEmail.INVITATION)
            invite = Invite(civilite=d["civilite"], prenom=d["prenom"].strip(), nom=d["nom"].strip())
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


RENVOIS_AUTOMATIQUES_PAR_HEURE = 3


def _renvoi_autorise(evenement, email):
    """Limite les renvois déclenchés par une nouvelle inscription d'une adresse déjà inscrite (pas
    d'envoi en rafale vers la boîte d'un tiers). Clé hachée : aucune adresse en clair dans le cache."""
    cle = "renvoi-auto:" + hashlib.sha256(f"{evenement.pk}:{email}".encode()).hexdigest()
    cache = CacheDeSecours()
    n = cache.get(cle) or 0
    if n >= RENVOIS_AUTOMATIQUES_PAR_HEURE:
        return False
    cache.set(cle, n + 1, 3600)
    return True


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
        reponse = HttpResponse(ics_evenement(ev, slug), content_type="text/calendar; charset=utf-8")
        nom = f"graduation-{slugify(ev.programme.nom)}-{ev.annee}.ics"
        reponse["Content-Disposition"] = f'attachment; filename="{nom}"'
        return reponse
