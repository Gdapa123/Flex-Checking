from rest_framework.permissions import BasePermission

from .models import Role


class EstSuperAdmin(BasePermission):
    message = "Accès réservé au super admin."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.SUPER_ADMIN)


class EstAdmin(BasePermission):
    """Admin ou super admin. Le périmètre (événements affectés) est contrôlé par les querysets."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.actif)


def evenements_visibles(user):
    from apps.noyau.models import Evenement

    qs = Evenement.objects.select_related("programme")
    if user.role == Role.SUPER_ADMIN:
        return qs
    return qs.filter(admins=user)
