from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super admin"
    ADMIN = "ADMIN", "Admin"


class AdminManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, nom, password=None, role=Role.ADMIN, **extra):
        if not email:
            raise ValueError("L'email est obligatoire.")
        admin = self.model(email=self.normalize_email(email).lower(), nom=nom, role=role, **extra)
        admin.set_password(password)
        admin.save(using=self._db)
        return admin

    def create_superuser(self, email, nom, password=None, **extra):
        return self.create_user(email, nom, password, role=Role.SUPER_ADMIN, **extra)


class Admin(AbstractBaseUser):
    """Compte d'administration (super admin ou admin). Aucun compte côté invité."""

    nom = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ADMIN)
    actif = models.BooleanField(default=True)
    derniere_connexion = models.DateTimeField(null=True, blank=True)
    doit_changer_mot_de_passe = models.BooleanField(default=False)
    # Incrémentée à chaque changement ou réinitialisation du mot de passe : les jetons émis avant
    # (autres appareils, session volée) sont refusés. Une mise à niveau silencieuse du hachage du mot
    # de passe par Django ne la modifie pas, et un jeton sans version (émis avant cette règle) vaut 0.
    version_session = models.PositiveIntegerField(default=0)
    cree_le = models.DateTimeField(auto_now_add=True)

    # AbstractBaseUser fournit `password` (hachage Argon2) et `last_login`, inutilisé ici.
    last_login = None

    objects = AdminManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["nom"]

    class Meta:
        ordering = ["nom"]
        verbose_name = "admin"

    def __str__(self):
        return self.nom

    @property
    def is_active(self):
        return self.actif

    @property
    def est_super_admin(self):
        return self.role == Role.SUPER_ADMIN

    @property
    def initiales(self):
        return "".join(p[0] for p in self.nom.split()[:2]).upper()
