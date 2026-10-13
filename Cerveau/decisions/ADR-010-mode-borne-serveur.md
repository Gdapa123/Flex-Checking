---
type: decision
statut: acceptée
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/apps/comptes/authentication.py, backend/apps/comptes/permissions.py, backend/apps/comptes/views.py, backend/apps/noyau/vues_scan.py, frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/ScanSetup.jsx, frontend/src/features/auth/RequireRole.jsx]
---

# ADR-010 — Borne libre-service : session restreinte côté serveur

- **Date** : 2026-10-13 (audit de sécurité, demande « corrige les failles de sécurité »)
- **Statut** : acceptée — complète [ADR-008](ADR-008-borne-recherche-restreinte.md)

## Contexte
La tablette borne est laissée au public avec la session complète de l'hôte (compte ADMIN). Le verrou « Espace hôte »
n'existait que dans l'interface : en tapant `/admin` ou `/api/evenements/<id>/invites/`, un visiteur obtenait la liste
nominative des invités (emails, téléphones, codes) et les actions admin. La recherche « 3 lettres » n'était contrôlée
que dans le navigateur.

## Options
1. Verrou d'interface seulement (mot de passe pour ouvrir les réglages) — contournable par l'adresse.
2. Compte dédié « borne » à droits réduits — nouveau rôle, contraire au cahier des charges (rôles SUPER_ADMIN et ADMIN).
3. **Session restreinte** : claim `borne` dans les jetons, liste blanche de vues côté serveur, élévation par le mot de
   passe de l'hôte.

## Décision
Option 3. `POST auth/borne/` au démarrage d'une disposition « Borne » ; `CompteUtilisable` refuse toute vue sans
`autorise_borne` ; recherche dédiée réduite ; `auth/verifier-mot-de-passe/` rend une session complète, refermer les
réglages la restreint de nouveau ; le frontend renvoie toute route hors `/scan` vers le scan ; bouton retour bloqué.

## Conséquences
- ➕ même avec l'adresse, le public n'atteint ni les données des invités ni l'espace admin.
- ➖ hors ligne, le passage en mode borne n'a pas lieu (le verrou d'interface reste actif) ; le public peut toujours
  émarger un autre invité via « C’est moi » (inhérent au libre-service).
