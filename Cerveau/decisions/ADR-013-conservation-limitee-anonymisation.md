---
type: decision
statut: acceptée
verifie: 2026-10-26
commit: 44eceb5
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
