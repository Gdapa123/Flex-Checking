---
type: feature
statut: implémenté
verifie: 2026-10-14
commit: 1985a9a
sources: [backend/apps/noyau/emails.py, backend/apps/noyau/tasks.py, backend/apps/noyau/models.py, backend/templates/emails/, backend/apps/noyau/icones_email.py, backend/apps/noyau/ics.py, backend/apps/noyau/qr.py]
---

# Emails n°1 (invitation) et n°2 (magazine)

## Quand
| Email | Déclencheur | Condition |
|---|---|---|
| n°1 · invitation | inscription publique, ajout manuel (case cochée par défaut), renvoi (public, fiche, action groupée) | toujours |
| n°2 · magazine | premier passage à Présent | programme `magazine_actif` **et** `lien_magazine` renseigné **et** aucun email MAGAZINE déjà créé pour cet invité |

L’email n°2 **ne repart jamais automatiquement**, même après annulation puis nouveau scan
([ADR-004](../decisions/ADR-004-email-2-une-seule-fois.md)). Renvoi manuel possible depuis la fiche (invité Présent).

## Envoi (`emails.planifier` → `tasks.envoyer_email`)
1. Ligne `EmailEnvoye` (EN_ATTENTE) créée dans la transaction.
2. Mise en file Celery **après commit** ; si la file est injoignable, l’action de l’utilisateur réussit quand
   même et l’erreur est enregistrée.
3. Verrou de cache `email-envoi:<id>` (pas de double envoi concurrent).
4. Échec → 3 nouvelles tentatives à 30 s, 2 min, 8 min, puis ECHEC (« À renvoyer ») + erreur technique.
5. Celery beat toutes les 5 min : relance des emails EN_ATTENTE sans tentative depuis plus de 15 min (≤ 500).
6. Sans Redis (Vercel) : envoi dans la requête, une seule tentative.

## Contenu (`emails.rendre`)
- Modèles éditables par le super admin (objet + corps texte, `Parametres`). Variables : `{civilite} {prenom}
  {nom} {programme} {annee} {date} {lieu} {qr_code} {code} {lien_magazine}`.
- Le texte avant `{qr_code}` (ou `{lien_magazine}`) va dans la carte message, la variable devient la carte
  QR + code de secours (ou carte magazine), le texte après va dans une carte suivante ; infos pratiques et
  boutons Agenda / Itinéraire toujours ajoutés (n°1). Valeurs échappées en HTML.
- Gabarits `templates/emails/` : tables 600 px, compatibles Gmail/Outlook, pas de marge négative ; icônes en PNG
  générées par Pillow (`icones_email.py`) ; logo blanc ou rouge selon le contraste.
- Structure MIME : `mixed[ related[ alternative(texte, html), images CID ], pièces jointes ]`.
- Pièces jointes n°1 : `qr-code.png` et `graduation.ics`.
- Boutons de l’email → page publique `/i/<lien>/pratique#agenda` ou `#itineraire`.
- Expéditeur : `« Flex’Checking · MDE Business School » <DEFAULT_FROM_EMAIL>`.
- Aperçu : HTML réel avec images en data URI (`apercu=True`), utilisé par le super admin et l’écran admin A7.
- Écran A7 (`frontend/src/features/admin/ApercuEmails.jsx`) : une carte blanche par email (icône couleur programme,
  nom, moment d’envoi, badge du statut déclencheur, objet), aperçu dans un cadre de 640 px ; deux colonnes à partir
  de 1 240 px. Magazine désactivé : carte avec un message à la place de l’aperçu.

## Tests
`test_emails.py` (échec après 3 relances, échappement, lien en clair, boutons vers infos pratiques),
`test_emargement.py` (magazine unique), `test_analytique.py` (file indisponible, relance).
