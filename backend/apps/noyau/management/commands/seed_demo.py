"""Données de démonstration (idempotent) : `python manage.py seed_demo`."""

import os
import random
import secrets
import unicodedata
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.comptes.models import Admin, Role
from apps.noyau import statuts
from apps.noyau.models import (
    Appareil,
    EmailEnvoye,
    Emargement,
    Evenement,
    InvitationSondage,
    Invite,
    ModeEmargement,
    Parametres,
    Programme,
    ReponseSondage,
    Source,
    Statut,
    StatutEmail,
    TypeEmail,
    nouveau_qr_token,
)

F_F = [
    "Aya",
    "Adjoua",
    "Akissi",
    "Affoué",
    "Amenan",
    "Mariam",
    "Fatoumata",
    "Awa",
    "Inès",
    "Grâce",
    "Nadège",
    "Christelle",
    "Marie-Laure",
    "Bintou",
    "Estelle",
    "Prisca",
    "Ange",
    "Salimata",
]
F_M = [
    "Kouamé",
    "Koffi",
    "Yao",
    "Konan",
    "Kouadio",
    "Ibrahim",
    "Seydou",
    "Moussa",
    "Didier",
    "Serge",
    "Jean-Marc",
    "Wilfried",
    "Arsène",
    "Hervé",
    "Franck",
    "Lacina",
    "Désiré",
    "Patrick",
]
NOMS = [
    "Kouassi",
    "Koné",
    "Traoré",
    "Ouattara",
    "Yao",
    "N'Guessan",
    "Bamba",
    "Coulibaly",
    "Diabaté",
    "Kouadio",
    "Konan",
    "Assi",
    "Gnagne",
    "Aka",
    "Brou",
    "Tanoh",
    "Dosso",
    "Fofana",
    "Touré",
    "Zadi",
    "Kacou",
    "Ehui",
    "Amon",
    "Djédjé",
    "Séri",
    "Kaboré",
    "Doumbia",
    "Ahoua",
    "Yapi",
    "Koua",
]
ENTREPRISES = [
    "Orange Côte d’Ivoire",
    "SIB",
    "Société Générale CI",
    "MTN Côte d’Ivoire",
    "Nestlé CI",
    "PETROCI",
    "Ecobank CI",
    "NSIA Banque",
    "SODECI",
    "CIE",
    "SIFCA",
    "Solibra",
    "Moov Africa",
    "Banque Atlantique",
    "Port Autonome d’Abidjan",
    "Ministère du Budget",
    "Air Côte d’Ivoire",
    "Bridge Bank",
    "",
    "",
]
FONCTIONS = [
    "Directeur général",
    "Directrice financière",
    "Responsable RH",
    "Directeur commercial",
    "Chef de projet",
    "Contrôleur de gestion",
    "Directrice marketing",
    "Responsable juridique",
    "Directeur des opérations",
    "Auditrice interne",
    "",
    "",
]
MODES = [ModeEmargement.QR_CAMERA] * 5 + [ModeEmargement.DOUCHETTE] * 2 + [ModeEmargement.CODE, ModeEmargement.MANUEL]
POSTES = {
    ModeEmargement.QR_CAMERA: ("Accueil principal", Appareil.TELEPHONE),
    ModeEmargement.DOUCHETTE: ("Accueil 3", Appareil.ORDINATEUR),
    ModeEmargement.CODE: ("Accueil 2", Appareil.TABLETTE),
    ModeEmargement.MANUEL: ("Accueil principal", Appareil.TELEPHONE),
}

SUPER_ADMIN = ("Ange Diabaté", "direction.evenements@mde.ci")
ADMINS = [
    ("Mariam Koné", "mariam.kone@mde.ci"),
    ("Kouamé Brou", "kouame.brou@mde.ci"),
    ("Inès Touré", "ines.toure@mde.ci"),
]
# Les mots de passe ne sont JAMAIS écrits dans le code : ils viennent de l'environnement
# (fichier .env local, non commité) ou sont tirés au hasard et affichés une seule fois.
ENV_MDP_SUPER_ADMIN = "DEMO_MOT_DE_PASSE_SUPER_ADMIN"
ENV_MDP_ADMIN = "DEMO_MOT_DE_PASSE_ADMIN"
LIEU = "Sofitel Abidjan Hôtel Ivoire · Cocody, Abidjan"
CARTE = "https://maps.google.com/?q=Sofitel+Abidjan+Hotel+Ivoire"


def sans_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def ident(s):
    return "".join(c for c in sans_accents(s).lower() if c.isalpha() or c == "-")


def quart(dt):
    return dt.replace(minute=dt.minute - dt.minute % 15, second=0, microsecond=0)


class Command(BaseCommand):
    help = "Crée les données de démonstration (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reinitialiser-mots-de-passe",
            action="store_true",
            help="Réapplique les mots de passe (variables DEMO_*) aux comptes de démonstration existants.",
        )

    def mot_de_passe(self, variable):
        valeur = os.environ.get(variable, "").strip()
        if valeur:
            return valeur, False
        return secrets.token_urlsafe(12), True

    @transaction.atomic
    def handle(self, *args, **options):
        self.reinitialiser = options.get("reinitialiser_mots_de_passe", False)
        self.mdp_generes = []
        self.rng = random.Random(2026)
        self.inscrit = Statut.objects.get(code=statuts.INSCRIT)
        self.present = Statut.objects.get(code=statuts.PRESENT)
        Parametres.charger()
        progs = {p.nom: p for p in Programme.objects.all()}
        for nom in ("AMP", "PMD"):
            progs[nom].magazine_actif = True
            progs[nom].lien_magazine = f"https://mde.ci/magazine/{nom.lower()}"
            progs[nom].save()

        mdp_sa, sa_genere = self.mot_de_passe(ENV_MDP_SUPER_ADMIN)
        mdp_admin, admin_genere = self.mot_de_passe(ENV_MDP_ADMIN)
        sa = self.compte(*SUPER_ADMIN, mdp_sa, role=Role.SUPER_ADMIN, genere=sa_genere)
        admins = [self.compte(nom, email, mdp_admin, genere=admin_genere) for nom, email in ADMINS]

        maintenant = timezone.localtime()
        aujourd_hui = maintenant.date()
        accueil = quart(maintenant - timedelta(hours=2))
        if accueil.date() != aujourd_hui:
            accueil = maintenant.replace(hour=0, minute=15, second=0, microsecond=0)
        debut = accueil + timedelta(minutes=45)

        amp = self.evenement(
            progs["AMP"],
            aujourd_hui,
            debut.time(),
            accueil.time(),
            260,
            ouvertes=False,
            limite=aujourd_hui - timedelta(days=7),
        )
        pmd = self.evenement(progs["PMD"], aujourd_hui + timedelta(days=49), time(18, 30), time(17, 45), 220)
        pamp = self.evenement(progs["Public-AMP"], aujourd_hui + timedelta(days=57), time(17, 30), time(16, 45), 180)
        pasd = self.evenement(progs["Public-ASD"], aujourd_hui + timedelta(days=64), time(18, 0), time(17, 15), 150)
        amp.admins.set([admins[0], admins[1]])
        pmd.admins.set([admins[0], admins[2]])
        pamp.admins.set([admins[2]])
        pasd.admins.set([admins[2]])

        self.peupler(amp, 40, 24, admins[:2], courant=True, accueil=accueil, maintenant=maintenant)
        self.peupler(pmd, 40, 0, admins)
        self.peupler(pamp, 6, 0, admins)

        historiques = {
            "AMP": [(2025, 231, 204), (2024, 214, 183), (2023, 198, 162)],
            "PMD": [(2025, 176, 151), (2024, 160, 133), (2023, 149, 120)],
        }
        for nom, editions in historiques.items():
            for annee, nb, nbp in editions:
                d = date(annee, 11, 14 if nom == "AMP" else 27)
                ev = self.evenement(
                    progs[nom], d, time(18, 0), time(17, 15), nb + 20, ouvertes=False, limite=d - timedelta(days=7)
                )
                ev.admins.set([admins[0]])
                debut_hist = timezone.make_aware(datetime.combine(d, time(17, 15)))
                self.peupler(
                    ev, nb, nbp, admins[:1], accueil=debut_hist, maintenant=debut_hist + timedelta(hours=2), leger=True
                )
                if annee == 2025:
                    self.sonder(ev)

        self.stdout.write(
            self.style.SUCCESS(
                f"Données de démonstration prêtes. Super admin : {sa.email} · admins : "
                + ", ".join(a.email for a in admins)
            )
        )

    def sonder(self, ev):
        """Sondage de satisfaction passé (envoyé le lendemain à 8 h, ~45 % de réponses), idempotent."""
        if InvitationSondage.objects.filter(invite__evenement=ev).exists():
            return
        rng = self.rng
        envoi = timezone.make_aware(datetime.combine(ev.date + timedelta(days=1), time(8, 0)))
        presents = list(ev.invites.filter(statut=self.present))
        InvitationSondage.objects.bulk_create(
            [InvitationSondage(invite=i, cree_le=envoi, expire_le=envoi + timedelta(hours=24)) for i in presents],
            batch_size=500,
        )
        commentaires = [
            "Très belle cérémonie, bravo à toute l’équipe.",
            "Accueil rapide, le QR code a été lu en une seconde.",
            "Un peu d’attente à l’entrée vers 18 h.",
            "Moment inoubliable pour notre famille, merci !",
            "Le son était un peu faible au fond de la salle.",
            "",
            "",
            "",
        ]
        reponses, repondus = [], []
        for k, inv in enumerate(InvitationSondage.objects.filter(invite__evenement=ev).order_by("pk")):
            if rng.random() > 0.45:
                continue
            repondus.append(inv.pk)
            note = rng.choices([5, 4, 3, 2], weights=[50, 32, 13, 5])[0]
            reponses.append(
                ReponseSondage(
                    evenement=ev,
                    note_globale=note,
                    note_accueil=max(1, min(5, note + rng.choice([-1, 0, 0, 1]))),
                    recommandation=min(10, max(0, note * 2 + rng.choice([-1, 0, 0, 1]))),
                    commentaire=rng.choice(commentaires),
                    appareil=f"demo-{ev.pk}-{k}",
                    cree_le=envoi + timedelta(hours=rng.randint(0, 20)),
                )
            )
        ReponseSondage.objects.bulk_create(reponses, batch_size=500)
        InvitationSondage.objects.filter(pk__in=repondus).update(repondu=True)

    def compte(self, nom, email, mdp, role=Role.ADMIN, genere=False):
        admin = Admin.objects.filter(email=email).first()
        if admin is None:
            admin = Admin.objects.create_user(email, nom, mdp, role=role)
        elif self.reinitialiser:
            admin.set_password(mdp)
            admin.save(update_fields=["password"])
        else:
            return admin
        if genere:
            self.stdout.write(
                self.style.WARNING(f"Mot de passe généré pour {email} : {mdp} (noté nulle part ailleurs)")
            )
        return admin

    def evenement(self, prog, d, debut, accueil, capacite, ouvertes=True, limite=None):
        ev = Evenement.objects.filter(programme=prog, date__year=d.year).first()
        if ev is None:
            ev = Evenement.objects.create(
                programme=prog,
                date=d,
                heure_debut=debut,
                heure_accueil=accueil,
                lieu=LIEU,
                lien_carte=CARTE,
                capacite=capacite,
                date_limite_inscription=limite or d - timedelta(days=7),
                inscriptions_ouvertes=ouvertes,
            )
        return ev

    def peupler(self, ev, nb, nb_presents, admins, courant=False, accueil=None, maintenant=None, leger=False):
        if ev.invites.exists():
            return
        rng = self.rng
        maintenant_reel = timezone.now()
        codes = rng.sample(range(10000), nb)
        invites, vus = [], set()
        for i in range(nb):
            femme = rng.random() < 0.48
            prenom, nom = rng.choice(F_F if femme else F_M), rng.choice(NOMS)
            ent = rng.choice(ENTREPRISES)
            dom = ident(ent.split(" ")[0]) + ".ci" if ent else "gmail.com"
            email = f"{ident(prenom)}.{ident(nom)}@{dom}"
            n = 2
            while email in vus:
                email = f"{ident(prenom)}.{ident(nom)}{n}@{dom}"
                n += 1
            vus.add(email)
            inscrit_le = timezone.make_aware(
                datetime.combine(
                    ev.date - timedelta(days=rng.randint(8, 40)), time(rng.randint(8, 21), rng.randint(0, 59))
                )
            )
            if inscrit_le > maintenant_reel:
                # événement à venir : l'inscription a eu lieu dans les 30 derniers jours, jamais dans le futur
                inscrit_le = maintenant_reel - timedelta(minutes=rng.randint(10, 30 * 24 * 60))
            invites.append(
                Invite(
                    evenement=ev,
                    statut=self.inscrit,
                    civilite="MME" if femme else "M",
                    nom=nom,
                    prenom=prenom,
                    email=email,
                    telephone="+225 "
                    + rng.choice(["07", "05", "01"])
                    + " "
                    + " ".join(f"{rng.randint(0, 99):02d}" for _ in range(4)),
                    entreprise=ent,
                    fonction=rng.choice(FONCTIONS) if ent else "",
                    code=f"{codes[i]:04d}",
                    qr_token=nouveau_qr_token(),
                    source=Source.MANUEL if rng.random() < 0.08 else Source.FORMULAIRE,
                    consentement_donnees=True,
                    consentement_le=inscrit_le,
                    inscrit_le=inscrit_le,
                )
            )
        Invite.objects.bulk_create(invites, batch_size=500)
        invites = list(ev.invites.order_by("pk"))
        envois = []
        echecs = set(rng.sample(range(nb), 3)) if courant or nb == 40 else set()
        for k, inv in enumerate(invites):
            echec = k in echecs and k >= nb_presents
            envois.append(
                EmailEnvoye(
                    invite=inv,
                    type=TypeEmail.INVITATION,
                    statut=StatutEmail.ECHEC if echec else StatutEmail.ENVOYE,
                    tentatives=4 if echec else 1,
                    envoye_le=None if echec else inv.inscrit_le,
                    erreur="SMTPRecipientsRefused: 550 Mailbox unavailable" if echec else "",
                    cree_le=inv.inscrit_le,
                )
            )
        presents = invites[:nb_presents]
        duree = max(60, (maintenant - accueil).total_seconds() - 60) if presents else 0
        emargements = []
        for inv in presents:
            mode = rng.choice(MODES)
            poste, appareil = POSTES[mode]
            arrivee = accueil + timedelta(seconds=duree * rng.random() ** 0.8)
            inv.statut, inv.present_le, inv.mode_emargement = self.present, arrivee, mode
            emargements.append(
                Emargement(
                    invite=inv, admin=rng.choice(admins), mode=mode, poste=poste, appareil=appareil, date=arrivee
                )
            )
            if not leger:
                envois.append(
                    EmailEnvoye(
                        invite=inv,
                        type=TypeEmail.MAGAZINE,
                        statut=StatutEmail.ENVOYE,
                        tentatives=1,
                        envoye_le=arrivee + timedelta(seconds=20),
                        cree_le=arrivee,
                    )
                )
        Invite.objects.bulk_update(presents, ["statut", "present_le", "mode_emargement"], batch_size=500)
        Emargement.objects.bulk_create(emargements, batch_size=500)
        if not leger:
            EmailEnvoye.objects.bulk_create(envois, batch_size=500)
