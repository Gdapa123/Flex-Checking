"""Recherche, filtres, tri et pagination côté serveur du tableau des invités."""

import re

from django.db.models import Count, F, Q, Value
from django.db.models.functions import Replace
from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from . import statuts
from .models import StatutEmail
from .validation import entier

TRIS = {
    "nom": ["nom", "prenom"],
    "prenom": ["prenom", "nom"],
    "entreprise": ["entreprise", "nom"],
    "statut": ["statut__ordre", "nom"],
    "inscritLe": ["inscrit_le"],
    "presentLe": ["present_le"],
    "email1": ["email1", "nom"],
    "email2": ["email2", "nom"],
    "evenement": ["evenement__date", "nom"],
}


def identifiant(params, cle):
    """Identifiant numérique d'un paramètre d'URL (`evenement`, `programme`), None s'il est absent.
    Une valeur non numérique est refusée (400) au lieu de provoquer une erreur serveur."""
    valeur = params.get(cle)
    if not valeur:
        return None
    if (nombre := entier(valeur)) is None:
        raise serializers.ValidationError({cle: "Identifiant numérique attendu."})
    return nombre


def filtrer_par_evenement(qs, params):
    if (evenement := identifiant(params, "evenement")) is not None:
        qs = qs.filter(evenement_id=evenement)
    if (programme := identifiant(params, "programme")) is not None:
        qs = qs.filter(evenement__programme_id=programme)
    return qs


def filtrer_invites(qs, params):
    q = (params.get("q") or "").strip()
    if q and re.fullmatch(r"[\d\s+.]+", q) and len(re.sub(r"\D", "", q)) >= 3:
        # recherche numérique : téléphone (chiffres contigus) ou code
        chiffres = re.sub(r"\D", "", q)
        qs = qs.annotate(tel_chiffres=Replace("telephone", Value(" "), Value("")))
        qs = qs.filter(Q(tel_chiffres__contains=chiffres) | Q(code=chiffres))
    elif q:
        qs = qs.annotate(tel_chiffres=Replace("telephone", Value(" "), Value("")))
        for mot in q.split()[:6]:
            condition = (
                Q(nom__icontains=mot)
                | Q(prenom__icontains=mot)
                | Q(email__icontains=mot)
                | Q(entreprise__icontains=mot)
                | Q(code=mot)
            )
            chiffres = re.sub(r"\D", "", mot)
            if len(chiffres) >= 3:
                condition |= Q(tel_chiffres__contains=chiffres)
            qs = qs.filter(condition)
    statut = params.get("statut")
    if statut in (statuts.INSCRIT, statuts.PRESENT):
        qs = qs.filter(statut__code=statut)
    mode = params.get("mode")
    if mode:
        qs = qs.filter(mode_emargement=mode)
    magazine = params.get("magazine")
    if magazine == "ENVOYE":
        qs = qs.filter(email2=StatutEmail.ENVOYE)
    elif magazine == "NON":
        qs = qs.filter(Q(email2__isnull=True) | ~Q(email2=StatutEmail.ENVOYE))
    if params.get("email1") == "ECHEC":
        qs = qs.filter(email1=StatutEmail.ECHEC)
    return filtrer_par_evenement(qs, params)


def trier_invites(qs, params):
    tri = params.get("tri") or "-inscritLe"
    desc = tri.startswith("-")
    champs = TRIS.get(tri.lstrip("-"), TRIS["inscritLe"])
    # seul le critère principal change de sens ; les égalités restent classées de A à Z
    principal, *secondaires = champs
    ordre = [F(principal).desc(nulls_last=True) if desc else F(principal).asc(nulls_last=True)]
    ordre += [F(c).asc(nulls_last=True) for c in secondaires]
    return qs.order_by(*ordre, "pk")


def compteurs_invites(qs):
    c = qs.aggregate(
        tous=Count("id"),
        inscrits=Count("id", filter=Q(statut__code=statuts.INSCRIT)),
        presents=Count("id", filter=Q(statut__code=statuts.PRESENT)),
        a_renvoyer=Count("id", filter=Q(email1=StatutEmail.ECHEC)),
    )
    return c


class PaginationInvites(PageNumberPagination):
    page_size = 25
    page_size_query_param = "taille"
    max_page_size = 100
    compteurs = None

    def get_page_size(self, request):
        taille = request.query_params.get("taille")
        return int(taille) if taille in ("25", "50", "100") else self.page_size

    def get_paginated_response(self, data):
        return Response(
            {
                "total": self.page.paginator.count,
                "page": self.page.number,
                "pages": self.page.paginator.num_pages,
                "taille": self.get_page_size(self.request),
                "compteurs": self.compteurs or {},
                "resultats": data,
            }
        )
