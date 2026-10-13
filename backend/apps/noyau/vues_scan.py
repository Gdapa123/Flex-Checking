"""Scan : émargement (QR, douchette, code, manuel), annulation, derniers passages."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.comptes.authentication import est_borne
from apps.comptes.permissions import EstAdmin, evenements_visibles
from apps.comptes.throttles import CacheDeSecours, LimiteSensible

from . import services
from .models import Emargement, Parametres
from .serializers import EmargementRequeteSerializer, EmargementResultatSerializer, ParametresScanSerializer

# Anti force brute sur les codes à 4 chiffres : on compte les codes INVALIDES par compte et par
# événement (indépendamment du poste, que le client choisit librement). Une borne très active qui
# saisit des codes valides n'est jamais bloquée ; une tentative de deviner les codes l'est.
MAX_CODES_INVALIDES = 30
FENETRE_CODES_S = 10 * 60


def _cle_codes_invalides(user, evenement):
    return f"codes-invalides:{user.pk}:{evenement.pk}"


class EmargementView(APIView):
    permission_classes = [EstAdmin]
    autorise_borne = True

    @extend_schema(
        request=EmargementRequeteSerializer,
        responses={200: EmargementResultatSerializer},
        summary="Émarger un invité (atomique et idempotent)",
    )
    def post(self, request, pk):
        evenement = get_object_or_404(evenements_visibles(request.user), pk=pk)
        ser = EmargementRequeteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        cle = _cle_codes_invalides(request.user, evenement)
        # compteur partagé entre instances (Redis, ou base sans Redis) : le verrouillage ne se contourne pas
        # en tombant sur un autre processus. Chaque essai de code est compté AVANT l'émargement (incrément
        # atomique : des requêtes parallèles ne passent pas toutes le contrôle), puis retiré s'il était valide.
        limites = CacheDeSecours()
        if d.get("code") and limites.incrementer(cle, FENETRE_CODES_S) > MAX_CODES_INVALIDES:
            return Response(
                {"code": "TROP_DE_TENTATIVES", "detail": "Trop de codes invalides. Patientez quelques minutes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        resultat = services.emarger(
            evenement,
            request.user,
            qr_token=d.get("qr_token"),
            code=d.get("code"),
            invite_id=d.get("invite_id"),
            mode=d["mode"],
            poste=d.get("poste", ""),
            appareil=d["appareil"],
            date_client=d.get("date_client"),
        )
        if d.get("code") and resultat["resultat"] != services.CODE_INVALIDE:
            limites.decrementer(cle)  # code valide : ne compte pas comme une tentative
        return Response(EmargementResultatSerializer(resultat).data)


class AnnulationSerializer(serializers.Serializer):
    motif = serializers.CharField(required=False, allow_blank=True, max_length=200, default="")


class AnnulationView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(request=AnnulationSerializer, responses={200: None}, summary="Annuler un émargement")
    def post(self, request, pk):
        emargement = get_object_or_404(
            Emargement.objects.filter(invite__evenement__in=evenements_visibles(request.user)), pk=pk
        )
        ser = AnnulationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        invite = services.annuler_emargement(emargement, request.user, ser.validated_data["motif"])
        presents, inscrits = services.compteurs(invite.evenement)
        return Response(
            {
                "resultat": "ANNULE",
                "inviteId": invite.pk,
                "nomComplet": invite.nom_complet,
                "presents": presents,
                "inscrits": inscrits,
            }
        )


class RecentsView(APIView):
    permission_classes = [EstAdmin]
    autorise_borne = True  # compteurs seulement en mode borne (aucun nom d'invité)

    @extend_schema(responses={200: None}, summary="Derniers passages de l'événement")
    def get(self, request, pk):
        evenement = get_object_or_404(evenements_visibles(request.user), pk=pk)
        qs = (
            Emargement.objects.filter(invite__evenement=evenement)
            .select_related("invite", "admin")
            .order_by("-date")[:30]
        )
        presents, inscrits = services.compteurs(evenement)
        if est_borne(request.auth):
            return Response({"presents": presents, "inscrits": inscrits, "passages": []})
        return Response(
            {
                "presents": presents,
                "inscrits": inscrits,
                "passages": [
                    {
                        "id": e.pk,
                        "date": e.date,
                        "inviteId": e.invite_id,
                        "nomComplet": e.invite.nom_complet,
                        "mode": e.mode,
                        "poste": e.poste,
                        "appareil": e.appareil,
                        "admin": e.admin.nom if e.admin else "Compte supprimé",
                        "annule": e.annule_le is not None,
                    }
                    for e in qs
                ],
            }
        )


class ParametresScanView(APIView):
    permission_classes = [EstAdmin]
    autorise_borne = True

    @extend_schema(responses={200: ParametresScanSerializer}, summary="Réglages globaux du scan")
    def get(self, request):
        return Response(ParametresScanSerializer(Parametres.charger()).data)


RECHERCHE_BORNE_MIN = 3
RECHERCHE_BORNE_MAX = 10


class RechercheBorneThrottle(LimiteSensible):
    """Recherches de la borne par compte : assez pour des invités qui cherchent leur nom, trop peu pour extraire la
    liste des invités en balayant les combinaisons de lettres."""

    scope = "recherche_borne"

    def get_cache_key(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class RechercheBorneView(APIView):
    """« Rechercher mon nom » sur la borne libre-service : nom, prénom ou entreprise, 10 résultats au plus, sans email,
    téléphone ni code. Chaque mot doit compter 3 caractères (contrôlé ici, pas seulement dans le navigateur) : une
    suite de lettres isolées (« a e ») ne doit pas lister tous les invités."""

    permission_classes = [EstAdmin]
    autorise_borne = True
    throttle_classes = [RechercheBorneThrottle]

    @extend_schema(responses={200: None}, summary="Recherche réduite de la borne libre-service")
    def get(self, request, pk):
        from django.db.models import Q

        evenement = get_object_or_404(evenements_visibles(request.user), pk=pk)
        mots = [m for m in (request.query_params.get("q") or "").split() if len(m) >= RECHERCHE_BORNE_MIN][:4]
        if not mots:
            return Response({"total": 0, "resultats": []})
        qs = evenement.invites.select_related("statut")
        for mot in mots:
            qs = qs.filter(Q(nom__icontains=mot) | Q(prenom__icontains=mot) | Q(entreprise__icontains=mot))
        invites = list(qs.order_by("nom", "prenom", "pk")[:RECHERCHE_BORNE_MAX])
        return Response(
            {
                "total": len(invites),
                "resultats": [
                    {
                        "id": i.pk,
                        "nomComplet": i.nom_complet,
                        "entreprise": i.entreprise,
                        "statut": i.statut.code,
                        "presentLe": i.present_le,
                    }
                    for i in invites
                ],
            }
        )
