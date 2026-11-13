import hashlib
import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.middleware.csrf import get_token, rotate_token
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenBackendError, TokenError
from rest_framework_simplejwt.state import token_backend
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.noyau.journal import journaliser
from apps.noyau.temps_reel import groupe_compte, notifier

from .authentication import (
    emettre_jetons,
    est_borne,
    jeton_revoque,
    nouvelle_version_session,
    revoquer_acces,
    verifier_csrf,
)
from .models import Admin
from .throttles import (
    ECHECS_CONNEXION_PAR_COMPTE,
    FENETRE_ECHECS_CONNEXION_S,
    CacheDeSecours,
    ConnexionIpThrottle,
    ConnexionThrottle,
    MotDePasseCompteHeureThrottle,
    MotDePasseCompteThrottle,
    cle_echecs_connexion,
)

securite = logging.getLogger("securite")


def _connexion_refusee(request, raison, compte_vise):
    """Échec ou blocage de connexion : journal de sécurité (sans email) et, pour un compte existant, journal
    d'activité visible du super admin. Un blocage déclenche aussi une alerte par email (une par compte et par heure)."""
    from apps.noyau.alertes import alerter

    reseau = ConnexionIpThrottle().get_ident(request)
    securite.warning(
        "Connexion refusée : %s, compte %s, réseau %s",
        raison,
        compte_vise.pk if compte_vise else "inconnu",
        reseau,
    )
    if compte_vise is None:
        return
    if raison == "bloquee":
        journaliser(None, "CONNEXION_BLOQUEE", compte_vise, reseau=reseau)
        alerter(
            f"connexion-bloquee:{compte_vise.pk}",
            f"Connexion bloquée : {compte_vise.nom}",
            f"Le compte « {compte_vise.nom} » ({compte_vise.get_role_display()}) est bloqué après "
            f"{ECHECS_CONNEXION_PAR_COMPTE} échecs de connexion en une heure "
            f"(dernier essai depuis le réseau {reseau}).\n"
            "S’il ne s’agit pas de cette personne, quelqu’un essaie de deviner son mot de passe : "
            "vérifiez le journal et réinitialisez le mot de passe si besoin.",
        )
    else:
        journaliser(None, "CONNEXION_ECHEC", compte_vise, raison=raison, reseau=reseau)


class MoiSerializer(serializers.ModelSerializer):
    initiales = serializers.CharField(read_only=True)

    class Meta:
        model = Admin
        fields = ["id", "nom", "email", "role", "initiales", "doit_changer_mot_de_passe"]


class ConnexionSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    mot_de_passe = serializers.CharField(trim_whitespace=False, max_length=256)

    def validate_email(self, v):
        # ASCII uniquement : la collation MySQL (utf8mb4_unicode_ci) confondrait « mdé.ci » et « mde.ci »,
        # et chaque variante accentuée obtiendrait ses propres compteurs de tentatives (force brute illimitée).
        if not v.isascii():
            raise serializers.ValidationError("Adresse email invalide.")
        return v.lower()


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


def _trop_de_tentatives():
    return Response(
        {"code": "TROP_DE_TENTATIVES", "detail": "Trop de tentatives. Réessayez dans quelques minutes."},
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _ancien_refresh(request):
    """Jeton de rafraîchissement du cookie, mis en liste noire (changement de niveau de session)."""
    raw = request.COOKIES.get(settings.JWT_COOKIE_REFRESH)
    if raw:
        try:
            RefreshToken(raw).blacklist()
        except TokenError:
            pass


# Poste déjà connu : un cookie signé par le serveur (empreintes des comptes qui s'y sont connectés, 90 jours)
# dispense ce poste du blocage par compte. Un attaquant qui multiplie les échecs sur l'email d'un hôte ne peut
# donc plus l'empêcher de se connecter depuis sa tablette ou son téléphone habituels ; la limite par IP et par
# email (ConnexionThrottle) reste appliquée à tous.
COOKIE_POSTE = "fc_poste"
SEL_POSTE = "flex-checking.poste-connu"
DUREE_POSTE_S = 90 * 24 * 3600
POSTES_MAX = 10


def _empreinte_compte(email):
    return hashlib.sha256(f"poste:{email}".encode()).hexdigest()[:24]


def _postes_connus(request):
    try:
        valeur = signing.loads(request.COOKIES.get(COOKIE_POSTE, ""), salt=SEL_POSTE, max_age=DUREE_POSTE_S)
    except signing.BadSignature:
        return []
    return [e for e in valeur if isinstance(e, str)][:POSTES_MAX] if isinstance(valeur, list) else []


def _memoriser_poste(request, response, email):
    connus = [e for e in _postes_connus(request) if e != _empreinte_compte(email)]
    response.set_cookie(
        COOKIE_POSTE,
        signing.dumps([_empreinte_compte(email), *connus][:POSTES_MAX], salt=SEL_POSTE),
        max_age=DUREE_POSTE_S,
        path="/api/auth/",
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
    )


class ConnexionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ConnexionThrottle, ConnexionIpThrottle]

    @extend_schema(request=ConnexionSerializer, responses={200: MoiSerializer})
    def post(self, request):
        # Vue sans authentification DRF : le contrôle CSRF est fait ici (connexion forcée sur le compte d'un tiers
        # depuis un autre site). Le frontend envoie toujours l'en-tête X-CSRFToken.
        verifier_csrf(request)
        ser = ConnexionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"]
        # Chaque tentative est comptée AVANT la vérification du mot de passe (incrément atomique : des essais envoyés
        # en parallèle ne passent pas tous le contrôle) ; une connexion réussie remet la série d'échecs à zéro.
        limites, cle = CacheDeSecours(), cle_echecs_connexion(email)
        # Un poste où l'hôte s'est déjà connecté a son propre compteur : un tiers ne peut pas le bloquer à distance,
        # mais les essais depuis ce poste (tablette perdue, borne partagée) restent limités eux aussi.
        if _empreinte_compte(email) in _postes_connus(request):
            cle_comptee = cle + ":poste-connu"
        else:
            cle_comptee = cle
        essais = limites.incrementer(cle_comptee, FENETRE_ECHECS_CONNEXION_S)
        if essais > ECHECS_CONNEXION_PAR_COMPTE:
            if essais == ECHECS_CONNEXION_PAR_COMPTE + 1:  # premier refus de la série : journalisé et signalé une fois
                _connexion_refusee(request, "bloquee", Admin.objects.filter(email=email).first())
            return _trop_de_tentatives()
        admin = authenticate(request, username=email, password=ser.validated_data["mot_de_passe"])
        if admin is None or not admin.actif:
            # compte désactivé : authenticate rend None sans vérifier le mot de passe (ModelBackend, is_active faux)
            vise = admin or Admin.objects.filter(email=email).first()
            _connexion_refusee(request, "compte_inactif" if vise and not vise.actif else "mot_de_passe", vise)
            return Response(
                {"code": "IDENTIFIANTS_INVALIDES", "detail": "Email ou mot de passe incorrect."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        limites.supprimer(cle)
        limites.supprimer(cle + ":poste-connu")
        admin.derniere_connexion = timezone.now()
        admin.save(update_fields=["derniere_connexion"])
        journaliser(admin, "CONNEXION", admin)
        response = Response(MoiSerializer(admin).data)
        _poser_cookies(response, emettre_jetons(admin))
        _memoriser_poste(request, response, email)
        # nouveau jeton CSRF pour la session authentifiée : un jeton posé avant la connexion (par un sous-domaine
        # voisin, par exemple) n'est plus accepté
        rotate_token(request)
        return response


# rafraîchissements simultanés de plusieurs onglets : le second arrive juste après la rotation du jeton
DELAI_COURSE_RAFRAICHISSEMENT_S = 30


def _renouvele_par_un_autre_onglet(raw):
    """Jeton authentique (signature et expiration vérifiées) révoqué il y a moins de 30 s par une rotation : un jeton
    plus récent a été émis pour le compte. Une déconnexion ou une révocation n'émet pas de nouveau jeton."""
    try:
        donnees = token_backend.decode(raw, verify=True)
    except TokenBackendError:
        return False
    origine = OutstandingToken.objects.filter(jti=donnees.get("jti")).first()
    revoque = BlacklistedToken.objects.filter(token=origine).first() if origine else None
    if revoque is None:
        return False
    if timezone.now() - revoque.blacklisted_at >= timedelta(seconds=DELAI_COURSE_RAFRAICHISSEMENT_S):
        return False
    # le jeton émis par la rotation l'est dans la même transaction que la révocation : un jeton plus récent émis
    # en dehors de cette fenêtre (autre appareil, nouvelle connexion) ne prouve pas une rotation
    fenetre = (revoque.blacklisted_at - timedelta(seconds=2), revoque.blacklisted_at + timedelta(seconds=5))
    return OutstandingToken.objects.filter(
        user_id=origine.user_id, pk__gt=origine.pk, created_at__range=fenetre
    ).exists()


def _compte_du_jeton_reutilise(raw):
    """Jeton de rafraîchissement authentique, non expiré, de la session en cours du compte, mais déjà révoqué (rotation
    ou déconnexion) hors de la fenêtre des onglets simultanés : il a été copié (vol de cookie). Rend le compte."""
    try:
        donnees = token_backend.decode(raw, verify=True)
    except TokenBackendError:
        return None
    origine = OutstandingToken.objects.filter(jti=donnees.get("jti")).first()
    if origine is None or not BlacklistedToken.objects.filter(token=origine).exists():
        return None
    admin = Admin.objects.filter(pk=donnees.get("user_id")).first()
    if admin is None or jeton_revoque(donnees, admin):  # session déjà fermée par un changement de mot de passe
        return None
    return admin


def _fermer_sessions_jeton_reutilise(request, admin):
    """Réutilisation d'un jeton déjà renouvelé : toutes les sessions du compte sont fermées (celle du voleur comme
    celle de la personne), l'action est journalisée et le super admin alerté (une fois par compte et par heure)."""
    from apps.noyau.alertes import alerter

    nouvelle_version_session(admin)
    admin.save(update_fields=["version_session"])
    reseau = ConnexionIpThrottle().get_ident(request)
    securite.warning("Jeton de session réutilisé : compte %s, réseau %s ; sessions fermées", admin.pk, reseau)
    journaliser(None, "SESSION_REUTILISEE", admin, reseau=reseau)
    alerter(
        f"session-reutilisee:{admin.pk}",
        f"Session copiée : {admin.nom}",
        f"Un jeton de session déjà renouvelé du compte « {admin.nom} » ({admin.get_role_display()}) a été présenté "
        f"de nouveau (réseau {reseau}) : le cookie de session a probablement été copié. Toutes les sessions du "
        "compte ont été fermées ; la personne doit se reconnecter. Si cela se répète, changez son mot de passe.",
    )


class RafraichirView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        # même contrôle CSRF que les autres vues modifiantes (rotation forcée depuis un sous-domaine compromis)
        verifier_csrf(request)
        raw = request.COOKIES.get(settings.JWT_COOKIE_REFRESH)
        if not raw:
            return Response({"code": "NON_CONNECTE"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            with transaction.atomic():
                ancien = RefreshToken(raw)
                # verrou sur le jeton : deux rafraîchissements simultanés n'obtiennent pas chacun une nouvelle session
                # order_by("pk") : le tri par défaut du modèle (« user », clé nullable) ajouterait une jointure externe,
                # que Postgres refuse de verrouiller (FOR UPDATE) ; jti est unique, le tri ne change rien d'autre
                origine = OutstandingToken.objects.select_for_update().filter(jti=ancien["jti"]).order_by("pk").first()
                if origine is None or BlacklistedToken.objects.filter(token=origine).exists():
                    raise TokenError("jeton déjà utilisé")
                admin = Admin.objects.get(pk=ancien["user_id"])
                if not admin.actif or jeton_revoque(ancien, admin):
                    raise TokenError("inactif ou mot de passe changé")
                ancien.blacklist()
                nouveau = emettre_jetons(admin, borne=est_borne(ancien))
        except (TokenError, Admin.DoesNotExist):
            if _renouvele_par_un_autre_onglet(raw):
                # un autre onglet vient de renouveler la session : ses nouveaux cookies sont déjà dans le navigateur,
                # ne pas les effacer (sinon l'utilisateur est déconnecté de tous ses onglets)
                return Response({"code": "SESSION_DEJA_RENOUVELEE"}, status=status.HTTP_409_CONFLICT)
            compte = _compte_du_jeton_reutilise(raw)
            if compte is not None:
                _fermer_sessions_jeton_reutilise(request, compte)
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
        verifier_csrf(request)  # pas de déconnexion forcée depuis un autre site
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
        # le jeton d'accès de cette session cesse aussi de fonctionner (jeton volé encore valide sinon 15 min)
        acces = request.COOKIES.get(settings.JWT_COOKIE_ACCESS)
        if acces:
            try:
                jeton_acces = AccessToken(acces)
                revoquer_acces(jeton_acces)
                # connexions temps réel de cette session (même jeton) : fermées tout de suite, les autres appareils
                # du compte ne sont pas sollicités (ils comparent seulement l'identifiant du jeton)
                notifier([groupe_compte(jeton_acces["user_id"])], (jeton_acces["jti"],), type_message="session_fermee")
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _effacer_cookies(response)
        return response


class MoiView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: MoiSerializer})
    def get(self, request):
        # `borne` : session restreinte d'une borne libre-service (le frontend n'affiche alors que le scan)
        return Response({**MoiSerializer(request.user).data, "borne": est_borne(request.auth)})


class ChangerMotDePasseSerializer(serializers.Serializer):
    actuel = serializers.CharField(trim_whitespace=False, max_length=256)
    nouveau = serializers.CharField(trim_whitespace=False, min_length=10, max_length=256)


class ChangerMotDePasseView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [MotDePasseCompteThrottle, MotDePasseCompteHeureThrottle]

    @extend_schema(request=ChangerMotDePasseSerializer, responses={204: None})
    def post(self, request):
        if est_borne(request.auth):
            return Response({"code": "RESERVE_HOTE", "detail": "Action réservée à l’hôte."}, status=403)
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


class VerifierMotDePasseSerializer(serializers.Serializer):
    mot_de_passe = serializers.CharField(trim_whitespace=False, max_length=256)


class VerifierMotDePasseView(APIView):
    """Confirme l'identité de l'hôte avant d'ouvrir l'espace hôte d'une borne libre-service : une session ouverte sur
    un appareil laissé au public ne doit pas suffire pour atteindre les réglages ni l'espace admin."""

    throttle_classes = [MotDePasseCompteThrottle, MotDePasseCompteHeureThrottle]
    autorise_borne = True

    @extend_schema(request=VerifierMotDePasseSerializer, responses={204: None, 400: None})
    def post(self, request):
        ser = VerifierMotDePasseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if not request.user.check_password(ser.validated_data["mot_de_passe"]):
            return Response(
                {"code": "MOT_DE_PASSE_INCORRECT", "detail": "Mot de passe incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        response = Response(status=status.HTTP_204_NO_CONTENT)
        if est_borne(request.auth):
            # hôte identifié : la session de la borne redevient complète (réglages, espace admin)
            _ancien_refresh(request)
            revoquer_acces(request.auth)
            _poser_cookies(response, emettre_jetons(request.user))
        return response


class ModeBorneView(APIView):
    """Passe la session de cet appareil en mode « borne libre-service » : le public qui l'utilise ne peut
    qu'émarger et chercher son nom, jamais atteindre la liste des invités, les exports ni l'espace admin.
    Le mot de passe de l'hôte (`auth/verifier-mot-de-passe/`) rend une session complète."""

    autorise_borne = True

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        if not est_borne(request.auth):
            _ancien_refresh(request)
            revoquer_acces(request.auth)
            _poser_cookies(response, emettre_jetons(request.user, borne=True))
        return response
