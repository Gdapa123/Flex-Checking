from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.comptes import views as auth

from . import vues_admin, vues_invites, vues_public, vues_scan

routeur = SimpleRouter(trailing_slash=True)
routeur.register("programmes", vues_admin.ProgrammeViewSet, basename="programme")
routeur.register("evenements", vues_admin.EvenementViewSet, basename="evenement")
routeur.register("admins", vues_admin.AdminViewSet, basename="admin")

urlpatterns = [
    # Authentification
    path("auth/csrf/", auth.CsrfView.as_view()),
    path("auth/connexion/", auth.ConnexionView.as_view()),
    path("auth/deconnexion/", auth.DeconnexionView.as_view()),
    path("auth/rafraichir/", auth.RafraichirView.as_view()),
    path("auth/moi/", auth.MoiView.as_view()),
    path("auth/mot-de-passe/", auth.ChangerMotDePasseView.as_view()),
    # Public (invité)
    path("public/evenements/<slug:slug>/", vues_public.EvenementPublicView.as_view()),
    path("public/evenements/<slug:slug>/inscription/", vues_public.InscriptionView.as_view()),
    path("public/evenements/<slug:slug>/renvoi-qr/", vues_public.RenvoiQrView.as_view()),
    path("public/evenements/<slug:slug>/agenda.ics", vues_public.AgendaView.as_view()),
    # Scan
    path("evenements/<int:pk>/emargement/", vues_scan.EmargementView.as_view()),
    path("evenements/<int:pk>/emargements/recents/", vues_scan.RecentsView.as_view()),
    path("emargements/<int:pk>/annulation/", vues_scan.AnnulationView.as_view()),
    path("parametres/scan/", vues_scan.ParametresScanView.as_view()),
    # Invités
    path("evenements/<int:pk>/invites/", vues_invites.InvitesEvenementView.as_view()),
    path("evenements/<int:pk>/invites/actions-groupees/", vues_invites.ActionsGroupeesView.as_view()),
    path("evenements/<int:pk>/invites/export/", vues_invites.ExportEvenementView.as_view()),
    path("invites/", vues_invites.TousInvitesView.as_view()),
    path("invites/export/", vues_invites.ExportTousInvitesView.as_view()),
    path("invites/<int:pk>/", vues_invites.InviteDetailView.as_view()),
    path("invites/<int:pk>/qr.png", vues_invites.QrInviteView.as_view()),
    path("invites/<int:pk>/renvoi-email/", vues_invites.RenvoiEmailView.as_view()),
    path("invites/<int:pk>/historique/", vues_invites.HistoriqueView.as_view()),
    path("invites/<int:pk>/presence/", vues_invites.ValiderPresenceView.as_view()),
    path("invites/<int:pk>/presence/annulation/", vues_invites.AnnulerPresenceView.as_view()),
    path("taches/<str:tache_id>/", vues_invites.TacheView.as_view()),
    path("taches/<str:tache_id>/fichier/", vues_invites.TacheFichierView.as_view()),
    # Super admin
    path("parametres/", vues_admin.ParametresView.as_view()),
    path("parametres/apercu-email/", vues_admin.ApercuEmailView.as_view()),
    path("journal/", vues_admin.JournalView.as_view()),
    path("comptes/", vues_admin.ComptesResumeView.as_view()),
    path("exports/<str:type_export>/", vues_admin.ExportGlobalView.as_view()),
    path("evenements/<int:pk>/qr-inscription.png", vues_admin.EvenementViewSet.as_view({"get": "qr_inscription"})),
    path("", include(routeur.urls)),
]
