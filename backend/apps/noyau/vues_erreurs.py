"""Erreurs techniques : signalement par le navigateur (public) et consultation par le super admin."""

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.comptes.permissions import EstSuperAdmin

from .erreurs import enregistrer
from .models import ErreurTechnique, SourceErreur
from .validation import donnees_objet, entier


class SignalementThrottle(AnonRateThrottle):
    scope = "signalement_erreur"


class SignalementSerializer(serializers.Serializer):
    type = serializers.CharField(max_length=120, required=False, allow_blank=True, default="Erreur")
    message = serializers.CharField(max_length=1000, allow_blank=True)
    lieu = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    details = serializers.CharField(max_length=8000, required=False, allow_blank=True, default="")


class SignalementView(APIView):
    """Erreurs survenues dans le navigateur (écran planté, erreur JavaScript). Public : une erreur peut
    survenir sur la page d'inscription. Limité en débit et en taille ; aucune réponse détaillée."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SignalementThrottle]

    @extend_schema(request=SignalementSerializer, responses={204: None})
    def post(self, request):
        ser = SignalementSerializer(data=request.data)
        if ser.is_valid():
            d = ser.validated_data
            enregistrer(
                SourceErreur.NAVIGATEUR,
                d["type"],
                d["message"],
                lieu=d["lieu"],
                details=d["details"],
                navigateur=request.headers.get("User-Agent", ""),
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ErreurSerializer(serializers.ModelSerializer):
    source_libelle = serializers.CharField(source="get_source_display")

    class Meta:
        model = ErreurTechnique
        fields = [
            "id",
            "source",
            "source_libelle",
            "type",
            "message",
            "lieu",
            "details",
            "navigateur",
            "occurrences",
            "premiere",
            "derniere",
            "resolue",
            "resolue_le",
        ]


class ErreursView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(
        parameters=[
            OpenApiParameter("statut", str, enum=["a_traiter", "resolues", "toutes"]),
            OpenApiParameter("source", str, enum=SourceErreur.values),
            OpenApiParameter("page", int),
        ],
        responses={200: ErreurSerializer(many=True)},
    )
    def get(self, request):
        p = request.query_params
        qs = ErreurTechnique.objects.all()
        statut = p.get("statut") or "a_traiter"
        if statut == "a_traiter":
            qs = qs.filter(resolue=False)
        elif statut == "resolues":
            qs = qs.filter(resolue=True)
        if p.get("source") in SourceErreur.values:
            qs = qs.filter(source=p["source"])
        taille = 30
        page = max(1, entier(p.get("page")) or 1)
        total = qs.count()
        return Response(
            {
                "total": total,
                "page": page,
                "pages": max(1, -(-total // taille)),
                "aTraiter": ErreurTechnique.objects.filter(resolue=False).count(),
                "resultats": ErreurSerializer(qs[(page - 1) * taille : page * taille], many=True).data,
            }
        )


class ErreurDetailView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(request=None, responses={200: ErreurSerializer})
    def patch(self, request, pk):
        erreur = ErreurTechnique.objects.filter(pk=pk).first()
        if erreur is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        donnees = donnees_objet(request)
        erreur.resolue = serializers.BooleanField().to_internal_value(donnees.get("resolue", False))
        erreur.resolue_le = timezone.now() if erreur.resolue else None
        erreur.save(update_fields=["resolue", "resolue_le"])
        return Response(ErreurSerializer(erreur).data)


class ErreursActionView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request):
        action = donnees_objet(request).get("action")
        if action == "resoudre_tout":
            n = ErreurTechnique.objects.filter(resolue=False).update(resolue=True, resolue_le=timezone.now())
        elif action == "supprimer_resolues":
            n, _ = ErreurTechnique.objects.filter(resolue=True).delete()
        else:
            return Response({"detail": "Action inconnue."}, status=status.HTTP_400_BAD_REQUEST)
        from .temps_reel import TOUS, notifier

        notifier([TOUS], ("erreurs",))  # les mises à jour en masse ne déclenchent pas de signal
        return Response({"nombre": n})
