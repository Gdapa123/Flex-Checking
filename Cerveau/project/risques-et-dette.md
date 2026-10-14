---
type: project
statut: implémenté
verifie: 2026-10-14
commit: 36389e6
sources: [frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/composants.jsx, frontend/src/features/invite/EtatCarte.jsx, backend/apps/noyau/vues_public.py, frontend/src/features/invites/PanneauInvite.jsx, backend/apps/noyau/serializers.py, README.md]
---

# Risques, limitations et dette technique

Chaque entrée est une **observation vérifiée dans le code**, sauf mention « à confirmer ».

## R1 — Accès hôte de la borne non protégé (sécurité, moyen) — ✅ RÉSOLU le 2026-10-13
- **Constat** : sur la tablette borne (S11), le bouton cadenas « Espace hôte » appelle `outils.reglages`, qui
  ouvre directement `FeuilleReglages` — aucun code ni mot de passe. La feuille propose « Changer de cérémonie »
  et « Quitter le scan · tableau de bord » (`/admin/evenements/<id>`).
- **Conséquence** : un invité devant la borne peut atteindre l’espace admin avec la session de l’hôte connecté
  (liste des invités, emails, téléphones, exports).
- **Fichiers** : `frontend/src/features/scan/ScanPoste.jsx` (`DispositionBorne`, `outils.reglages`),
  `frontend/src/features/scan/composants.jsx` (`FeuilleReglages`).
- **Résolution** : mot de passe de l'hôte vérifié par le serveur, bouton retour bloqué, et surtout **session
  restreinte côté serveur** ([ADR-010](../decisions/ADR-010-mode-borne-serveur.md)) : même en tapant une adresse,
  le public n'obtient ni la liste des invités ni l'espace admin.

## R2 — Écran I7 « Cette adresse est déjà inscrite » inaccessible (dette, faible)
- **Constat** : `InscriptionView.post` intercepte `DEJA_INSCRIT` et renvoie la même réponse 201 qu’un succès
  (voir [ADR-005](../decisions/ADR-005-anti-enumeration-inscription.md)). Le frontend ne reçoit donc jamais ce
  code ; la branche `DEJA_INSCRIT` de `EtatCarte.jsx` n’est plus atteinte depuis le formulaire public.
- **Conséquence** : code mort ; `PLAN.md` (C8) et le README décrivent encore l’ancien comportement.
- **Statut** : ouvert (décider : supprimer la branche ou la conserver documentée).

## R3 — Règle « tous les champs obligatoires » non appliquée à la modification (cohérence, faible)
- **Constat** : inscription et ajout manuel exigent entreprise et fonction (`ChampsProfessionnelsObligatoires`,
  `schemaInviteComplet`). La modification d’une fiche (`ModificationInviteSerializer`, `schemaInvite`) les
  accepte vides, et l’interface les libelle « facultatif » (`PanneauInvite.jsx`).
- **Statut** : ouvert — à confirmer si c’est voulu.

## R4 — README en retard (documentation, faible)
- Annonce « 79 tests » pytest ; le dépôt contient 143 fonctions `test_*` (certaines paramétrées, donc plus de
  cas exécutés). Décrit encore l’écran I7 comme exigé.

## R5 — Tests backend dépendants de MySQL (outillage)
- `pytest` exige un MySQL joignable (`config/settings_test.py` garde la base MySQL). Sans Docker, aucun test
  backend ne s’exécute (constaté le 2026-10-13). Pas de repli SQLite.

## R6 — Environnement Vercel : temps de réponse du renvoi du QR (faible, test uniquement)
- Sans file d'attente, l'email est envoyé pendant la requête quand l'adresse est inscrite : le temps de réponse
  peut révéler l'inscription malgré le message identique. Sans incidence en production (envoi par Celery).

## R7 — Sondage sur Vercel : heure et durée d'exécution (faible, test uniquement)
- Le cron Vercel du plan Hobby ne s'exécute qu'une fois par jour et peut partir n'importe quand entre 8 h et 8 h 59 ;
  sans Redis, tous les emails du sondage partent pendant la requête du cron (limite de 300 s : à surveiller
  au-delà de ~200 présents). Exige la variable `CRON_SECRET` sur le projet `flex-checking-api`.
- En production, Celery Beat + worker : envoi à 8 h et rattrapages horaires, sans cette limite.

## R8 — Texte de consentement de l'inscription muet sur les emails (conformité, à trancher)
- Le texte du consentement (`InscriptionPage.jsx`) ne mentionne ni l'email n°2 ni le sondage de satisfaction
  (email n°3, ajouté le 2026-10-14). Le texte a été validé par l'utilisateur le 2026-10-13 : **non modifié**,
  à confirmer avec MDE (mention du sondage, droit de ne pas répondre).

## R9 — Unicité « un avis par appareil » contournable (faible)
- Repose sur un cookie et un identifiant de navigateur (pas d'IP, voir ADR-012) : un appareil nettoyé peut
  répondre avec le lien d'un autre invité. Chaque lien ne sert qu'une fois.

## R10 — IP du client vue par le backend sur Vercel (à confirmer, test uniquement)
- Le frontend Vercel relaie `/api` vers un **autre** projet (`flex-checking-api`) : le backend voit peut-être l'IP du
  relais et non celle du client. Toutes les limites par IP seraient alors partagées entre tous les visiteurs
  (ex. 60 inscriptions/h au total). À vérifier en journalisant `get_ident()` sur l'environnement de test.
- Pistes : lire `x-vercel-forwarded-for` / `x-real-ip` si fiables, ou servir l'API depuis le même projet.

## R11 — Pas de CAPTCHA sur les formulaires publics (moyen)
- Inscription, renvoi du QR et sondage reposent sur des limites par IP (IPv6 regroupées par /64 depuis le
  2026-10-14). Un attaquant disposant de nombreuses IPv4 peut encore remplir la capacité d'une cérémonie avec de
  fausses inscriptions. Proposition : Cloudflare Turnstile (service externe, à valider par MDE).

## R12 — Durcissements laissés en l'état (faible)
- Vérification du mot de passe de l'hôte à la borne : 5/min et 30/h ; un verrou plus long permettrait au public de
  bloquer l'hôte (déni de service) — compromis conservé.
- Outillage de développement : Tailwind CSS 3 dépend de `braces`, `micromatch` et `chokidar` signalés par `npm
  audit` (déni de service sur des motifs de fichiers, à la compilation seulement) ; correction = Tailwind 4 (refonte
  de la configuration). Aucune vulnérabilité dans les dépendances livrées (`npm audit --omit=dev` : 0).
- `requirements.txt` sans hachages (`pip-compile --generate-hashes` proposé) ; `pip-audit` : aucune vulnérabilité.
- HSTS `preload` non activé (engagement définitif du domaine, à décider par MDE).

## Limitations assumées (documentées, non bugs)
- Statistiques et analyses calculées en Python sur toutes les lignes d’une cérémonie : adapté à quelques
  centaines d’invités, à surveiller au-delà (`statistiques.py`, `analytique.py`). Mis en cache 30 s et invalidé.
- Environnement Vercel : pas de temps réel, emails en une seule tentative, emails écrits dans les journaux
  (voir [ADR-007](../decisions/ADR-007-environnement-test-vercel.md)).
- Hors ligne au scan : aucune validation locale ; tout passage est « en attente » jusqu’à la synchronisation
  (voir [hors-ligne](../features/hors-ligne.md)).
- Recherche par nom indisponible hors ligne.
- Erreurs techniques : 5 000 signatures max (2 000 pour le navigateur), conservation 30 jours.
