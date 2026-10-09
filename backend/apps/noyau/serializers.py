from django.conf import settings
from django.db.models import Count, OuterRef, Q, Subquery
from rest_framework import serializers

from apps.comptes.models import Admin, Role

from . import statuts
from .models import (
    Appareil,
    Civilite,
    EmailEnvoye,
    Evenement,
    Invite,
    JournalActivite,
    ModeEmargement,
    Parametres,
    Programme,
    TypeEmail,
)
from .services import etat_inscriptions, statut_evenement
from .theme import deriver_tokens
from .validation import valider_couleur, valider_email, valider_nom, valider_telephone


def tokens_programme(programme):
    t = deriver_tokens(programme.couleur_principale, programme.couleur_secondaire)
    return {
        "p": t["primary"],
        "s": t["secondary"],
        "ph": t["primary_hover"],
        "ps": t["primary_soft"],
        "ss": t["secondary_soft"],
        "op": t["on_primary"],
        "os": t["on_secondary"],
        "hd": t["header"],
    }


# ---------------------------------------------------------------- Programmes
class ProgrammeSerializer(serializers.ModelSerializer):
    tokens = serializers.SerializerMethodField()
    nb_evenements = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Programme
        fields = [
            "id",
            "nom",
            "couleur_principale",
            "couleur_secondaire",
            "actif",
            "magazine_actif",
            "lien_magazine",
            "tokens",
            "nb_evenements",
            "cree_le",
            "modifie_le",
        ]
        read_only_fields = ["cree_le", "modifie_le"]

    def get_tokens(self, obj):
        return tokens_programme(obj)

    def validate_couleur_principale(self, v):
        return valider_couleur(v)

    def validate_couleur_secondaire(self, v):
        return valider_couleur(v)

    def validate_nom(self, v):
        v = v.strip()
        if len(v) < 2:
            raise serializers.ValidationError("Indiquez le nom du programme.")
        return v

    def validate(self, attrs):
        actif = attrs.get("magazine_actif", getattr(self.instance, "magazine_actif", False))
        lien = attrs.get("lien_magazine", getattr(self.instance, "lien_magazine", ""))
        if actif and not lien:
            raise serializers.ValidationError(
                {"lien_magazine": "Indiquez le lien du magazine pour activer l’email n°2."}
            )
        return attrs


# ---------------------------------------------------------------- Événements
class AdminCourtSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admin
        fields = ["id", "nom", "email", "initiales"]


def evenements_annotes(qs):
    return (
        qs.select_related("programme")
        .prefetch_related("admins")
        .annotate(
            nb_inscrits=Count("invites", distinct=True),
            nb_presents=Count("invites", filter=Q(invites__statut__code=statuts.PRESENT), distinct=True),
        )
    )


class EvenementSerializer(serializers.ModelSerializer):
    nom_affiche = serializers.CharField(read_only=True)
    annee = serializers.IntegerField(read_only=True)
    programme_nom = serializers.CharField(source="programme.nom", read_only=True)
    tokens = serializers.SerializerMethodField()
    lien_inscription = serializers.SerializerMethodField()
    admins = serializers.PrimaryKeyRelatedField(many=True, queryset=Admin.objects.all(), required=False)
    admins_details = AdminCourtSerializer(source="admins", many=True, read_only=True)
    nb_inscrits = serializers.IntegerField(read_only=True, default=0)
    nb_presents = serializers.IntegerField(read_only=True, default=0)
    statut = serializers.SerializerMethodField()
    etat_inscriptions = serializers.SerializerMethodField()

    class Meta:
        model = Evenement
        fields = [
            "id",
            "programme",
            "programme_nom",
            "nom_affiche",
            "annee",
            "tokens",
            "date",
            "heure_debut",
            "heure_accueil",
            "lieu",
            "lien_carte",
            "capacite",
            "date_limite_inscription",
            "inscriptions_ouvertes",
            "slug_inscription",
            "lien_inscription",
            "admins",
            "admins_details",
            "nb_inscrits",
            "nb_presents",
            "statut",
            "etat_inscriptions",
            "cree_le",
            "modifie_le",
        ]
        read_only_fields = ["slug_inscription", "cree_le", "modifie_le"]

    def get_tokens(self, obj):
        return tokens_programme(obj.programme)

    def get_lien_inscription(self, obj):
        return f"{settings.APP_PUBLIC_URL}/i/{obj.slug_inscription}"

    def get_statut(self, obj):
        return statut_evenement(obj, getattr(obj, "nb_inscrits", None))

    def get_etat_inscriptions(self, obj):
        return etat_inscriptions(obj, getattr(obj, "nb_inscrits", None))

    def validate_programme(self, programme):
        changement = self.instance is None or self.instance.programme_id != programme.pk
        if changement and not programme.actif:
            raise serializers.ValidationError("Ce programme est désactivé.")
        return programme

    def validate_admins(self, admins):
        if any(a.role != Role.ADMIN and a.role != Role.SUPER_ADMIN for a in admins):
            raise serializers.ValidationError("Compte invalide.")
        return admins

    def validate(self, attrs):
        date = attrs.get("date", getattr(self.instance, "date", None))
        limite = attrs.get("date_limite_inscription", getattr(self.instance, "date_limite_inscription", None))
        accueil = attrs.get("heure_accueil", getattr(self.instance, "heure_accueil", None))
        debut = attrs.get("heure_debut", getattr(self.instance, "heure_debut", None))
        if date and limite and limite > date:
            raise serializers.ValidationError({"date_limite_inscription": "La date limite doit précéder l’événement."})
        if accueil and debut and accueil > debut:
            raise serializers.ValidationError({"heure_accueil": "L’accueil doit commencer avant la cérémonie."})
        return attrs


# ---------------------------------------------------------------- Invités
def invites_annotes(qs):
    dernier = EmailEnvoye.objects.filter(invite=OuterRef("pk")).order_by("-cree_le", "-pk")
    return qs.select_related("statut", "evenement__programme").annotate(
        email1=Subquery(dernier.filter(type=TypeEmail.INVITATION).values("statut")[:1]),
        email2=Subquery(dernier.filter(type=TypeEmail.MAGAZINE).values("statut")[:1]),
    )


class InviteSerializer(serializers.ModelSerializer):
    civilite_affichee = serializers.CharField(read_only=True)
    nom_complet = serializers.CharField(read_only=True)
    statut = serializers.CharField(source="statut.code", read_only=True)
    statut_libelle = serializers.CharField(source="statut.libelle", read_only=True)
    email1 = serializers.CharField(read_only=True, allow_null=True, default=None)
    email2 = serializers.CharField(read_only=True, allow_null=True, default=None)
    evenement_nom = serializers.CharField(source="evenement.nom_affiche", read_only=True)
    programme_nom = serializers.CharField(source="evenement.programme.nom", read_only=True)

    class Meta:
        model = Invite
        fields = [
            "id",
            "evenement",
            "evenement_nom",
            "programme_nom",
            "civilite",
            "civilite_affichee",
            "nom",
            "prenom",
            "nom_complet",
            "email",
            "telephone",
            "entreprise",
            "fonction",
            "source",
            "code",
            "statut",
            "statut_libelle",
            "inscrit_le",
            "present_le",
            "mode_emargement",
            "email1",
            "email2",
        ]
        read_only_fields = fields


class InviteEcritureSerializer(serializers.Serializer):
    civilite = serializers.ChoiceField(
        choices=Civilite.choices,
        error_messages={"invalid_choice": "Choisissez une civilité.", "required": "Choisissez une civilité."},
    )
    nom = serializers.CharField(max_length=80)
    prenom = serializers.CharField(max_length=80)
    email = serializers.CharField(max_length=254)
    telephone = serializers.CharField(max_length=30)
    entreprise = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    fonction = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")

    def validate_nom(self, v):
        return valider_nom(v, "nom")

    def validate_prenom(self, v):
        return valider_nom(v, "prénom")

    def validate_email(self, v):
        return valider_email(v)

    def validate_telephone(self, v):
        return valider_telephone(v)


class InscriptionSerializer(InviteEcritureSerializer):
    consentement_donnees = serializers.BooleanField(default=False)


class AjoutInviteSerializer(InviteEcritureSerializer):
    envoyer_invitation = serializers.BooleanField(default=True)


class ModificationInviteSerializer(InviteEcritureSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for champ in self.fields.values():
            champ.required = False


# ---------------------------------------------------------------- Émargement
class EmargementRequeteSerializer(serializers.Serializer):
    qr_token = serializers.CharField(required=False, allow_blank=True, max_length=200)
    code = serializers.RegexField(
        r"^\d{4}$", required=False, allow_blank=True, error_messages={"invalid": "Code à 4 chiffres attendu."}
    )
    invite_id = serializers.IntegerField(required=False, allow_null=True)
    mode = serializers.ChoiceField(choices=ModeEmargement.choices)
    poste = serializers.CharField(required=False, allow_blank=True, max_length=60, default="")
    appareil = serializers.ChoiceField(choices=Appareil.choices, default=Appareil.TELEPHONE)
    date_client = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        fournis = [k for k in ("qr_token", "code", "invite_id") if attrs.get(k)]
        if len(fournis) != 1:
            raise serializers.ValidationError("Fournir exactement un des champs qrToken, code ou inviteId.")
        return attrs


class InviteResultatSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(read_only=True)
    civilite_affichee = serializers.CharField(read_only=True)

    class Meta:
        model = Invite
        fields = [
            "id",
            "civilite",
            "civilite_affichee",
            "prenom",
            "nom",
            "nom_complet",
            "entreprise",
            "mode_emargement",
        ]


class EmargementResultatSerializer(serializers.Serializer):
    resultat = serializers.ChoiceField(choices=["PRESENT", "DEJA_EMARGE", "CODE_INVALIDE", "AUTRE_EVENEMENT"])
    invite = InviteResultatSerializer(allow_null=True)
    present_le = serializers.DateTimeField(allow_null=True)
    poste = serializers.CharField(allow_blank=True)
    mode = serializers.CharField(allow_null=True)
    evenement_autre = serializers.CharField(allow_null=True)
    magazine_envoye = serializers.BooleanField()
    emargement_id = serializers.IntegerField(allow_null=True)
    presents = serializers.IntegerField()
    inscrits = serializers.IntegerField()


# ---------------------------------------------------------------- Comptes admins
class AdminSerializer(serializers.ModelSerializer):
    evenements = serializers.PrimaryKeyRelatedField(many=True, queryset=Evenement.objects.all(), required=False)
    initiales = serializers.CharField(read_only=True)

    class Meta:
        model = Admin
        fields = [
            "id",
            "nom",
            "email",
            "role",
            "actif",
            "derniere_connexion",
            "doit_changer_mot_de_passe",
            "initiales",
            "evenements",
            "cree_le",
        ]
        read_only_fields = ["derniere_connexion", "doit_changer_mot_de_passe", "cree_le"]

    def validate_email(self, v):
        v = valider_email(v)
        qs = Admin.objects.filter(email=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse.")
        return v

    def validate_nom(self, v):
        return valider_nom(v, "nom")


# ---------------------------------------------------------------- Paramètres
class ParametresSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parametres
        fields = [
            "objet_email_1",
            "corps_email_1",
            "objet_email_2",
            "corps_email_2",
            "duree_resultat_scan",
            "son_actif",
            "vibration_actif",
            "expediteur",
            "modifie_le",
        ]
        read_only_fields = ["expediteur", "modifie_le"]


class ParametresScanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parametres
        fields = ["duree_resultat_scan", "son_actif", "vibration_actif"]


class ApercuEmailSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=TypeEmail.choices)
    objet = serializers.CharField(required=False, allow_blank=True)
    corps = serializers.CharField(required=False, allow_blank=True)
    programme = serializers.PrimaryKeyRelatedField(queryset=Programme.objects.all(), required=False)


# ---------------------------------------------------------------- Journal
class JournalSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()
    categorie = serializers.SerializerMethodField()
    detail = serializers.SerializerMethodField()

    class Meta:
        model = JournalActivite
        fields = ["id", "date", "auteur", "auteur_nom", "action", "categorie", "detail"]

    def get_auteur_nom(self, obj):
        return obj.auteur.nom if obj.auteur else "Système"

    def get_categorie(self, obj):
        from .journal import CATEGORIES

        return CATEGORIES.get(obj.action, "Autre")

    def get_detail(self, obj):
        from .journal_texte import decrire

        return decrire(obj, self.context.get("cibles", {}))
