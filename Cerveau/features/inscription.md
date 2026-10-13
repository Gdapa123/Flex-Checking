---
type: feature
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/apps/noyau/vues_public.py, backend/apps/noyau/services.py, backend/apps/noyau/serializers.py, backend/apps/noyau/validation.py, frontend/src/features/invite/InscriptionPage.jsx, frontend/src/features/invite/Presentation.jsx, frontend/src/features/invite/ConfirmationPage.jsx, frontend/src/features/invite/EtatCarte.jsx, frontend/src/features/invite/PratiquePage.jsx, frontend/src/lib/schemas.js]
---

# Inscription des invités (espace public)

**Objectif** : permettre à un invité, sans compte, de s’inscrire depuis un lien partagé et de recevoir son invitation.
**Utilisateurs** : public, sur mobile d’abord. Thème : couleurs du programme.

## Parcours
1. `/i/<slug>` charge `GET /api/public/evenements/<slug>/` (mis en cache 30 s, invalidé à chaque changement).
   - 404 → `LienInvalide` (palette MDE, lien vers mde.ci).
   - `etat` ≠ `OUVERT` → `EtatCarte` : `FERME`, `DATE_LIMITE`, `COMPLET`.
2. **Présentation des étapes** (`Presentation.jsx`) : 2 ou 3 étapes (la 3ᵉ, « magazine », seulement si
   `magazineActif`), puis « Commencer mon inscription » → `?etape=formulaire` (entrée d’historique : le bouton
   retour du téléphone revient à la présentation).
3. **Formulaire** : civilité, nom, prénom, email, téléphone (+225), entreprise, fonction, consentement —
   **tous obligatoires**. Validation Zod au fil de l’eau, erreurs visibles après sortie du champ ou envoi ;
   « Champ obligatoire » pour un champ vide ; pastille « N informations à compléter ».
4. `POST /api/public/evenements/<slug>/inscription/` → 201 → `/i/<slug>/confirmation` (état passé par la
   navigation et `sessionStorage`).
5. **Confirmation** : badge « Inscrit·e », récapitulatif, carte « Votre invitation », infos pratiques (agenda,
   itinéraire), « Email non reçu ? renvoyez-le ».
6. `/i/<slug>/pratique` : page des boutons de l’email (agenda Google / Microsoft 365, Google Maps, copier l’adresse).

## Règles serveur (`services.inscrire`, `creer_invite`)
- Verrou `select_for_update` sur l’événement → la capacité est garantie même en concurrence.
- Ordre des refus : fermé → date limite dépassée → complet (`etat_inscriptions`).
- Consentement obligatoire (400 `CONSENTEMENT`).
- Email normalisé en minuscules ; code à 4 chiffres tiré par `secrets` parmi les codes libres ; jusqu’à 20
  essais en cas de collision ; `CODES_EPUISES` à 10 000.
- Email n°1 planifié après commit ([emails](emails.md)).
- **Adresse déjà inscrite** : même réponse 201 qu’un succès ; l’invitation est renvoyée à la vraie adresse,
  au plus 3 fois/heure ([ADR-005](../decisions/ADR-005-anti-enumeration-inscription.md)).
- Un **ancien lien** (après régénération) est lisible mais présenté comme `FERME` ; l’inscription n’accepte que
  le lien actuel.

## Validation (mêmes règles des deux côtés)
| Champ | Règle | Code |
|---|---|---|
| nom, prénom | 2 à 80 caractères | `valider_nom` / `champNom` |
| email | regex, ≤ 254, minuscules | `valider_email` / `champEmail` |
| téléphone | 10 chiffres (indicatif 225 retiré), stocké « +225 xx xx xx xx xx » | `valider_telephone` / `champTelephone` |
| entreprise, fonction | 2 à 120 caractères | `ChampsProfessionnelsObligatoires` / `schemaInviteComplet` |
| tous | refus des caractères de contrôle (sauts de ligne…) | `sans_controle` |

## Renvoi du QR
`POST /renvoi-qr/` : réponse **toujours identique** (202, « Si cette adresse est inscrite… »), limites
3/h par email et par lien, 30/h par IP.

## Erreurs gérées côté écran
409 avec code → carte d’état ; 400 → erreurs par champ ; 429 → « Trop de tentatives » ; 503 → « Service
momentanément saturé » ; 5xx → message neutre.

## Tests
`backend/apps/noyau/tests/test_inscription.py` (états, doublon, renvois limités, validation, unicité des codes,
.ics, champs obligatoires) ; `frontend/tests/schemas.test.js`, `confirmation.test.jsx`, `agenda.test.js` ;
e2e `parcours.spec.js`.

## Limites
- Écran I7 (« adresse déjà inscrite ») inaccessible : voir [R2](../project/risques-et-dette.md).
