"""Gestion des invités d'un événement (admin) et de tous les événements (super admin)."""

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.comptes.permissions import EstAdmin, EstSuperAdmin, evenements_visibles

from . import emails, exports, services, statuts
from .exceptions import ErreurMetier
from .filtres import PaginationInvites, compteurs_invites, filtrer_invites, filtrer_par_evenement, trier_invites
from .journal import journaliser
from .models import Appareil, Invite, ModeEmargement, Source, TypeEmail
from .qr import qr_png
from .serializers import (
    AjoutInviteSerializer,
    InviteSerializer,
    ModificationInviteSerializer,
    invites_annotes,
)
from .taches import DOSSIER, DUREE, SEUIL_ASYNCHRONE, creer_tache, lire_tache, tache_action_groupee, tache_export

PARAMS_LISTE = [
    OpenApiParameter("q", str, description="Nom, prénom, email, téléphone, entreprise ou code"),
    OpenApiParameter("statut", str, enum=["INSCRIT", "PRESENT"]),
    OpenApiParameter("mode", str, enum=[m.value for m in ModeEmargement]),
    OpenApiParameter("magazine", str, enum=["ENVOYE", "NON"]),
    OpenApiParameter("email1", str, enum=["ECHEC"]),
    OpenApiParameter(
        "tri",
        str,
        description="nom, entreprise, statut, inscritLe, presentLe, email1, email2 ; préfixe « - » pour décroissant",
    ),
    OpenApiParameter("page", int),
    OpenApiParameter("taille", int, enum=[25, 50, 100]),
]


def invites_visibles(user):
    return Invite.objects.filter(evenement__in=evenements_visibles(user))


def evenement_visible(user, pk):
    return get_object_or_404(evenements_visibles(user), pk=pk)


def invite_visible(user, pk):
    return get_object_or_404(invites_visibles(user).select_related("statut", "evenement__programme"), pk=pk)


def _nom_export(evenement=None):
    base = f"invites-{slugify(evenement.programme.nom)}-{evenement.annee}" if evenement else "invites-tous-evenements"
    return f"{base}-{timezone.localtime():%Y%m%d-%H%M}"


MIMES_EXPORT = {
    "csv": "text/csv; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def reponse_fichier(contenu, mime, nom):
    reponse = HttpResponse(contenu, content_type=mime)
    reponse["Content-Disposition"] = f'attachment; filename="{nom}"'
    return reponse


def exporter(request, qs, fmt, evenement=None, type_export="invites"):
    """Export synchrone jusqu'à 50 lignes, tâche Celery au-delà (réponse 202 + tacheId)."""
    if fmt not in ("xlsx", "csv"):
        raise ErreurMetier("FORMAT", "Format attendu : xlsx ou csv.", status=400)
    ids = list(qs.values_list("pk", flat=True))
    nom = _nom_export(evenement)
    if len(ids) > SEUIL_ASYNCHRONE:
        tache_id = creer_tache(request.user.pk, "export")
        tache_export.delay(tache_id, request.user.pk, ids, fmt, nom, type_export, evenement.pk if evenement else None)
        return Response({"tacheId": tache_id, "nb": len(ids)}, status=status.HTTP_202_ACCEPTED)
    fabrique = exports.lignes_presences if type_export == "presences" else exports.lignes_invites
    entetes, lignes = fabrique(Invite.objects.filter(pk__in=ids))
    contenu, mime, ext = exports.fichier(entetes, lignes, fmt, "Invités")
    journaliser(
        request.user,
        "EXPORT",
        None,
        format=fmt,
        nb=len(lignes),
        type=type_export,
        evenement=evenement.pk if evenement else None,
    )
    return reponse_fichier(contenu, mime, f"{nom}.{ext}")


class ListeInvitesBase(APIView):
    pagination_class = PaginationInvites

    def paginer(self, request, qs_base):
        qs = filtrer_invites(qs_base, request.query_params)
        pagination = PaginationInvites()
        pagination.compteurs = compteurs_invites(qs_base)
        page = pagination.paginate_queryset(trier_invites(qs, request.query_params), request, view=self)
        return pagination.get_paginated_response(InviteSerializer(page, many=True).data)


class InvitesEvenementView(ListeInvitesBase):
    permission_classes = [EstAdmin]

    @extend_schema(
        parameters=PARAMS_LISTE,
        responses={200: InviteSerializer(many=True)},
        summary="Invités d'un événement (pagination, recherche, filtres, tri, compteurs)",
    )
    def get(self, request, pk):
        evenement = evenement_visible(request.user, pk)
        return self.paginer(request, invites_annotes(evenement.invites.all()))

    @extend_schema(request=AjoutInviteSerializer, responses={201: InviteSerializer}, summary="Ajout manuel")
    def post(self, request, pk):
        evenement = evenement_visible(request.user, pk)
        ser = AjoutInviteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        donnees = dict(ser.validated_data)
        envoyer = donnees.pop("envoyer_invitation")
        invite = services.creer_invite(
            evenement, donnees, source=Source.MANUEL, auteur=request.user, envoyer_invitation=envoyer
        )
        return Response(
            InviteSerializer(invites_annotes(Invite.objects.filter(pk=invite.pk)).get()).data,
            status=status.HTTP_201_CREATED,
        )


class TousInvitesView(ListeInvitesBase):
    permission_classes = [EstSuperAdmin]

    @extend_schema(
        parameters=PARAMS_LISTE + [OpenApiParameter("evenement", int), OpenApiParameter("programme", int)],
        responses={200: InviteSerializer(many=True)},
        summary="Tous les invités (super admin)",
    )
    def get(self, request):
        base = filtrer_par_evenement(Invite.objects.all(), request.query_params)
        return self.paginer(request, invites_annotes(base))


class ExportTousInvitesView(APIView):
    permission_classes = [EstSuperAdmin]

    @extend_schema(
        parameters=PARAMS_LISTE + [OpenApiParameter("format", str, enum=["xlsx", "csv"])],
        responses={200: None, 202: None},
    )
    def get(self, request):
        qs = filtrer_invites(invites_annotes(Invite.objects.all()), request.query_params)
        return exporter(request, qs, request.query_params.get("format", "xlsx"))


class InviteDetailView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(responses={200: InviteSerializer})
    def get(self, request, pk):
        invite_visible(request.user, pk)
        return Response(InviteSerializer(invites_annotes(Invite.objects.filter(pk=pk)).get()).data)

    @extend_schema(request=ModificationInviteSerializer, responses={200: InviteSerializer})
    def patch(self, request, pk):
        invite = invite_visible(request.user, pk)
        ser = ModificationInviteSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        champs = []
        for champ, valeur in ser.validated_data.items():
            if getattr(invite, champ) != valeur:
                setattr(invite, champ, valeur)
                champs.append(champ)
        if (
            "email" in champs
            and Invite.objects.filter(evenement=invite.evenement, email=invite.email).exclude(pk=invite.pk).exists()
        ):
            raise serializers.ValidationError({"email": "Cette adresse est déjà inscrite à cet événement."})
        if champs:
            try:
                with transaction.atomic():
                    invite.save(update_fields=champs)
            except IntegrityError as exc:
                raise serializers.ValidationError(
                    {"email": "Cette adresse est déjà inscrite à cet événement."}
                ) from exc
            journaliser(request.user, "INVITE_MODIFICATION", invite, evenement=invite.evenement_id, champs=champs)
        return Response(InviteSerializer(invites_annotes(Invite.objects.filter(pk=pk)).get()).data)


class RenvoiEmailSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=TypeEmail.choices, default=TypeEmail.INVITATION)


class RenvoiEmailView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(request=RenvoiEmailSerializer, responses={202: None}, summary="Renvoi manuel d'un email")
    def post(self, request, pk):
        invite = invite_visible(request.user, pk)
        ser = RenvoiEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        type_email = ser.validated_data["type"]
        if type_email == TypeEmail.MAGAZINE:
            prog = invite.evenement.programme
            if invite.statut.code != statuts.PRESENT or not prog.lien_magazine:
                raise ErreurMetier("MAGAZINE_INDISPONIBLE", "L’email n°2 n’est disponible que pour un invité présent.")
        emails.planifier(invite, type_email)
        journaliser(request.user, "EMAIL_RENVOI", invite, evenement=invite.evenement_id, type=type_email)
        return Response({"detail": "Email programmé."}, status=status.HTTP_202_ACCEPTED)


class QrInviteView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(responses={(200, "image/png"): bytes}, summary="QR code de l'invité (PNG)")
    def get(self, request, pk):
        invite = invite_visible(request.user, pk)
        reponse = HttpResponse(qr_png(invite.qr_token), content_type="image/png")
        reponse["Cache-Control"] = "private, max-age=300"
        return reponse


class HistoriqueView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(
        responses={200: None}, summary="Historique : inscription, emails, émargements, annulations, modifications"
    )
    def get(self, request, pk):
        from .journal_texte import CHAMPS
        from .models import JournalActivite

        invite = invite_visible(request.user, pk)
        evts = [
            {
                "type": "INSCRIPTION",
                "date": invite.inscrit_le,
                "libelle": "Formulaire rempli" if invite.source == Source.FORMULAIRE else "Ajout manuel",
                "detail": "Consentement données personnelles donné" if invite.consentement_donnees else "",
            }
        ]
        for e in invite.emails.all():
            libelle = "Email n°1 · invitation" if e.type == TypeEmail.INVITATION else "Email n°2 · magazine"
            etat = {"ENVOYE": "envoyé", "EN_ATTENTE": "en attente", "ECHEC": "en échec"}[e.statut]
            evts.append(
                {
                    "type": f"EMAIL_{e.statut}",
                    "date": e.envoye_le or e.cree_le,
                    "libelle": f"{libelle} {etat}",
                    "detail": "Adresse rejetée ou boîte pleine"
                    if e.statut == "ECHEC"
                    else (f"{e.tentatives} tentative(s)" if e.tentatives > 1 else ""),
                }
            )
        for em in invite.emargements.select_related("admin", "annule_par"):
            evts.append(
                {
                    "type": "EMARGEMENT",
                    "date": em.date,
                    "libelle": "Statut « Présent »",
                    "detail": " · ".join(filter(None, [em.get_mode_display(), em.poste, em.admin.nom])),
                }
            )
            if em.annule_le:
                evts.append(
                    {
                        "type": "ANNULATION",
                        "date": em.annule_le,
                        "libelle": "Présence annulée",
                        "detail": " · ".join(
                            filter(None, [em.annule_par.nom if em.annule_par else "", em.motif_annulation])
                        ),
                    }
                )
        for j in JournalActivite.objects.filter(
            cible_type="Invite", cible_id=invite.pk, action="INVITE_MODIFICATION"
        ).select_related("auteur"):
            champs = ", ".join(CHAMPS.get(c, c) for c in j.details.get("champs", []))
            evts.append(
                {
                    "type": "MODIFICATION",
                    "date": j.date,
                    "libelle": "Fiche modifiée",
                    "detail": f"{champs} · {j.auteur.nom if j.auteur else 'Système'}",
                }
            )
        evts.sort(key=lambda x: x["date"])
        return Response(evts)


ACTIONS = ("VALIDER", "RENVOYER", "EXPORTER")


class ActionGroupeeSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=ACTIONS)
    ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)
    tous = serializers.BooleanField(default=False, help_text="Appliquer à la vue filtrée (paramètres d'URL)")
    format = serializers.ChoiceField(choices=["xlsx", "csv"], default="xlsx")


def executer_action_groupee(admin, evenement, action, invite_ids, contexte):
    qs = evenement.invites.filter(pk__in=invite_ids).select_related("statut")
    if action == "VALIDER":
        n = 0
        for invite in qs:
            if invite.statut.code == statuts.INSCRIT:
                r = services.emarger(
                    evenement,
                    admin,
                    invite_id=invite.pk,
                    mode=ModeEmargement.MANUEL,
                    poste=contexte.get("poste", "Tableau admin"),
                    appareil=Appareil.ORDINATEUR,
                )
                n += r["resultat"] == services.PRESENT
        return {"traites": n, "ignores": qs.count() - n}
    if action == "RENVOYER":
        n = 0
        for invite in qs:
            emails.planifier(invite, TypeEmail.INVITATION)
            n += 1
        journaliser(admin, "EMAIL_RENVOI", None, evenement=evenement.pk, type=TypeEmail.INVITATION, nb=n)
        return {"traites": n}
    raise ValueError(action)


class ActionsGroupeesView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(
        request=ActionGroupeeSerializer,
        parameters=PARAMS_LISTE,
        responses={200: None, 202: None},
        summary="Valider, renvoyer ou exporter une sélection",
    )
    def post(self, request, pk):
        evenement = evenement_visible(request.user, pk)
        ser = ActionGroupeeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        base = invites_annotes(evenement.invites.all())
        qs = filtrer_invites(base, request.query_params) if d["tous"] else base.filter(pk__in=d.get("ids") or [])
        if d["action"] == "EXPORTER":
            return exporter(request, qs, d["format"], evenement)
        ids = list(qs.values_list("pk", flat=True))
        if not ids:
            raise ErreurMetier("SELECTION_VIDE", "Aucun invité sélectionné.", status=400)
        if len(ids) > SEUIL_ASYNCHRONE:
            tache_id = creer_tache(request.user.pk, d["action"])
            tache_action_groupee.delay(tache_id, request.user.pk, evenement.pk, d["action"], ids)
            return Response({"tacheId": tache_id, "nb": len(ids)}, status=status.HTTP_202_ACCEPTED)
        return Response(executer_action_groupee(request.user, evenement, d["action"], ids, {}))


class ExportEvenementView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(
        parameters=PARAMS_LISTE + [OpenApiParameter("format", str, enum=["xlsx", "csv"])],
        responses={200: None, 202: None},
        summary="Export Excel / CSV de la vue filtrée",
    )
    def get(self, request, pk):
        evenement = evenement_visible(request.user, pk)
        qs = filtrer_invites(invites_annotes(evenement.invites.all()), request.query_params)
        return exporter(request, qs, request.query_params.get("format", "xlsx"), evenement)


class TacheView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(responses={200: None}, summary="État d'une tâche Celery (export ou action groupée)")
    def get(self, request, tache_id):
        tache = lire_tache(tache_id)
        if not tache or tache.get("proprietaire") != request.user.pk:
            raise Http404
        donnees = {k: v for k, v in tache.items() if k not in ("proprietaire", "fichier")}
        if tache.get("fichier"):
            donnees["telechargement"] = f"/api/taches/{tache_id}/fichier/"
        return Response(donnees)


class TacheFichierView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(responses={(200, "application/octet-stream"): bytes})
    def get(self, request, tache_id):
        tache = lire_tache(tache_id)
        if not tache or tache.get("proprietaire") != request.user.pk or not tache.get("fichier"):
            raise Http404
        chemin = DOSSIER / tache["fichier"]
        # fichier à usage unique : supprimé dès le téléchargement (données personnelles)
        try:
            contenu = chemin.read_bytes()
        except FileNotFoundError:  # déjà téléchargé (requête concurrente) ou purgé
            raise Http404 from None
        chemin.unlink(missing_ok=True)
        tache.pop("fichier", None)
        cache.set(f"tache:{tache_id}", tache, DUREE)
        mime = MIMES_EXPORT.get(chemin.suffix.lstrip("."), "application/octet-stream")
        return reponse_fichier(contenu, mime, tache["nom"])


class AnnulerPresenceSerializer(serializers.Serializer):
    motif = serializers.CharField(required=False, allow_blank=True, max_length=200, default="")


class ValiderPresenceView(APIView):
    """Action par ligne « Valider la présence » (mode MANUEL)."""

    permission_classes = [EstAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, pk):
        invite = invite_visible(request.user, pk)
        r = services.emarger(
            invite.evenement,
            request.user,
            invite_id=invite.pk,
            mode=ModeEmargement.MANUEL,
            poste="Tableau admin",
            appareil=Appareil.ORDINATEUR,
        )
        return Response({"resultat": r["resultat"], "magazineEnvoye": r["magazine_envoye"]})


class AnnulerPresenceView(APIView):
    permission_classes = [EstAdmin]

    @extend_schema(request=AnnulerPresenceSerializer, responses={200: None})
    def post(self, request, pk):
        invite = invite_visible(request.user, pk)
        ser = AnnulerPresenceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        services.annuler_presence(invite, request.user, ser.validated_data["motif"])
        return Response({"resultat": "ANNULE"})
