---
type: operations
statut: implémenté
verifie: 2026-11-10
commit: 93646d7
sources: [frontend/src/features/admin/EspaceEvenement.jsx, frontend/src/features/auth/ConnexionAdmin.jsx, frontend/src/features/scan/ScanSetup.jsx, frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/invites/GestionInvites.jsx, frontend/src/features/invites/PanneauAjout.jsx, frontend/src/features/admin/SuiviEmails.jsx, frontend/src/features/admin/ChoixCeremonie.jsx, backend/apps/noyau/services.py, backend/apps/noyau/vues_invites.py]
---

# Guide des admins de cérémonie (hôtes d’accueil)

Guide court à remettre aux admins (rôle « admin »). Libellés vérifiés dans l’interface le 2026-11-09, revérifiés dans le code le 2026-11-10.

---

## 1. Se connecter
1. Ouvrez **https://inscription.mde.ci/connexion** (téléphone, tablette ou ordinateur).
2. Saisissez votre email MDE et votre mot de passe.
3. À la première connexion, choisissez un nouveau mot de passe.

Mot de passe oublié : cliquez sur **« Mot de passe oublié ? »** et prévenez la direction des événements, qui le
réinitialise.

Vous voyez **« Vos cérémonies »** : seulement celles qui vous sont confiées. Cliquez sur la vôtre.

## 2. Les quatre onglets de la cérémonie
| Onglet | À quoi il sert |
|---|---|
| **Tableau de bord** | inscrits, présents, arrivées en direct |
| **Invités** | la liste : chercher, ajouter, valider une présence, renvoyer l’invitation |
| **Scan** | l’accueil le jour J |
| **Emails** | qui n’a pas reçu son email, et quoi faire |

## 3. Le jour J : l’accueil (onglet « Scan »)
1. Choisissez la **cérémonie**, le **mode de lecture** (QR caméra le plus souvent), l’**écran** (laissez « Auto »)
   et donnez un **nom au poste** (ex. « Accueil principal »).
2. Appuyez sur **« Démarrer l’émargement »**. Autorisez la caméra si le téléphone le demande.
3. Présentez le QR code de l’invité devant la caméra. Le résultat s’affiche :

| Message | Que faire |
|---|---|
| ✅ **Présence enregistrée** | l’invité entre |
| **Déjà émargé à …** | il est déjà passé (heure et poste indiqués) : vérifiez avec lui |
| **Cet invité appartient à un autre événement** | ce n’est pas la bonne cérémonie : orientez-le |
| **Code invalide** / **QR code non reconnu** | redemandez le **code à 4 chiffres** de son email, ou cherchez son nom |
| **Enregistré, vérification à la reconnexion** | pas de réseau : c’est enregistré, rien à faire, la synchronisation est automatique |

Dès qu’un invité est marqué présent (scan, code, recherche ou « Valider la présence »), il reçoit
automatiquement l’**email n°2** (remerciement, avec les boutons magazine / brochure Executive Education quand la
direction a renseigné les liens), une seule fois : rien à faire de votre côté.

Sans QR code : utilisez **Code** (4 chiffres) ou **Rechercher** (nom).
Plusieurs postes peuvent tourner en même temps (un nom différent par poste).

> Ne scannez jamais un QR code reçu par un autre moyen que l’application : seul l’écran Scan sert à l’accueil.

## 4. Les invités (onglet « Invités »)
- **Chercher** : tapez un nom, un email ou un téléphone.
- **Ajouter un invité** (invité non inscrit) : remplissez la fiche ; laissez cochée
  « Envoyer l’email n°1 (invitation) maintenant » pour qu’il reçoive son QR code.
- **Valider la présence** : pour faire entrer quelqu’un sans scan (cochez-le dans la liste).
- **Renvoyer l’invitation** : si l’invité dit ne pas l’avoir reçue (vérifiez d’abord son adresse dans sa fiche).

## 5. Les emails (onglet « Emails »)
En haut : **« Invités à contacter »**, ceux dont l’email n’est probablement pas arrivé.
- **Corriger et renvoyer** : l’adresse semble mal tapée (ex. « gmial.com ») ; un clic la corrige et renvoie.
- **Corriger l’adresse** : ouvrez la fiche, corrigez avec l’invité (son téléphone est affiché), puis renvoyez.
- **Renvoyer** : l’adresse est bonne, l’envoi a échoué : renvoyez.
- Bandeau « le problème vient de l’envoi » qui se répète : prévenez la direction des événements.

« Aucun invité à contacter » : tout va bien.

## 6. Bonnes pratiques
- Téléphone **chargé**, luminosité au maximum pour le scan.
- Ne partagez **jamais** votre mot de passe ; déconnectez-vous d’un appareil prêté.
- Les données des invités sont **confidentielles** : pas de capture d’écran de la liste, pas d’export envoyé hors MDE.
- Un problème ? La direction des événements (super admin) peut tout corriger : heures, liens, carte, comptes.
