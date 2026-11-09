"""Requêtes N+1 : le nombre de requêtes SQL d'une page ne doit pas grandir avec le nombre de lignes affichées.

Chaque page est appelée deux fois : avec peu de données, puis après en avoir ajouté beaucoup (invités émargés ou
non, emails n°1 et n°2, réponses au sondage, cérémonies, comptes, journal). Le nombre de requêtes doit rester
identique, à une petite marge près (requête conditionnelle), jamais proportionnel aux lignes : le jour J, une
page qui ferait une requête par invité multiplierait la charge de MySQL par le nombre d'invités.
"""

from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.comptes.models import Admin
from apps.noyau.journal import journaliser
from apps.noyau.models import Appareil, ModeEmargement, ReponseSondage
from apps.noyau.services import emarger

from .conftest import MDP, client_connecte, creer_evenement, nouvel_invite

pytestmark = pytest.mark.django_db

MARGE = 2  # requêtes conditionnelles (une section qui n'apparaît qu'avec des données), jamais une par ligne


def peupler(evenement, super_admin, debut, n):
    """n invités (un sur deux émargé, donc email n°2), n réponses au sondage, une cérémonie et un hôte de plus."""
    for i in range(debut, debut + n):
        inv = nouvel_invite(evenement, email=f"invite{i}@sib.ci", nom=f"Nom{i}", prenom=f"Prenom{i}")
        if i % 2 == 0:
            emarger(evenement, super_admin, invite_id=inv.pk, mode=ModeEmargement.MANUEL, appareil=Appareil.TELEPHONE)
        ReponseSondage.objects.create(
            evenement=evenement,
            note_globale=4,
            note_accueil=5,
            recommandation=9,
            commentaire=f"Bien {i}",
            appareil=f"appareil-{i}",
        )
        journaliser(super_admin, "INVITE_MODIFICATION", inv, evenement=evenement.pk)
    ev = creer_evenement(evenement.programme, date=evenement.date + timedelta(days=debut + 1))
    hote = Admin.objects.create_user(f"hote{debut}@mde.ci", f"Hôte {debut}", MDP)
    ev.admins.add(hote)
    evenement.admins.add(hote)


def compter(client, url):
    with CaptureQueriesContext(connection) as requetes:
        r = client.get(url)
    assert r.status_code == 200, (url, r.status_code, r.content[:300])
    return len(requetes.captured_queries)


def pages(evenement, invite_id):
    e = evenement.pk
    return [
        "/api/evenements/",
        f"/api/evenements/{e}/",
        f"/api/evenements/{e}/statistiques/",
        f"/api/evenements/{e}/suivi-emails/",
        f"/api/evenements/{e}/sondage/",
        f"/api/evenements/{e}/rapport/",
        f"/api/evenements/{e}/invites/?taille=100",
        f"/api/evenements/{e}/invites/?taille=100&q=Nom",
        f"/api/evenements/{e}/invites/export/?format=csv",
        f"/api/evenements/{e}/emargements/recents/",
        "/api/invites/?taille=100",
        "/api/invites/export/?format=csv",
        f"/api/invites/{invite_id}/",
        f"/api/invites/{invite_id}/historique/",
        "/api/exports/invites/?format=csv",
        "/api/exports/presences/?format=csv",
        "/api/exports/emails/?format=csv",
        "/api/exports/journal/?format=csv",
        "/api/programmes/",
        "/api/admins/",
        "/api/comptes/",
        "/api/journal/",
        "/api/analytique/",
        "/api/analytique/technique/",
        "/api/analytique/sondages/",
        "/api/rapports/global/",
        "/api/erreurs-techniques/",
    ]


def croissances(client, mesurer_urls, ajouter):
    avant = {u: compter(client, u) for u in mesurer_urls}
    ajouter()
    apres = {u: compter(client, u) for u in mesurer_urls}
    return {u: (avant[u], apres[u]) for u in avant if apres[u] > avant[u] + MARGE}


def test_pages_sans_requetes_n_plus_1(evenement, super_admin):
    client = client_connecte(super_admin)
    premier = nouvel_invite(evenement, email="premier@sib.ci", nom="Nom0")
    peupler(evenement, super_admin, 1, 2)
    trop = croissances(client, pages(evenement, premier.pk), lambda: peupler(evenement, super_admin, 10, 20))
    assert not trop, f"requêtes proportionnelles aux lignes (avant, après) : {trop}"


def test_recherche_de_la_borne_sans_requetes_n_plus_1(admin, evenement, super_admin):
    borne = client_connecte(admin)
    assert borne.post("/api/auth/borne/").status_code == 204
    peupler(evenement, super_admin, 1, 2)
    url = f"/api/evenements/{evenement.pk}/borne/recherche/?q=Prenom"
    trop = croissances(borne, [url], lambda: peupler(evenement, super_admin, 10, 8))
    assert not trop, f"requêtes proportionnelles aux lignes (avant, après) : {trop}"
