from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.middleware.csrf import get_token
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.noyau.journal import journaliser

from .authentication import emettre_jetons, jeton_revoque, nouvelle_version_session
from .models import Admin
from .throttles import ConnexionCompteThrottle, ConnexionThrottle


class MoiSerializer(serializers.ModelSerializer):
    initiales = serializers.CharField(read_only=True)

    class Meta:
        model = Admin
        fields = ["id", "nom", "email", "role", "initiales", "doit_changer_mot_de_passe"]


class ConnexionSerializer(serializers.Serializer):
    email = serializers.EmailField()
    mot_de_passe = serializers.CharField(trim_whitespace=False)


def _poser_cookies(response, refresh):
    commun = {
        "httponly": True,
        "secure": settings.JWT_COOKIE_SECURE,
        "samesite": settings.JWT_COOKIE_SAMESITE,
    }
    response.set_cookie(
        settings.JWT_COOKIE_ACCESS,
        str(refresh.access_token),
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        path="/",
        **commun,
    )
    response.set_cookie(
        settings.JWT_COOKIE_REFRESH,
        str(refresh),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path="/api/auth/",
        **commun,
    )


def _effacer_cookies(response):
    response.delete_cookie(settings.JWT_COOKIE_ACCESS, path="/")
    response.delete_cookie(settings.JWT_COOKIE_REFRESH, path="/api/auth/")


class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: None}, summary="Pose le cookie CSRF")
    def get(self, request):
        get_token(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConnexionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ConnexionThrottle, ConnexionCompteThrottle]

    @extend_schema(request=ConnexionSerializer, responses={200: MoiSerializer})
    def post(self, request):
        ser = ConnexionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        admin = authenticate(
            request, username=ser.validated_data["email"].lower(), password=ser.validated_data["mot_de_passe"]
        )
        if admin is None or not admin.actif:
            return Response(
                {"code": "IDENTIFIANTS_INVALIDES", "detail": "Email ou mot de passe incorrect."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        admin.derniere_connexion = timezone.now()
        admin.save(update_fields=["derniere_connexion"])
        journaliser(admin, "CONNEXION", admin)
        response = Response(MoiSerializer(admin).data)
        _poser_cookies(response, emettre_jetons(admin))
        get_token(request)
        return response


class RafraichirView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        raw = request.COOKIES.get(settings.JWT_COOKIE_REFRESH)
        if not raw:
            return Response({"code": "NON_CONNECTE"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            ancien = RefreshToken(raw)
            admin = Admin.objects.get(pk=ancien["user_id"])
            if not admin.actif or jeton_revoque(ancien, admin):
                raise TokenError("inactif ou mot de passe changé")
            ancien.blacklist()
            nouveau = emettre_jetons(admin)
        except (TokenError, Admin.DoesNotExist):
            response = Response({"code": "SESSION_EXPIREE"}, status=status.HTTP_401_UNAUTHORIZED)
            _effacer_cookies(response)
            return response
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _poser_cookies(response, nouveau)
        return response


class DeconnexionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        raw = request.COOKIES.get(settings.JWT_COOKIE_REFRESH)
        if raw:
            try:
                jeton = RefreshToken(raw)
                admin = Admin.objects.filter(pk=jeton["user_id"]).first()
                jeton.blacklist()
                if admin:
                    journaliser(admin, "DECONNEXION", admin)
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _effacer_cookies(response)
        return response


class MoiView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: MoiSerializer})
    def get(self, request):
        return Response(MoiSerializer(request.user).data)


class ChangerMotDePasseSerializer(serializers.Serializer):
    actuel = serializers.CharField(trim_whitespace=False)
    nouveau = serializers.CharField(trim_whitespace=False, min_length=10)


class ChangerMotDePasseView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=ChangerMotDePasseSerializer, responses={204: None})
    def post(self, request):
        ser = ChangerMotDePasseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        admin = request.user
        if not admin.check_password(ser.validated_data["actuel"]):
            return Response({"actuel": ["Mot de passe actuel incorrect."]}, status=400)
        try:
            validate_password(ser.validated_data["nouveau"], admin)
        except DjangoValidationError as e:
            return Response({"nouveau": list(e.messages)}, status=400)
        admin.set_password(ser.validated_data["nouveau"])
        admin.doit_changer_mot_de_passe = False
        nouvelle_version_session(admin)
        admin.save(update_fields=["password", "doit_changer_mot_de_passe", "version_session"])
        journaliser(admin, "MOT_DE_PASSE_CHANGE", admin)
        # Les autres sessions du compte sont révoquées (empreinte du mot de passe dans les jetons) ;
        # la session courante reçoit de nouveaux jetons et l'ancien jeton de rafraîchissement est invalidé.
        ancien = request.COOKIES.get(settings.JWT_COOKIE_REFRESH)
        if ancien:
            try:
                RefreshToken(ancien).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _poser_cookies(response, emettre_jetons(admin))
        return response
