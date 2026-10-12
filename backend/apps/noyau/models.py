import secrets

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from . import statuts

couleur_hex = RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Couleur au format #RRGGBB attendue.")


class Programme(models.Model):
    nom = models.CharField(max_length=60, unique=True)
    couleur_principale = models.CharField(max_length=7, validators=[couleur_hex])
    couleur_secondaire = models.CharField(max_length=7, validators=[couleur_hex])
    actif = models.BooleanField(default=True)
    magazine_actif = models.BooleanField(default=False)
    lien_magazine = models.URLField(blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.nom

    def save(self, *args, **kwargs):
        self.couleur_principale = (self.couleur_principale or "").upper()
        self.couleur_secondaire = (self.couleur_secondaire or "").upper()
        super().save(*args, **kwargs)


def nouveau_slug(programme_nom, annee):
    return f"{slugify(programme_nom)}-{annee}-{secrets.token_hex(3)}"


class Evenement(models.Model):
    programme = models.ForeignKey(Programme, on_delete=models.PROTECT, related_name="evenements")
    date = models.DateField()
    heure_debut = models.TimeField()
    heure_accueil = models.TimeField()
    lieu = models.CharField(max_length=200)
    lien_carte = models.URLField(blank=True)
    capacite = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    date_limite_inscription = models.DateField()
    inscriptions_ouvertes = models.BooleanField(default=True)
    slug_inscription = models.SlugField(max_length=80, unique=True)
    admins = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="evenements", blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return self.nom_affiche

    @property
    def annee(self):
        return self.date.year

    @property
    def nom_affiche(self):
        return f"Graduation {self.programme.nom} {self.annee}"

    def save(self, *args, **kwargs):
        if not self.slug_inscription:
            self.slug_inscription = nouveau_slug(self.programme.nom, self.annee)
        super().save(*args, **kwargs)

    def regenerer_slug(self):
        self.slug_inscription = nouveau_slug(self.programme.nom, self.annee)
        self.save(update_fields=["slug_inscription", "modifie_le"])


class Statut(models.Model):
    code = models.CharField(max_length=20, unique=True)
    libelle = models.CharField(max_length=40)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre"]

    def __str__(self):
        return self.libelle

    @classmethod
    def par_code(cls, code):
        return cls.objects.get(code=code)


def statut_inscrit_id():
    return Statut.objects.only("id").get(code=statuts.INSCRIT).id


class Civilite(models.TextChoices):
    MME = "MME", "Mme"
    M = "M", "M."


class Source(models.TextChoices):
    FORMULAIRE = "FORMULAIRE", "Formulaire"
    MANUEL = "MANUEL", "Manuel"


class ModeEmargement(models.TextChoices):
    QR_CAMERA = "QR_CAMERA", "QR caméra"
    DOUCHETTE = "DOUCHETTE", "Douchette"
    CODE = "CODE", "Code 4 chiffres"
    MANUEL = "MANUEL", "Manuel"


class Appareil(models.TextChoices):
    TELEPHONE = "TELEPHONE", "Téléphone"
    TABLETTE = "TABLETTE", "Tablette"
    ORDINATEUR = "ORDINATEUR", "Ordinateur"


def nouveau_qr_token():
    return secrets.token_urlsafe(24)


class Invite(models.Model):
    evenement = models.ForeignKey(Evenement, on_delete=models.CASCADE, related_name="invites")
    statut = models.ForeignKey(Statut, on_delete=models.PROTECT, default=statut_inscrit_id, related_name="+")
    civilite = models.CharField(max_length=3, choices=Civilite.choices)
    nom = models.CharField(max_length=80)
    prenom = models.CharField(max_length=80)
    email = models.EmailField()
    telephone = models.CharField(max_length=20)
    entreprise = models.CharField(max_length=120, blank=True)
    fonction = models.CharField(max_length=120, blank=True)
    source = models.CharField(max_length=12, choices=Source.choices, default=Source.FORMULAIRE)
    code = models.CharField(max_length=4)
    qr_token = models.CharField(max_length=40, unique=True, default=nouveau_qr_token)
    consentement_donnees = models.BooleanField(default=False)
    consentement_le = models.DateTimeField(null=True, blank=True)
    inscrit_le = models.DateTimeField(default=timezone.now)
    present_le = models.DateTimeField(null=True, blank=True)
    mode_emargement = models.CharField(max_length=12, choices=ModeEmargement.choices, null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["evenement", "email"], name="invite_unique_email"),
            models.UniqueConstraint(fields=["evenement", "code"], name="invite_unique_code"),
        ]
        indexes = [
            models.Index(fields=["evenement", "statut"]),
            models.Index(fields=["evenement", "present_le"]),
            models.Index(fields=["evenement", "nom"]),
            models.Index(fields=["evenement", "inscrit_le"]),  # tri par défaut et courbes d'inscription
        ]
        ordering = ["-inscrit_le"]

    def __str__(self):
        return f"Invité #{self.pk}"

    @property
    def civilite_affichee(self):
        return Civilite(self.civilite).label

    @property
    def nom_complet(self):
        return f"{self.civilite_affichee} {self.prenom} {self.nom.upper()}"

    @property
    def est_present(self):
        return self.statut.code == statuts.PRESENT


class Emargement(models.Model):
    invite = models.ForeignKey(Invite, on_delete=models.CASCADE, related_name="emargements")
    # compte supprimé : l'émargement reste dans l'historique (« Compte supprimé »)
    admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    mode = models.CharField(max_length=12, choices=ModeEmargement.choices)
    poste = models.CharField(max_length=60, blank=True)
    appareil = models.CharField(max_length=12, choices=Appareil.choices, default=Appareil.TELEPHONE)
    date = models.DateTimeField(default=timezone.now)
    date_client = models.DateTimeField(null=True, blank=True)
    annule_le = models.DateTimeField(null=True, blank=True)
    annule_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    motif_annulation = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date"]
        indexes = [models.Index(fields=["invite", "annule_le"])]


class TypeEmail(models.TextChoices):
    INVITATION = "INVITATION", "Invitation"
    MAGAZINE = "MAGAZINE", "Magazine"


class StatutEmail(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente"
    ENVOYE = "ENVOYE", "Envoyé"
    ECHEC = "ECHEC", "Échec"


class EmailEnvoye(models.Model):
    invite = models.ForeignKey(Invite, on_delete=models.CASCADE, related_name="emails")
    type = models.CharField(max_length=12, choices=TypeEmail.choices)
    statut = models.CharField(max_length=12, choices=StatutEmail.choices, default=StatutEmail.EN_ATTENTE)
    tentatives = models.PositiveSmallIntegerField(default=0)
    envoye_le = models.DateTimeField(null=True, blank=True)
    erreur = models.TextField(blank=True)
    cree_le = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-cree_le"]
        indexes = [
            models.Index(fields=["invite", "type", "statut"]),
            models.Index(fields=["statut", "tentatives", "cree_le"]),  # relance des emails restés en attente
        ]


class JournalActivite(models.Model):
    """Journal d'activité. `details` ne contient jamais de donnée personnelle : les libellés
    (noms d'invités) sont reconstitués à l'affichage à partir de la cible."""

    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    action = models.CharField(max_length=40, db_index=True)
    cible_type = models.CharField(max_length=30, blank=True)
    cible_id = models.BigIntegerField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    date = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-date"]
        indexes = [models.Index(fields=["cible_type", "cible_id"])]


CORPS_EMAIL_1 = (
    "Bonjour {civilite} {prenom} {nom},\n\n"
    "Votre inscription à la Graduation {programme} {annee} est confirmée. Le jour de la cérémonie, "
    "présentez ce QR code à l’accueil : il sera lu automatiquement.\n\n"
    "{qr_code}\n\n"
    "À très bientôt,\nMDE Business School"
)
CORPS_EMAIL_2 = (
    "Bonjour {civilite} {prenom} {nom},\n\n"
    "Votre présence est enregistrée. Nous sommes heureux de vous accueillir ce soir. "
    "Retrouvez dès maintenant le magazine du programme {programme}.\n\n"
    "{lien_magazine}"
)


class Parametres(models.Model):
    objet_email_1 = models.CharField(max_length=200, default="Votre invitation · Graduation {programme} {annee}")
    corps_email_1 = models.TextField(default=CORPS_EMAIL_1)
    objet_email_2 = models.CharField(
        max_length=200, default="Bienvenue · Le magazine de la Graduation {programme} {annee}"
    )
    corps_email_2 = models.TextField(default=CORPS_EMAIL_2)
    duree_resultat_scan = models.PositiveSmallIntegerField(choices=[(2, "2 s"), (3, "3 s"), (5, "5 s")], default=3)
    son_actif = models.BooleanField(default=True)
    vibration_actif = models.BooleanField(default=True)
    expediteur = models.CharField(max_length=120, default="Flex’Checking · MDE Business School")
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "paramètres"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def charger(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class SourceErreur(models.TextChoices):
    NAVIGATEUR = "NAVIGATEUR", "Navigateur"
    SERVEUR = "SERVEUR", "Serveur"
    TACHE = "TACHE", "Tâche d’arrière-plan"
    EMAIL = "EMAIL", "Envoi d’email"


class ErreurTechnique(models.Model):
    """Erreur technique, regroupée par signature (même source, type, message et lieu).

    Visible du seul super admin ; les interfaces n'affichent qu'un message simple. Les emails et
    numéros de téléphone sont masqués à l'enregistrement, les URL sont conservées sans paramètres.
    """

    source = models.CharField(max_length=12, choices=SourceErreur.choices, db_index=True)
    signature = models.CharField(max_length=64, unique=True)
    type = models.CharField(max_length=120)
    message = models.TextField()
    lieu = models.CharField(max_length=300, blank=True)
    details = models.TextField(blank=True)
    navigateur = models.CharField(max_length=300, blank=True)
    occurrences = models.PositiveIntegerField(default=1)
    premiere = models.DateTimeField(default=timezone.now)
    derniere = models.DateTimeField(default=timezone.now, db_index=True)
    resolue = models.BooleanField(default=False, db_index=True)
    resolue_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-derniere"]
        verbose_name = "erreur technique"
        verbose_name_plural = "erreurs techniques"
