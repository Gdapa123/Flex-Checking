---
type: decision
statut: acceptée
verifie: 2026-11-10
commit: 93646d7
sources: [backend/apps/noyau/donnees_personnelles.py, frontend/src/features/invite/ConfidentialitePage.jsx, frontend/src/features/super/Parametres.jsx, backend/apps/noyau/models.py, backend/apps/noyau/tasks.py, backend/apps/noyau/vues_sondage.py]
---

# ADR-013 — Données personnelles : conservation limitée par anonymisation automatique

- **Date** : 2026-10-22 (demande : « un dispositif de sécurité pour la protection des données à caractère personnel »)
- **Statut** : acceptée

## Contexte
Application ouverte au public ; données des invités conservées sans limite ; la case de consentement mentionnait une
politique de confidentialité inexistante. Loi ivoirienne n° 2013-450 : finalité, durée de conservation limitée,
information et droits des personnes.

## Décisions
1. **Anonymiser plutôt que supprimer** les invités des cérémonies anciennes : les bilans (inscrits, présents,
   modes, avis) restent exacts, plus rien ne permet d'identifier une personne.
2. **Durée réglable** par le super admin (1 à 60 mois, 12 par défaut), comptée depuis la date de la cérémonie.
3. **Passe quotidienne** (Celery Beat 3 h 30 ; cron quotidien sur l'environnement sans Beat), idempotente et
   journalisée.
4. **Politique de confidentialité publique** (`/confidentialite`) reliée au consentement et au pied de chaque email,
   avec le contact et la durée réglés ; alignée sur le fonctionnement réel (prestataires techniques et transferts,
   retrait du consentement, avis anonymes conservés) le 2026-10-22 (`7e0e071`).
5. **Critère « invités encore identifiables »** plutôt que « cérémonie déjà traitée » (`7e0e071`) : un invité ajouté
   ou corrigé après une passe est anonymisé à la suivante ; date du consentement et motifs d'annulation sont aussi
   effacés.

## Conséquences
- Opération irréversible : un réglage trop court efface l'identité des invités des cérémonies concernées dès la nuit
  suivante (le changement de durée est journalisé ; l'interface demande une confirmation avant de la raccourcir).
- Les anciennes sauvegardes contiennent encore les données : à chiffrer et à faire tourner (guide de déploiement).
- Voir [donnees-personnelles](../features/donnees-personnelles.md).

## Vérification (2026-11-10, `93646d7`)
- Décisions 1, 2, 3 et 5 toujours appliquées : `donnees_personnelles.py`, `tasks.py` et `vues_sondage.py` sont
  inchangés depuis `f55527e` (durée lue dans `Parametres.duree_conservation_mois`, `anonymiser_donnees_expirees`) ;
  `Parametres.jsx` garde la durée (1 à 60 mois) et la confirmation avant de la raccourcir.
- 🟡 **Décision 4 en partie seulement** depuis `230cf6d` (texte fourni par MDE le 2026-11-10) : `ConfidentialitePage.jsx`
  n'interroge plus `GET public/confidentialite/` et n'affiche plus **ni la durée de conservation ni l'adresse de
  contact** ; il ne mentionne plus le retrait du consentement ni l'ARTCI, et ajoute une finalité (informer des
  prochains événements et actualités de MDE, refus possible à tout moment). La page reste reliée au consentement et
  au pied des emails (`emails/base.html`, « Vos données personnelles »). L'anonymisation automatique continue.
- Écarts constatés, à confirmer avec MDE : `ConfidentialiteView` renvoie encore `contact` et
  `dureeConservationMois` sans être lue par le frontend ; dans `Parametres.jsx`, le texte « Ces informations figurent
  sur la politique de confidentialité » et l'aide du champ « Contact données personnelles » ne correspondent plus à
  la page publique (le contact réglé n'est affiché nulle part).
