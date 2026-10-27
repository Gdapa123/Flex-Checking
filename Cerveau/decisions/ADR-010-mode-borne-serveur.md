---
type: decision
statut: acceptée
verifie: 2026-10-27
commit: bed9942
sources: [backend/apps/comptes/authentication.py, backend/apps/comptes/permissions.py, backend/apps/comptes/views.py, backend/apps/noyau/urls.py, backend/apps/noyau/vues_scan.py, backend/apps/noyau/vues_admin.py, frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/ScanSetup.jsx, frontend/src/features/scan/fileHorsLigne.js, frontend/src/features/auth/RequireRole.jsx, backend/apps/noyau/tests/test_audit_securite.py, backend/apps/noyau/tests/test_durcissement.py]
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
- Durcissements du 2026-10-14 (audit) :
  - « C’est moi » : l'émargement par `inviteId` en session borne exige le **jeton signé `choix`** rendu par la
    recherche réduite pour ce nom (5 min, lié au compte, à la cérémonie et à l'invité) ; sinon 403
    `CHOIX_BORNE_INVALIDE`. Plus de boucle `inviteId=1..N`. Limite dédiée : 12 émargements manuels/min.
  - Liste des cérémonies en session borne : `EvenementBorneSerializer` (ni hôtes ni lien d'inscription).
  - Frontend : disposition figée au démarrage (et imposée par `moi.borne`) ; restriction retentée toutes les 15 s et
    au retour du réseau, badge « Session non restreinte » au-delà de 5 s ; espace hôte refermé après 90 s sans
    interaction.
- Mise en œuvre vérifiée au commit `be899ff` (pas de changement de décision) : `authentication.emettre_jetons(…,
  borne=True)` / `est_borne` (claim conservé au rafraîchissement) ; `permissions.borne_autorisee` (attribut
  `autorise_borne`, booléen ou ensemble d’actions, ex. `{"list"}` pour la liste des cérémonies) ; vues autorisées :
  émargement, derniers passages (`RecentsView`, compteurs seulement), réglages du scan (`ParametresScanView`),
  recherche réduite, liste des cérémonies, `auth/borne/`, `auth/verifier-mot-de-passe/` ; `auth/moi/`
  (`IsAuthenticated`, renvoie `borne`) et la déconnexion (`AllowAny`) restent accessibles. Tests : `test_audit_securite.py` (recherche réduite, jeton `choix`, liste réduite
  des cérémonies).
- Compléments du 2026-10-22 (commits `d91d426` et `7e0e071`, sans changement de décision) :
  - « C’est moi » hors ligne : la file ne se bloque plus (`fileHorsLigne.rejouer` retire un 403
    `CHOIX_BORNE_INVALIDE`, R13 résolu) et le jeton `choix` porte son heure d’émission : il est jugé à l’heure du
    **passage** (`dateClient`, plafonnée à l’heure serveur ; de 1 min avant à 5 min après l’émission), sa signature
    restant lisible 12 h (`vues_scan.choix_borne_valide`, `DELAI_REJEU_CHOIX_S`). Un passage touché hors ligne et
    synchronisé plus tard est donc accepté. Test : `test_durcissement.py::test_c_est_moi_touche_hors_ligne_puis_synchronise`.
  - Codes invalides en session borne plafonnés à 10 par 10 min (`MAX_CODES_INVALIDES_BORNE`, 30 sinon) ; le risque
    résiduel de codes devinables reste ouvert (R19 de [risques-et-dette](../project/risques-et-dette.md)) ; le
    blocage de la borne après 10 codes faux a été écarté (déni de service possible).
- Mise en œuvre revérifiée au commit `44eceb5` (voir aussi [hors-ligne](../features/hors-ligne.md)).
