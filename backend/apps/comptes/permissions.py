from rest_framework.permissions import BasePermission

from .models import Role

MOT_DE_PASSE_A_CHANGER = "Changez d’abord votre mot de passe temporaire."
RESERVE_HOTE = "Action réservée à l’hôte : ouvrez l’espace hôte de la borne."


def borne_autorisee(view):
    """Vue accessible à une session « borne libre-service » : `autorise_borne = True`, ou ensemble d'actions
    autorisées pour un viewset (`{"list"}`)."""
    autorise = getattr(view, "autorise_borne", False)
    if isinstance(autorise, set | frozenset | tuple | list):
        return getattr(view, "action", None) in autorise
    return bool(autorise)


def _compte_utilisable(user):
    """Compte connecté, actif, et qui n'est plus sous mot de passe temporaire : tant que le mot de passe
    n'est pas changé, seuls `auth/moi/`, `auth/mot-de-passe/` et la déconnexion restent accessibles."""
    return bool(user and user.is_authenticated and user.actif and not user.doit_changer_mot_de_passe)


class CompteUtilisable(BasePermission):
    """Permission par défaut de toute l'API (DEFAULT_PERMISSION_CLASSES) : une vue qui n'en déclare pas
    d'autre exige un compte connecté, actif et sorti du mot de passe temporaire. Les seules exceptions
    (`auth/moi/`, `auth/mot-de-passe/`) déclarent explicitement `IsAuthenticated`."""

    def has_permission(self, request, view):
        if _compte_utilisable(request.user):
            from .authentication import est_borne

            if est_borne(request.auth) and not borne_autorisee(view):
                self.message = RESERVE_HOTE
                return False
            return True
        if request.user and request.user.is_authenticated and request.user.doit_changer_mot_de_passe:
            self.message = MOT_DE_PASSE_A_CHANGER
        return False


class EstSuperAdmin(CompteUtilisable):
    message = "Accès réservé au super admin."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == Role.SUPER_ADMIN


class EstAdmin(CompteUtilisable):
    """Admin ou super admin. Le périmètre (événements affectés) est contrôlé par les querysets."""


def evenements_visibles(user):
    from apps.noyau.models import Evenement

    qs = Evenement.objects.select_related("programme")
    if user.role == Role.SUPER_ADMIN:
        return qs
    return qs.filter(admins=user)
