---
type: feature
statut: implémenté
verifie: 2026-10-26
commit: 2523cbb
sources: [backend/apps/noyau/vues_public.py, backend/apps/noyau/services.py, backend/apps/noyau/serializers.py, backend/apps/noyau/validation.py, backend/apps/noyau/models.py, backend/apps/comptes/throttles.py, backend/config/settings.py, frontend/src/features/invite/LienInvalide.jsx, frontend/src/features/invite/InscriptionPage.jsx, frontend/src/features/invite/ConfidentialitePage.jsx, frontend/src/features/invite/Presentation.jsx, frontend/src/features/invite/ConfirmationPage.jsx, frontend/src/features/invite/EtatCarte.jsx, frontend/src/features/invite/PratiquePage.jsx, frontend/src/lib/schemas.js, backend/apps/noyau/tests/test_inscription.py, backend/apps/noyau/tests/test_audit_securite.py, backend/apps/noyau/tests/test_dates_inscription.py, frontend/tests/schemas.test.js]
---

# Inscription des invités (espace public)

**Objectif** : permettre à un invité, sans compte, de s’inscrire depuis un lien partagé et de recevoir son invitation.
**Utilisateurs** : public, sur mobile d’abord. Thème : couleurs du programme.

## Parcours
1. `/i/<slug>` charge `GET /api/public/evenements/<slug>/` (mis en cache 30 s, invalidé à chaque changement).
   - 404 → `LienInvalide` (palette MDE, lien vers mde.ci ; titre et texte paramétrables depuis `bd4f807`, réutilisé
     par la page du sondage).
   - `etat` ≠ `OUVERT` → `EtatCarte` : `FERME`, `DATE_LIMITE`, `COMPLET`.
2. **Présentation des étapes** (`Presentation.jsx`) : 2 ou 3 étapes (la 3ᵉ, « magazine », seulement si
   `magazineActif`), puis « Commencer mon inscription » → `?etape=formulaire` (entrée d’historique : le bouton
   retour du téléphone revient à la présentation).
3. **Formulaire** : civilité, nom, prénom, email, téléphone (+225), entreprise, fonction, consentement —
   **tous obligatoires**. Chaque champ a son libellé visible et le reprend en placeholder ; le téléphone
   affiche en plus l’aide « 10 chiffres, par exemple 07 12 34 56 78 ». Validation Zod au fil de l’eau, erreurs visibles après sortie du champ ou envoi ;
   « Champ obligatoire » pour un champ vide ; pastille « N informations à compléter ». La case de consentement
   renvoie vers la [politique de confidentialité](donnees-personnelles.md) (`/confidentialite`, nouvel onglet) ;
   mention : « conformément à la loi ivoirienne n° 2013-450 sur la protection des données personnelles »
   (au lieu du RGPD depuis `7e0e071`).
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
  essais en cas de collision (puis 503 `CODE_INDISPONIBLE`) ; `CODES_EPUISES` à 10 000.
- Une inscription n’est jamais datée dans le futur : `Invite.save` refuse `inscrit_le` / `consentement_le`
  postérieurs à maintenant (marge d’une minute) ; migration `0008` (suppression des inscrits datés dans le futur).
- Email n°1 planifié après commit ([emails](emails.md)).
- **Adresse déjà inscrite** : même réponse 201 qu’un succès ; l’invitation est renvoyée à la vraie adresse,
  au plus 3 fois/heure ([ADR-005](../decisions/ADR-005-anti-enumeration-inscription.md)).
- Un **ancien lien** (après régénération) est lisible mais présenté comme `FERME` ; l’inscription n’accepte que
  le lien actuel (`evenement_public(slug, anciens=False)`).
- Limite de débit de l’inscription : `inscription` = 60/h par IP par défaut (variable `LIMITE_INSCRIPTION_IP`),
  classe `LimiteIpPartagee` (compteur partagé entre instances, IPv6 regroupée par préfixe /64).

## Validation (mêmes règles des deux côtés)
| Champ | Règle | Code |
|---|---|---|
| nom, prénom | 2 à 80 caractères | `valider_nom` / `champNom` |
| email | regex, ≤ 254, minuscules, **ASCII uniquement** (une variante accentuée serait confondue par la collation MySQL et contournerait les limites de renvoi) | `valider_email` / `champEmail` |
| téléphone | 10 chiffres (indicatif 225 retiré), stocké « +225 xx xx xx xx xx » | `valider_telephone` / `champTelephone` |
| entreprise, fonction | 2 à 120 caractères | `ChampsProfessionnelsObligatoires` / `schemaInviteComplet` |
| tous | refus des caractères de contrôle (sauts de ligne…) | `sans_controle` |

## Renvoi du QR
`POST /renvoi-qr/` : réponse **toujours identique** (202, « Si cette adresse est inscrite… »), limites
3/h par email **et par cérémonie** (clé hachée sur l’identifiant de l’événement : un lien régénéré ne multiplie
pas la limite), 30/h par IP (`LimiteIpPartagee`). Accepte aussi un ancien lien.

## Erreurs gérées côté écran
409 avec code → carte d’état ; 400 → erreurs par champ ; 429 → « Trop de tentatives » ; 503 → « Service
momentanément saturé » ; 5xx → message neutre.

## Tests
`backend/apps/noyau/tests/test_inscription.py` (états, doublon, renvois limités, validation, unicité des codes,
.ics, champs obligatoires) ; `test_audit_securite.py` (`test_inscription_et_renvoi_refusent_les_adresses_non_ascii`) ;
`test_dates_inscription.py` (pas de date future, migration 0008) ; `frontend/tests/schemas.test.js` (dont
adresses non ASCII), `confirmation.test.jsx`, `agenda.test.js` ; e2e `parcours.spec.js`.

## Limites
- Écran I7 (« adresse déjà inscrite ») inaccessible : voir [R2](../project/risques-et-dette.md).
