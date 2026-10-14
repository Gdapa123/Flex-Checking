"""Super admin (configuration globale) et lecture des événements par les admins."""

import secrets
from datetime import time

from django.db import transaction
from django.db.models import Count, ProtectedError
from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.comptes.authentication import est_borne, nouvelle_version_session
from apps.comptes.models import Admin, Role
from apps.comptes.permissions import EstAdmin, EstSuperAdmin, evenements_visibles

from . import caches, exports, sondages, suivi_emails
from .analytique import analytique, technique
from .emails import Source, rendre
from .exceptions import ErreurMetier
from .filtres import filtrer_par_evenement
from .journal import CATEGORIES, journaliser
from .journal_texte import precharger_cibles
from .models import Evenement, Invite, JournalActivite, Parametres, Programme, TypeEmail
from .qr import qr_png
from .rapports import rapport_evenement, rapport_global
from .serializers import (
    AdminSerializer,
    ApercuEmailSerializer,
    EvenementBorneSerializer,
    EvenementSerializer,
    JournalSerializer,
    ParametresSerializer,
    ProgrammeSerializer,
    evenements_annotes,
)
from .statistiques import statistiques
from .validation import date_iso, entier
from .vues_invites import exporter, reponse_fichier


# ---------------------------------------------------------------- Programmes
class RapportThrottle(UserRateThrottle):
    """Génération de PDF : coûteuse, limitée par compte."""

    scope = "rapport"


class EmailTestThrottle(UserRateThrottle):
    """Email de test vers son propre compte : envoi SMTP synchrone, limité par compte."""

    scope = "email_test"


class RelanceThrottle(UserRateThrottle):
    """Renvoi groupé des emails en échec : limité par compte."""

    scope = "relance_emails"


class TypeEmailSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=TypeEmail.choices)


def reponse_pdf(contenu, nom):
    reponse = HttpResponse(contenu, content_type="application/pdf")
    reponse["Content-Disposition"] = f'attachment; filename="{nom}"'
    reponse["Cache-Control"] = "no-store"
    return reponse


class ProgrammeViewSet(viewsets.ModelViewSet):
    serializer_class = ProgrammeSerializer

    def get_permissions(self):
        # lecture ouverte aux admins (listes de programmes), écriture réservée au super admin
        return [EstAdmin()] if self.action in ("list", "retrieve") else [EstSuperAdmin()]

    def get_queryset(self):
        return Programme.objects.annotate(nb_evenements=Count("evenements")).order_by("id")

    def perform_create(self, serializer):
        journaliser(self.request.user, "PROGRAMME_CREATION", serializer.save())

    def perform_update(self, serializer):
        avant = serializer.instance
        etat = (avant.actif, avant.couleur_principale, avant.couleur_secondaire)
        prog = serializer.save()
        if prog.actif != etat[0]:
            journaliser(self.request.user, "PROGRAMME_ACTIVATION" if prog.actif else "PROGRAMME_DESACTIVATION", prog)
        else:
            couleurs = (prog.couleur_principale, prog.couleur_secondaire) != etat[1:]
            journaliser(self.request.user, "PROGRAMME_MODIFICATION", prog, couleurs=couleurs)

    @extend_schema(parameters=[OpenApiParameter("confirmation", str)], responses={204: None})
    def destroy(self, request, *args, **kwargs):
        """Un programme avec des cérémonies se supprime avec elles (invités compris) : il faut alors
        retaper son nom (`?confirmation=`) pour confirmer."""
        prog = self.get_object()
        nom = prog.nom
        evenements = list(prog.evenements.all())
        if evenements:
            exiger_confirmation(request, nom)
        with transaction.atomic():
            nb_invites = Invite.objects.filter(evenement__in=evenements).count()
            for ev in evenements:
                ev.delete()
            try:
                prog.delete()
            except ProtectedError as exc:  # pragma: no cover — course avec une création d'événement
                raise ErreurMetier("PROGRAMME_UTILISE", "Ce programme vient de recevoir un événement.") from exc
            journaliser(
                request.user, "PROGRAMME_SUPPRESSION", None, nom=nom, evenements=len(evenements), invites=nb_invites
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


def exiger_confirmation(request, nom):
    """Suppression en cascade : le nom doit être retapé à l'identique (insensible à la casse)."""
    saisi = (request.query_params.get("confirmation") or "").strip()
    if saisi.casefold() != nom.strip().casefold():
        raise ErreurMetier(
            "CONFIRMATION_REQUISE", f"Pour confirmer, saisissez exactement « {nom} ».", status=400, attendu=nom
        )


# ---------------------------------------------------------------- Événements
class EvenementViewSet(viewsets.ModelViewSet):
    serializer_class = EvenementSerializer
    autorise_borne = {"list"}  # le poste de scan de la borne charge la liste des cérémonies

    def get_permissions(self):
        lecture = (
            "list",
            "retrieve",
            "statistiques",
            "apercu_emails",
            "rapport",
            "suivi_emails",
            "renvoyer_echecs",
            "email_test",
            "sondage",
        )
        return [EstAdmin()] if self.action in lecture else [EstSuperAdmin()]

    def get_queryset(self):
        return evenements_annotes(evenements_visibles(self.request.user)).order_by("-date")

    def get_serializer_class(self):
        if self.action == "list" and est_borne(self.request.auth):
            return EvenementBorneSerializer
        return super().get_serializer_class()

    def perform_create(self, serializer):
        ev = serializer.save()
        journaliser(self.request.user, "EVENEMENT_CREATION", ev)

    def perform_update(self, serializer):
        avant = serializer.instance
        ouvertes, admins = avant.inscriptions_ouvertes, set(avant.admins.values_list("pk", flat=True))
        ev = serializer.save()
        if ev.inscriptions_ouvertes != ouvertes:
            journaliser(
                self.request.user,
                "INSCRIPTIONS_OUVERTURE" if ev.inscriptions_ouvertes else "INSCRIPTIONS_FERMETURE",
                ev,
            )
        if set(ev.admins.values_list("pk", flat=True)) != admins:
            journaliser(self.request.user, "EVENEMENT_ADMINS", ev)
        journaliser(self.request.user, "EVENEMENT_MODIFICATION", ev)

    @extend_schema(parameters=[OpenApiParameter("confirmation", str)], responses={204: None})
    def destroy(self, request, *args, **kwargs):
        """Suppression définitive avec ses invités, emails et émargements : si la cérémonie a des invités,
        il faut retaper son nom (`?confirmation=`) pour confirmer."""
        ev = self.get_object()
        nom = ev.nom_affiche
        nb_invites = ev.invites.count()
        if nb_invites:
            exiger_confirmation(request, nom)
        with transaction.atomic():
            ev.delete()
            journaliser(request.user, "EVENEMENT_SUPPRESSION", None, nom=nom, invites=nb_invites)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses={200: EvenementSerializer})
    @action(detail=True, methods=["post"], url_path="regenerer-slug")
    def regenerer_slug(self, request, pk=None):
        ev = self.get_object()
        ev.regenerer_slug()
        journaliser(request.user, "EVENEMENT_SLUG", ev)
        return Response(self.get_serializer(self.get_queryset().get(pk=ev.pk)).data)

    @extend_schema(responses={(200, "image/png"): bytes})
    @action(detail=True, methods=["get"], url_path="qr-inscription.png")
    def qr_inscription(self, request, pk=None):
        ev = self.get_object()
        lien = EvenementSerializer().get_lien_inscription(ev)
        reponse = HttpResponse(qr_png(lien, couleur="#2A1714", taille_module=16), content_type="image/png")
        nom = f"qr-inscription-{slugify(ev.programme.nom)}-{ev.annee}.png"
        reponse["Content-Disposition"] = f'inline; filename="{nom}"'
        return reponse

    @extend_schema(responses={200: None})
    @action(detail=True, methods=["get"])
    def statistiques(self, request, pk=None):
        ev = self.get_object()  # contrôle d'accès avant toute lecture du cache
        return Response(caches.lire(caches.cle_statistiques(ev.pk), lambda: statistiques(ev)))

    @extend_schema(responses={(200, "application/pdf"): bytes}, summary="Rapport PDF de la cérémonie")
    @action(detail=True, methods=["get"], url_path="rapport", throttle_classes=[RapportThrottle])
    def rapport(self, request, pk=None):
        ev = self.get_object()
        s = caches.lire(caches.cle_statistiques(ev.pk), lambda: statistiques(ev))
        contenu = rapport_evenement(ev, s, request.user.nom)
        journaliser(request.user, "EXPORT", ev, format="pdf", type="rapport")
        nom = f"rapport-{slugify(ev.programme.nom)}-{ev.annee}-{timezone.localtime():%Y%m%d-%H%M}.pdf"
        return reponse_pdf(contenu, nom)

    @extend_schema(responses={200: None}, summary="Aperçu des deux emails du programme (lecture seule)")
    @action(detail=True, methods=["get"], url_path="apercu-emails")
    def apercu_emails(self, request, pk=None):
        ev = self.get_object()
        return Response({t: _apercu(t, ev) for t in TypeEmail.values})

    @extend_schema(responses={200: None}, summary="Résultats du sondage de satisfaction de la cérémonie")
    @action(detail=True, methods=["get"])
    def sondage(self, request, pk=None):
        return Response(sondages.resultats(self.get_object()))

    @extend_schema(responses={200: None}, summary="Suivi des emails : compteurs et échecs à traiter")
    @action(detail=True, methods=["get"], url_path="suivi-emails")
    def suivi_emails(self, request, pk=None):
        return Response(suivi_emails.suivi(self.get_object()))

    @extend_schema(request=TypeEmailSerializer, responses={200: None}, summary="Renvoyer les emails en échec")
    @action(detail=True, methods=["post"], url_path="suivi-emails/renvoyer-echecs", throttle_classes=[RelanceThrottle])
    def renvoyer_echecs(self, request, pk=None):
        ev = self.get_object()
        ser = TypeEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response({"traites": suivi_emails.renvoyer_echecs(request.user, ev, ser.validated_data["type"])})

    @extend_schema(request=TypeEmailSerializer, responses={200: None}, summary="M'envoyer un email de test")
    @action(detail=True, methods=["post"], url_path="suivi-emails/test", throttle_classes=[EmailTestThrottle])
    def email_test(self, request, pk=None):
        ev = self.get_object()
        ser = TypeEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        destinataire = suivi_emails.envoyer_test(request.user, ev, ser.validated_data["type"], _source_exemple(ev))
        return Response({"destinataire": destinataire})


def _source_exemple(evenement):
    return Source(
        evenement,
        "Mme",
        "Aya",
        "Kouassi",
        "4827",
        "exemple-de-jeton-non-valide",
        present_le=timezone.now().replace(hour=18, minute=42),
        jeton_sondage="exemple-de-lien-non-valide",
        sondage_expire_le=sondages.debut_envoi(evenement) + sondages.DUREE,
    )


def _apercu(type_email, evenement, **kwargs):
    rendu = rendre(type_email, _source_exemple(evenement), apercu=True, **kwargs)
    return {"objet": rendu["objet"], "html": rendu["html"], "texte": rendu["texte"]}


# ---------------------------------------------------------------- Comptes admins
def mot_de_passe_temporaire():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    return "-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3))


class AdminViewSet(
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdminSerializer
    permission_classes = [EstSuperAdmin]
    queryset = Admin.objects.prefetch_related("evenements").order_by("role", "nom")

    @extend_schema(responses={201: None}, summary="Créer un compte (mot de passe temporaire affiché une fois)")
    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        evenements = ser.validated_data.pop("evenements", [])
        mdp = mot_de_passe_temporaire()
        admin = Admin.objects.create_user(password=mdp, doit_changer_mot_de_passe=True, **ser.validated_data)
        admin.evenements.set(evenements)
        journaliser(request.user, "ADMIN_CREATION", admin)
        return Response({**AdminSerializer(admin).data, "motDePasseTemporaire": mdp}, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        admin = serializer.instance
        if admin.pk == self.request.user.pk and (
            serializer.validated_data.get("actif") is False
            or serializer.validated_data.get("role", admin.role) != admin.role
        ):
            raise ErreurMetier(
                "COMPTE_COURANT", "Vous ne pouvez pas désactiver votre propre compte ni changer son rôle."
            )
        actif = admin.actif
        admin = serializer.save()
        if admin.actif != actif:
            journaliser(self.request.user, "ADMIN_ACTIVATION" if admin.actif else "ADMIN_DESACTIVATION", admin)
        else:
            journaliser(self.request.user, "ADMIN_MODIFICATION", admin)

    def perform_destroy(self, admin):
        if admin.pk == self.request.user.pk:
            raise ErreurMetier("COMPTE_COURANT", "Vous ne pouvez pas supprimer votre propre compte.")
        if (
            admin.role == Role.SUPER_ADMIN
            and not Admin.objects.filter(role=Role.SUPER_ADMIN).exclude(pk=admin.pk).exists()
        ):
            raise ErreurMetier("DERNIER_SUPER_ADMIN", "Impossible de supprimer le dernier super admin.")
        nom = admin.nom
        with transaction.atomic():
            admin.delete()  # ses émargements restent dans l'historique (« Compte supprimé »)
            journaliser(self.request.user, "ADMIN_SUPPRESSION", None, nom=nom)

    @extend_schema(request=None, responses={200: None})
    @action(detail=True, methods=["post"], url_path="reinitialiser-mot-de-passe")
    def reinitialiser(self, request, pk=None):
        admin = self.get_object()
        mdp = mot_de_passe_temporaire()
        admin.set_password(mdp)
        admin.doit_changer_mot_de_passe = True
        nouvelle_version_session(admin)  # toutes les sessions ouvertes du compte sont fermées
        admin.save(update_fields=["password", "doit_changer_mot_de_passe", "version_session"])
        journaliser(request.user, "ADMIN_MOT_DE_PASSE", admin)
        return Response({"motDePasseTemporaire": mdp})


# ---------------------------------------------------------------- Paramètres
class ParametresView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(responses={200: ParametresSerializer})
    def get(self, request):
        return Response(ParametresSerializer(Parametres.charger()).data)

    @extend_schema(request=ParametresSerializer, responses={200: ParametresSerializer})
    def patch(self, request):
        p = Parametres.charger()
        ser = ParametresSerializer(p, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        modifies = {
            k: v for k, v in ser.validated_data.items() if k in ("duree_resultat_scan", "son_actif", "vibration_actif")
        }
        champs = [k for k in ser.validated_data if k.startswith(("objet_", "corps_"))]
        journaliser(request.user, "PARAMETRES", p, **modifies, modeles=champs)
        return Response(ser.data)


class ApercuEmailView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(request=ApercuEmailSerializer, responses={200: None}, summary="Aperçu HTML d'un modèle d'email")
    def post(self, request):
        ser = ApercuEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        prog = d.get("programme") or Programme.objects.filter(actif=True).order_by("id").first()
        if prog is None:
            raise ErreurMetier("AUCUN_PROGRAMME", "Créez d’abord un programme.")
        ev = prog.evenements.order_by("-date").first() or Evenement(
            programme=prog,
            date=timezone.localdate(),
            heure_debut=time(18, 0),
            heure_accueil=time(17, 15),
            lieu="Lieu de la cérémonie · Abidjan",
            capacite=100,
            date_limite_inscription=timezone.localdate(),
            slug_inscription="apercu",
        )
        return Response(_apercu(d["type"], ev, objet=d.get("objet"), corps=d.get("corps")))


# ---------------------------------------------------------------- Journal
class JournalView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(
        parameters=[
            OpenApiParameter("auteur", int),
            OpenApiParameter("categorie", str, enum=sorted(set(CATEGORIES.values()))),
            OpenApiParameter("action", str),
            OpenApiParameter("du", str),
            OpenApiParameter("au", str),
            OpenApiParameter("page", int),
        ],
        responses={200: JournalSerializer(many=True)},
    )
    def get(self, request):
        qs = filtrer_journal(request.query_params)
        taille = 50
        page = max(1, entier(request.query_params.get("page")) or 1)
        total = qs.count()
        entrees = list(qs[(page - 1) * taille : page * taille])
        ser = JournalSerializer(entrees, many=True, context={"cibles": precharger_cibles(entrees)})
        return Response({"total": total, "page": page, "pages": max(1, -(-total // taille)), "resultats": ser.data})


def filtrer_journal(params):
    qs = JournalActivite.objects.select_related("auteur").order_by("-date")
    if params.get("auteur") == "systeme":
        qs = qs.filter(auteur__isnull=True)
    elif (auteur := entier(params.get("auteur"))) is not None:
        qs = qs.filter(auteur_id=auteur)
    if params.get("categorie"):
        qs = qs.filter(action__in=[a for a, c in CATEGORIES.items() if c == params["categorie"]])
    if params.get("action"):
        qs = qs.filter(action=params["action"])
    if du := date_iso(params.get("du")):
        qs = qs.filter(date__date__gte=du)
    if au := date_iso(params.get("au")):
        qs = qs.filter(date__date__lte=au)
    return qs


# ---------------------------------------------------------------- Exports globaux
class ExportGlobalView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(
        parameters=[
            OpenApiParameter("format", str, enum=["xlsx", "csv"]),
            OpenApiParameter("evenement", int),
            OpenApiParameter("programme", int),
        ],
        responses={200: None, 202: None},
        summary="Exports : invites, presences, emails, journal",
    )
    def get(self, request, type_export):
        fmt = request.query_params.get("format", "xlsx")
        if fmt not in ("xlsx", "csv"):
            raise ErreurMetier("FORMAT", "Format attendu : xlsx ou csv.", status=400)
        invites = filtrer_par_evenement(Invite.objects.all(), request.query_params)
        if type_export == "invites":
            return exporter(request, invites, fmt)
        if type_export == "presences":
            return exporter(request, invites.filter(present_le__isnull=False), fmt, type_export="presences")
        if type_export == "emails":
            entetes, lignes = exports.lignes_emails(invites)
        elif type_export == "journal":
            entrees = list(filtrer_journal(request.query_params)[:20000])
            entetes, lignes = exports.lignes_journal(entrees, precharger_cibles(entrees))
        else:
            return Response(status=status.HTTP_404_NOT_FOUND)
        contenu, mime, ext = exports.fichier(entetes, lignes, fmt, type_export.capitalize())
        journaliser(request.user, "EXPORT", None, format=fmt, nb=len(lignes), type=type_export)
        return reponse_fichier(contenu, mime, f"{type_export}-{timezone.localtime():%Y%m%d-%H%M}.{ext}")


class ComptesResumeView(APIView):
    """Liste courte des comptes (filtre « auteur » du journal)."""

    permission_classes = [EstSuperAdmin]

    @extend_schema(responses={200: None})
    def get(self, request):
        return Response([{"id": a.pk, "nom": a.nom, "role": a.role} for a in Admin.objects.order_by("nom")])


# ---------------------------------------------------------------- Analyses (super admin)
class AnalytiqueView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(responses={200: None}, summary="Analyses de tous les événements (super admin)")
    def get(self, request):
        return Response(caches.lire(caches.CLE_ANALYTIQUE, analytique))


class TechniqueView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(responses={200: None}, summary="Indicateurs techniques : trafic, erreurs, emails, santé")
    def get(self, request):
        return Response(technique())


class RapportGlobalView(APIView):
    permission_classes = [EstSuperAdmin]
    throttle_classes = [RapportThrottle]

    @extend_schema(responses={(200, "application/pdf"): bytes}, summary="Rapport PDF global (analytique et technique)")
    def get(self, request):
        contenu = rapport_global(caches.lire(caches.CLE_ANALYTIQUE, analytique), technique(), request.user.nom)
        journaliser(request.user, "EXPORT", None, format="pdf", type="rapport_global")
        return reponse_pdf(contenu, f"rapport-global-{timezone.localtime():%Y%m%d-%H%M}.pdf")
