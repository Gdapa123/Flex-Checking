---
type: feature
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [frontend/src/features/super/, backend/apps/noyau/vues_admin.py, backend/apps/noyau/serializers.py]
---

# Espace super admin (configuration globale)

Univers MDE fixe. Navigation (`SuperApp.jsx`) : Vue globale, Analyses, Programmes, Cérémonies, Invités, Comptes
admins, Paramètres, Exports et journal, Erreurs (pastille du nombre à traiter) ; liens vers les espaces Admin et Scan.

| Écran | Route | Contenu |
|---|---|---|
| SA2 Vue globale | `/super` | cérémonies à venir, inscrits cumulés, présents du jour, comptes (mots de passe temporaires) ; tableau de toutes les cérémonies, actions en boutons icônes (tableau de bord, configurer) |
| Analyses | `/super/analyses` | activité toutes cérémonies (par programme, année, mode, entreprise, inscriptions/jour) et onglet technique (trafic, erreurs, santé, emails 24 h) ; rapport PDF global — [exports-rapports](exports-rapports.md) |
| SA3/SA4 Programmes | `/super/programmes/:id?` | nom, couleurs (sélecteur + hexa), tokens dérivés, **contrôles de contraste WCAG**, aperçu en direct (formulaire, cadre de visée, email), lien magazine + activation email n°2, désactivation, suppression |
| SA5 Cérémonies | `/super/evenements/:id?` (`nouveau`) | programme actif, dates et heures, capacité, lieu, lien carte, inscriptions ouvertes, admins affectés, lien et QR d’inscription (PNG), **régénération du lien**, suppression ; garde « Quitter sans enregistrer ? » |
| SA9 Invités | `/super/invites` | [gestion-invites](gestion-invites.md) en univers MDE |
| SA6 Comptes | `/super/admins` | création (mot de passe temporaire affiché une fois — [ADR-003](../decisions/ADR-003-comptes-mot-de-passe-temporaire.md)), modification, réinitialisation, désactivation, suppression, matrice d’affectation aux cérémonies à venir ; actions de ligne en boutons icônes avec libellé accessible et info-bulle |
| SA7 Paramètres | `/super/parametres` | modèles des emails n°1/n°2 (variables insérables, aperçu HTML serveur différé 400 ms), durée d’affichage du scan, son, vibration |
| SA8 Exports et journal | `/super/journal` | 4 exports (invités, présences, emails, journal) en CSV/Excel avec périmètre programme/cérémonie ; journal filtrable par type, auteur (dont « Système »), période ; 50 par page |
| Erreurs | `/super/erreurs` | [erreurs-techniques](erreurs-techniques.md) |

## Garde-fous serveur
- Programme désactivé : impossible de l’affecter à une **nouvelle** cérémonie ou de changer vers lui.
- Magazine activé sans lien → 400.
- Son propre compte : ni désactivation, ni changement de rôle, ni suppression. Dernier super admin protégé.
- Suppressions en cascade : nom à retaper (`?confirmation=`) si l’objet contient des données.
- Lecture des programmes et cérémonies ouverte aux admins (listes), écriture réservée au super admin.

## Tests
`test_super_admin.py`, `test_suppressions.py`, `test_analytique.py`.
