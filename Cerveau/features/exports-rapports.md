---
type: feature
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/apps/noyau/exports.py, backend/apps/noyau/vues_invites.py, backend/apps/noyau/vues_admin.py, backend/apps/noyau/taches.py, backend/apps/noyau/rapports.py, backend/apps/noyau/analytique.py, frontend/src/lib/telechargement.js]
---

# Exports, rapports et analyses

## Exports tableur
| Export | Route | Droits | Colonnes |
|---|---|---|---|
| Invités d’une cérémonie (vue filtrée) | `GET /evenements/<id>/invites/export/?format=` | admin | événement, civilité, prénom, NOM, email, téléphone, entreprise, fonction, statut, code, source, inscrit le, présent le, mode, email 1, email 2 |
| Sélection | `POST /evenements/<id>/invites/actions-groupees/` `{action: EXPORTER, ids}` | admin | idem |
| Tous les invités | `GET /invites/export/` ou `/exports/invites/` | super admin | idem |
| Présences | `/exports/presences/` | super admin | heure, mode, poste, appareil, « émargé par » |
| Suivi des emails | `/exports/emails/` | super admin | type, statut, tentatives, envoyé le, erreur |
| Journal | `/exports/journal/` (filtres du journal, 20 000 lignes max) | super admin | date, utilisateur, type, détail |

- **CSV** : UTF-8 avec BOM, séparateur « ; » (Excel français). **XLSX** : en-tête sombre, colonnes ajustées,
  volets figés, filtre automatique.
- **Injection de formule neutralisée** : toute saisie commençant par `= + - @` tabulation ou retour chariot est
  préfixée d’une apostrophe (y compris le téléphone « +225 … »).
- > 50 lignes (invités/présences) : tâche Celery, fichier unique supprimé au téléchargement, purge 6 h ;
  sur Vercel le seuil est relevé (`EXPORT_SEUIL_ASYNCHRONE=1000000`).
- Chaque export est journalisé (format, nombre, type, cérémonie).

## Rapports PDF (ReportLab, `rapports.py`)
- Cérémonie : `GET /evenements/<id>/rapport/` (admin), à partir des statistiques du tableau de bord.
- Global : `GET /rapports/global/` (super admin), analytique + technique.
- 30 par heure et par compte ; `Cache-Control: no-store`.

## Analyses (super admin, `analytique.py`)
- `GET /analytique/` (cache 30 s) : totaux, lignes par cérémonie, par programme, par année et programme
  (**taux par année : cérémonies terminées seulement**, une cérémonie à venir ou en cours ferait chuter la courbe),
  inscriptions par jour sur 60 jours, modes, 8 entreprises les plus représentées.
- `GET /analytique/technique/` : santé (latence base, Redis, longueur de la file Celery), requêtes par minute
  sur 1 h (métriques `mesures.py` dans Redis, 2 h de rétention), erreurs par jour et par source sur 14 jours,
  emails sur 24 h, scans sur 1 h.

## Tests
`test_invites.py` (CSV/XLSX, async, formules, purge), `test_super_admin.py` (exports globaux),
`test_analytique.py` (rapports et droits, analyses, limite des rapports), `test_securite.py`.
