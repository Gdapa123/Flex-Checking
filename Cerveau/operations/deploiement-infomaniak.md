---
type: operations
statut: prévu
verifie: 2026-10-26
commit: d220011
sources: [docker-compose.prod.yml, backend/Dockerfile, frontend/package.json, frontend/.npmrc, infra/Caddyfile.prod, .env.example, backend/config/settings.py, README.md, infra/charge/README.md, backend/apps/noyau/emails.py, backend/apps/noyau/management/commands/seed_demo.py, backend/apps/noyau/models.py, backend/apps/noyau/suivi_emails.py, backend/apps/comptes/models.py, frontend/src/App.jsx, .gitignore, .github/workflows/ci.yml]
---

# Déploiement sur un VPS Infomaniak, pas à pas

Ce guide met Flex’Checking en ligne sur **un seul petit serveur** loué chez Infomaniak.
Il est écrit pour quelqu’un qui n’a **jamais** déployé d’application, ni utilisé un terminal, ni SSH.
Suivez les étapes **dans l’ordre**. Ne sautez rien.

À la fin, toutes les fonctionnalités marchent : inscription, emails n°1, 2 et 3, scan, temps réel,
sondage, exports, rapports PDF, mode hors ligne.

Le serveur fait tourner la pile prévue par `docker-compose.prod.yml` : MySQL (base de données), Redis (file
d’attente et temps réel), Django (l’application), Celery (envoi des emails), Celery beat (tâches planifiées)
et Caddy (le site en HTTPS). Aucune modification du code n’est nécessaire.

> ⚠️ Statut : procédure **pas encore exécutée** de bout en bout. Les menus Infomaniak viennent de leur
> documentation officielle (voir la section Sources) ; un libellé peut légèrement différer à l’écran.
> Les chiffres de dimensionnement sont à confirmer par le test de charge (étape 13).

## Parcours en un coup d’œil

| Étape | Ce qu’on fait | Durée |
|---|---|---|
| 1 | Créer une clé SSH sur le Mac | 5 min |
| 2 | Commander le VPS Lite chez Infomaniak | 15 min (+ livraison, souvent quelques minutes) |
| 3 | Ouvrir les ports du pare-feu | 5 min |
| 4 | Première connexion au serveur | 5 min |
| 5 | Sécuriser le serveur | 20 min |
| 6 | Installer Docker | 10 min |
| 7 | Créer l’adresse du site (DNS) | 5 min (+ jusqu’à quelques heures d’attente) |
| 8 | Récupérer le code depuis GitHub | 15 min |
| 9 | Écrire le fichier de configuration `.env` | 20 min |
| 10 | Construire et démarrer l’application | 15 à 30 min |
| 11 | Créer le premier super admin | 5 min |
| 12 | Vérifier chaque fonctionnalité | 1 h (+ le sondage le lendemain) |
| 13 | Test de charge | 1 h |
| 14 | Sauvegardes chiffrées | 30 min |
| 15 | Protection des données personnelles | 20 min |

Comptez **une journée** en prenant votre temps, plus l’attente du DNS et du sondage du lendemain.

## Les valeurs à préparer

Dans ce guide, tout ce qui est écrit `<EN_MAJUSCULES_ENTRE_CHEVRONS>` est à **remplacer** par votre valeur,
**sans garder les chevrons** `< >`. Notez ces valeurs avant de commencer (les mots de passe : dans le coffre
de mots de passe de MDE, jamais dans le wiki).

| À remplacer | Ce que c’est | Exemple / où le trouver |
|---|---|---|
| `<IP_DU_VPS>` | adresse IPv4 du serveur | Manager Infomaniak, étape 2.4 |
| `<DOMAINE>` | adresse du site, sans `https://` | `emargement.mde.ci` |
| `<EMAIL_ENVOI>` | adresse qui envoie les emails aux invités | `evenements@mde.ci` |
| `<SERVEUR_SMTP>` | serveur d’envoi de la messagerie MDE | service informatique de MDE |
| `<UTILISATEUR_SMTP>` | identifiant du compte d’envoi | souvent identique à `<EMAIL_ENVOI>` |
| `<MOT_DE_PASSE_SMTP>` | mot de passe du compte d’envoi | service informatique de MDE |
| `<EMAIL_SUPER_ADMIN>` | identifiant du premier super admin | `direction.evenements@mde.ci` |
| `<NOM_SUPER_ADMIN>` | nom affiché du super admin | `Direction des événements` |
| `<EMAIL_CONTACT_DONNEES>` | contact « données personnelles » affiché au public | à décider par MDE |

Le nom d’utilisateur pour se connecter au serveur est **`ubuntu`** : c’est l’utilisateur par défaut des
images Ubuntu chez Infomaniak, d’après leur documentation. Il est écrit tel quel dans les commandes.

## Ce que ça coûte

| Poste | Choix | Coût |
|---|---|---|
| Serveur | **VPS Lite** 2 vCPU / 4 Go RAM, Ubuntu 24.04 | environ 6 à 10 €/mois selon la formule (prix affiché en CHF, à vérifier sur la page VPS Lite) |
| Adresse du site | sous-domaine du domaine existant (`emargement.mde.ci`) | 0 € |
| Certificat HTTPS | Let’s Encrypt, obtenu et renouvelé seul par Caddy | 0 € |
| Envoi des emails | messagerie déjà utilisée par MDE (compte dédié) | 0 € de plus |
| Sauvegardes | copie chiffrée chaque nuit + rapatriement sur un poste MDE | 0 € |
| Logiciels | Docker, MySQL, Redis, Caddy | 0 € (libres) |

Pourquoi c’est suffisant : une cérémonie compte 150 à 260 places. Les pointes réelles (inscriptions, scan à
l’accueil) sont très en dessous des 1 000 utilisateurs simultanés testés dans `infra/charge/`.

- Le **VPS Cloud** (instantanés, engagement de disponibilité, ressources ajustables) n’est utile que si MDE
  veut ces garanties.
- Ne prenez **pas** le « Serveur Cloud » infogéré : il ne donne pas l’accès administrateur, indispensable
  pour Docker.

## Avant de commencer : les quatre endroits où l’on travaille

Chaque action indique **où** la faire. Il n’y a que quatre endroits.

| Endroit | Comment y aller |
|---|---|
| **Navigateur › Manager Infomaniak** | Safari ou Chrome, sur `https://manager.infomaniak.com`, connecté au compte Infomaniak de MDE |
| **Terminal du Mac** | l’application Terminal de macOS (voir ci-dessous) |
| **Session SSH du serveur** | le même Terminal, *après* la commande `ssh` : ce que vous tapez s’exécute sur le serveur |
| **Gestionnaire DNS du domaine** | le site où est géré `mde.ci` (Infomaniak ou autre : demandez au service informatique) |

### Ouvrir le Terminal du Mac

1. Appuyez sur **Cmd + Espace** (ouvre Spotlight).
2. Tapez `Terminal`, puis **Entrée**.
3. Une fenêtre s’ouvre avec une ligne qui se termine par `%` : c’est l’**invite de commande**.

Pour lancer une commande : tapez-la (ou collez-la avec **Cmd + V**), puis **Entrée**.
Collez **une ligne à la fois** quand le guide montre plusieurs lignes, sauf mention contraire.

### Savoir si l’on est sur le Mac ou sur le serveur

Regardez le début de la ligne où vous tapez :

| Invite affichée | Vous êtes… |
|---|---|
| `votre-nom@MacBook-de-… ~ %` | sur le **Mac** (se termine par `%`) |
| `ubuntu@nom-du-vps:~$` | sur le **serveur**, en utilisateur normal (se termine par `$`) |
| `root@nom-du-vps:~#` | sur le serveur, en administrateur (`#`) : à éviter, tapez `exit` |

Pour **quitter le serveur** et revenir sur le Mac : tapez `exit`, puis Entrée.

### Les mots de passe ne s’affichent pas

Quand le terminal demande un mot de passe ou une phrase secrète, **rien ne s’affiche** pendant la frappe
(ni points, ni étoiles). C’est normal. Tapez, puis Entrée.

### Modifier un fichier sur le serveur avec `nano`

`nano` est un éditeur de texte simple, dans le terminal.

1. Ouvrir (ou créer) un fichier : `nano chemin/du/fichier` (ou `sudo nano …` pour un fichier système).
2. Se déplacer avec les **flèches** du clavier (la souris ne déplace pas le curseur).
3. Coller un texte copié sur le Mac : **Cmd + V**.
4. Enregistrer : **Ctrl + O** (la lettre O), puis **Entrée** pour confirmer le nom.
5. Quitter : **Ctrl + X**.
6. Si `nano` demande « Save modified buffer? » en quittant : tapez `Y` puis Entrée.
7. Supprimer la ligne où se trouve le curseur : **Ctrl + K**.

Attention : c’est bien la touche **Ctrl** (pas Cmd) pour Ctrl + O, Ctrl + X et Ctrl + K.

### Copier un texte affiché dans le terminal

Sélectionnez-le à la souris, puis **Cmd + C**.

## Étape 1 : Créer une clé SSH sur le Mac

Une clé SSH remplace le mot de passe pour entrer sur le serveur. Elle a deux parties :
la **clé privée** (reste sur le Mac, ne se partage jamais) et la **clé publique** (se donne à Infomaniak).

### 1.1 Vérifier si une clé existe déjà

- **Où :** Terminal du Mac.
- **Quoi :**

  ```bash
  ls ~/.ssh/id_ed25519.pub
  ```

- **Si tout va bien :** soit le chemin s’affiche (une clé existe : passez à 1.3), soit
  « No such file or directory » (pas de clé : faites 1.2).

### 1.2 Créer la clé

- **Où :** Terminal du Mac.
- **Quoi :**

  ```bash
  ssh-keygen -t ed25519 -C "flex-checking-mde"
  ```

  1. « Enter file in which to save the key » : appuyez sur **Entrée** (emplacement par défaut).
  2. « Enter passphrase » : tapez une phrase secrète, Entrée, puis la même une seconde fois.
     Rangez-la dans le coffre de mots de passe de MDE.
- **Si tout va bien :** « Your identification has been saved… » et un dessin en caractères.
- **Si ça ne marche pas :** « Overwrite (y/n)? » signifie qu’une clé existe déjà : tapez `n` et passez à 1.3.

### 1.3 Copier la clé publique

- **Où :** Terminal du Mac.
- **Quoi :**

  ```bash
  cat ~/.ssh/id_ed25519.pub | pbcopy
  ```

- **Si tout va bien :** rien ne s’affiche, mais la clé est dans le presse-papiers.
  Elle commence par `ssh-ed25519 AAAA…`. Pour la voir : `cat ~/.ssh/id_ed25519.pub`.
- ⚠️ Ne copiez **jamais** le fichier `id_ed25519` (sans `.pub`) : c’est la clé privée.

## Étape 2 : Commander le VPS Lite

### 2.1 Choisir l’offre

- **Où :** navigateur, page VPS Lite d’Infomaniak (`https://www.infomaniak.com/fr/hebergement/vps-lite`).
- **Quoi :** choisissez la formule **2 vCPU / 4 Go de RAM** (la moins chère qui suffit).
  Le paiement annuel donne une réduction affichée par Infomaniak.
- **Si tout va bien :** le formulaire de commande s’ouvre dans le Manager.

### 2.2 Choisir le système

- **Où :** navigateur, formulaire de commande.
- **Quoi :** système **Linux**, distribution **Ubuntu 24.04** (le libellé peut être « Ubuntu 24.04 LTS »).
- **Si Ubuntu 24.04 n’apparaît pas :** prenez la version Ubuntu LTS la plus récente proposée.
  La procédure reste la même.

### 2.3 Ajouter la clé SSH

- **Où :** navigateur, formulaire de commande, partie « clé SSH ».
- **Quoi :** Infomaniak propose de **créer** une paire de clés ou d’**importer** votre clé publique.
  Choisissez **importer** (le libellé peut être « Importer une clé », « Utiliser ma clé » ou « Clé publique »),
  puis collez avec **Cmd + V** la clé copiée à l’étape 1.3.
- **Si vous avez laissé Infomaniak créer la clé :** il vous fait télécharger une clé privée. Rangez-la dans
  le dossier `~/.ssh/` du Mac, protégez-la avec `chmod 400 ~/.ssh/<NOM_DU_FICHIER_CLE>`, et ajoutez
  `-i ~/.ssh/<NOM_DU_FICHIER_CLE>` après `ssh` dans chaque commande de ce guide. Plus simple : importez la vôtre.

### 2.4 Trouver l’adresse IP du serveur

- **Où :** navigateur, Manager Infomaniak, rubrique des VPS (le menu peut s’appeler « VPS Cloud / VPS Lite »
  ou « Hébergement » › « VPS Lite »), puis cliquez sur le nom de votre VPS.
- **Quoi :** sur la page du VPS, repérez l’**adresse IPv4** (quatre nombres séparés par des points).
  Notez-la : c’est `<IP_DU_VPS>`. Notez aussi l’IPv6 si elle est affichée.
- **Si le serveur est « en cours d’installation » :** attendez quelques minutes et rechargez la page.

## Étape 3 : Ouvrir les ports du pare-feu

Le pare-feu d’Infomaniak bloque tout ce qui n’est pas autorisé. Il faut ouvrir exactement :

| Port | Protocole | Sert à |
|---|---|---|
| 22 | TCP | connexion SSH (administration) |
| 80 | TCP | obtention du certificat HTTPS, redirection vers HTTPS |
| 443 | TCP | le site en HTTPS |
| 443 | UDP | HTTP/3 (plus rapide sur mobile) |

### 3.1 Ajouter les règles

- **Où :** navigateur, Manager Infomaniak › votre VPS › **Firewall** (menu latéral gauche).
- **Quoi :** pour chaque ligne du tableau :
  1. cliquez sur le bouton bleu **« Ajouter une règle »** ;
  2. choisissez **« Sélection manuelle »** ;
  3. choisissez le protocole (TCP ou UDP) et le port ; source : toutes les adresses ;
  4. validez en bas de la page.
- **Si tout va bien :** quatre règles visibles dans la liste. La règle du port 22 peut exister déjà :
  ne la doublez pas.
- **Si le formulaire est différent :** il peut proposer des modèles (« SSH », « HTTP », « HTTPS ») :
  ils conviennent. Vérifiez seulement que 443 est ouvert **aussi en UDP**.
- ⚠️ N’ouvrez **pas** les ports 3306 (MySQL) ni 6379 (Redis) : ils restent internes.

Remarque : le port **25 sortant** est bloqué sur VPS Lite et ne peut pas être ouvert. Ce n’est pas un
problème : l’application envoie ses emails par le port **587** avec authentification (étape 9).

### 3.2 Vérifier un port depuis le Mac (utile en cas de doute)

- **Où :** Terminal du Mac.
- **Quoi :**

  ```bash
  nc -vz -w 5 <IP_DU_VPS> 22
  ```

- **Si tout va bien :** « succeeded ».
- **Comment lire la réponse pour les ports 80 ou 443 :**
  - « Connection refused » = le pare-feu est ouvert mais rien n’écoute encore (normal avant l’étape 10) ;
  - « Operation timed out » = le port est **fermé** dans le pare-feu : revoyez 3.1.

## Étape 4 : Première connexion au serveur

### 4.1 Se connecter

- **Où :** Terminal du Mac.
- **Quoi :**

  ```bash
  ssh ubuntu@<IP_DU_VPS>
  ```

  1. À la première connexion, « Are you sure you want to continue connecting (yes/no/[fingerprint])? » :
     tapez `yes` puis Entrée.
  2. Si votre clé a une phrase secrète, macOS la demande : tapez-la.
- **Si tout va bien :** un texte d’accueil Ubuntu, puis l’invite `ubuntu@…:~$`. Vous êtes sur le serveur.

### 4.2 Si ça ne marche pas

| Message | Cause probable et solution |
|---|---|
| `Permission denied (publickey)` | clé différente de celle donnée à Infomaniak, ou mauvais utilisateur : vérifiez `ubuntu@` ; si Infomaniak a créé la clé, ajoutez `-i ~/.ssh/<NOM_DU_FICHIER_CLE>` |
| `UNPROTECTED PRIVATE KEY FILE` | droits trop larges sur la clé privée : `chmod 400 ~/.ssh/<NOM_DU_FICHIER_CLE>`, puis recommencez |
| `Operation timed out` | port 22 fermé ou mauvaise IP : revoyez l’étape 3 et l’IP de l’étape 2.4 |
| `Connection refused` | serveur encore en installation : attendez 5 minutes |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | le VPS a été réinstallé : `ssh-keygen -R <IP_DU_VPS>`, puis recommencez |

Si l’utilisateur `ubuntu` est refusé alors que la clé est bonne : la FAQ Infomaniak « première connexion SSH »
(voir Sources) donne le tableau des utilisateurs par distribution ; la page du VPS dans le Manager peut aussi
l’indiquer.

### 4.3 Se déconnecter

- **Où :** session SSH du serveur.
- **Quoi :** `exit`
- **Si tout va bien :** l’invite redevient celle du Mac (`%`).

## Étape 5 : Sécuriser le serveur

Toutes les commandes de cette étape se tapent **dans la session SSH du serveur** (`ssh ubuntu@<IP_DU_VPS>`).
`sudo` exécute une commande en administrateur ; sur VPS Lite, il ne demande normalement pas de mot de passe.

### 5.1 Mettre à jour le système

```bash
sudo apt update
sudo apt -y full-upgrade
```

- **Si tout va bien :** des lignes défilent, puis l’invite revient sans ligne commençant par `E:` (erreur).
- **Si un écran violet demande quel fichier garder :** choisissez l’option par défaut (« keep the local
  version currently installed ») avec Entrée.
- **Si « Could not get lock » :** une mise à jour automatique tourne déjà. Attendez 5 minutes et recommencez.
- **Si « System restart required » :** tapez `sudo reboot`, attendez 1 minute, reconnectez-vous.

### 5.2 Installer les outils de protection

```bash
sudo apt -y install unattended-upgrades fail2ban git gnupg
sudo timedatectl set-timezone Africa/Abidjan
```

- `unattended-upgrades` installe seul les correctifs de sécurité ; `fail2ban` bloque les adresses qui
  multiplient les tentatives de connexion ; `git` récupère le code ; `gnupg` chiffre les sauvegardes.
- Le fuseau horaire rend les journaux plus lisibles ; l’application gère déjà le sien (`Africa/Abidjan`).

Vérifier que les mises à jour automatiques sont actives :

```bash
cat /etc/apt/apt.conf.d/20auto-upgrades
```

- **Si tout va bien :** deux lignes qui finissent par `"1";`.
- **Sinon :** `sudo dpkg-reconfigure -plow unattended-upgrades`, choisissez **Yes**.

### 5.3 Interdire les mots de passe et la connexion root par SSH

⚠️ Gardez **cette fenêtre de Terminal ouverte** pendant toute la sous-étape. Si vous vous trompez, elle
vous permet de corriger.

1. Ouvrir un fichier de réglages :

   ```bash
   sudo nano /etc/ssh/sshd_config.d/00-durcissement.conf
   ```

2. Collez ces deux lignes (Cmd + V), enregistrez (**Ctrl + O**, Entrée), quittez (**Ctrl + X**) :

   ```
   PasswordAuthentication no
   PermitRootLogin no
   ```

   Le nom commence par `00-` pour passer avant les réglages posés à l’installation du serveur.

3. Vérifier, appliquer, contrôler :

   ```bash
   sudo sshd -t
   sudo systemctl restart ssh
   sudo sshd -T | grep -E "passwordauthentication|permitrootlogin"
   ```

- **Si tout va bien :** `sshd -t` n’affiche rien ; la dernière commande affiche
  `passwordauthentication no` et `permitrootlogin no`.
- **Test obligatoire :** ouvrez une **nouvelle** fenêtre de Terminal (Cmd + N) et tapez
  `ssh ubuntu@<IP_DU_VPS>`. Si elle se connecte, tout va bien : vous pouvez fermer l’ancienne fenêtre.
- **Si la nouvelle connexion échoue :** dans l’**ancienne** fenêtre, annulez :

  ```bash
  sudo rm /etc/ssh/sshd_config.d/00-durcissement.conf
  sudo systemctl restart ssh
  ```

  puis relisez 5.3 attentivement.

### 5.4 Ajouter 2 Go de mémoire d’échange (swap)

Filet de sécurité si les 4 Go de RAM sont pleins.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

- **Si tout va bien :** la ligne `Swap:` de `free -h` indique environ `2.0Gi`.
- **Si « Text file busy » ou « already exists » :** le swap existe déjà ; ne refaites pas la ligne `echo …`
  (elle serait en double dans `/etc/fstab`).

## Étape 6 : Installer Docker

Docker fait tourner chaque morceau de l’application dans une « boîte » isolée (un conteneur).

### 6.1 Installer

- **Où :** session SSH du serveur.
- **Quoi :**

  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER
  exit
  ```

- La dernière ligne vous déconnecte : c’est voulu (le droit d’utiliser Docker s’applique à la reconnexion).

### 6.2 Vérifier

- **Où :** Terminal du Mac, puis session SSH.
- **Quoi :**

  ```bash
  ssh ubuntu@<IP_DU_VPS>
  docker compose version
  docker ps
  ```

- **Si tout va bien :** « Docker Compose version v2… », puis un tableau vide (en-têtes `CONTAINER ID …`).
- **Si `permission denied while trying to connect to the Docker daemon socket` :** vous ne vous êtes pas
  reconnecté après `usermod`. Tapez `exit`, reconnectez-vous.

Seuls les ports 80 et 443 de Caddy sont publiés : `docker-compose.prod.yml` ne publie pas ceux de MySQL et
de Redis, qui restent dans le réseau interne de Docker. N’activez pas le pare-feu `ufw` d’Ubuntu : Docker le
contourne. C’est le pare-feu Infomaniak (étape 3) qui protège le serveur.

## Étape 7 : Créer l’adresse du site (DNS)

Le DNS fait correspondre `<DOMAINE>` à `<IP_DU_VPS>`. À faire **avant** le premier démarrage : Caddy demande
le certificat HTTPS dès son lancement, et la demande échoue si l’adresse ne pointe pas encore vers le serveur.

### 7.1 Ajouter l’enregistrement

- **Où :** gestionnaire DNS du domaine `mde.ci`. Si le domaine est chez Infomaniak : Manager › Domaines ›
  `mde.ci` › zone DNS (le menu peut s’appeler « Zone DNS » ou « Gestion DNS »).
- **Quoi :** ajoutez un enregistrement :
  - type **A** ;
  - nom / sous-domaine : `emargement` (la partie avant `.mde.ci`) ;
  - valeur / cible : `<IP_DU_VPS>` ;
  - TTL : la valeur par défaut.
  - Si le VPS a une IPv6 : ajoutez aussi un enregistrement **AAAA** `emargement` → l’IPv6.
- ⚠️ Ne modifiez **aucun** autre enregistrement (notamment MX, SPF, DKIM : ils font marcher la messagerie).

### 7.2 Vérifier la propagation

- **Où :** Terminal du Mac.
- **Quoi :**

  ```bash
  dig +short <DOMAINE>
  ```

- **Si tout va bien :** `<IP_DU_VPS>` s’affiche.
- **Si rien ne s’affiche ou une autre IP :** le DNS n’est pas encore propagé. Attendez 15 minutes et
  recommencez (cela peut prendre quelques heures). Vérifiez aussi l’orthographe du sous-domaine.
  Ne passez pas à l’étape 10 avant d’obtenir la bonne IP.

## Étape 8 : Récupérer le code depuis GitHub

Le dépôt `https://github.com/Gdapa123/Flex-Checking.git` est **privé**. Le serveur a besoin d’une
**deploy key** : une clé SSH propre au serveur, qui peut **lire** ce seul dépôt, sans pouvoir le modifier.

### 8.1 Créer la clé du serveur

- **Où :** session SSH du serveur.
- **Quoi :**

  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/github_flex -N "" -C "serveur-flex-checking"
  cat ~/.ssh/github_flex.pub
  ```

- **Si tout va bien :** une ligne `ssh-ed25519 AAAA… serveur-flex-checking` s’affiche.
  Sélectionnez-la entièrement à la souris, puis **Cmd + C**.

### 8.2 Déclarer la clé dans GitHub

- **Où :** navigateur, `https://github.com/Gdapa123/Flex-Checking`, connecté avec un compte
  **administrateur** du dépôt.
- **Quoi :**
  1. onglet **Settings** du dépôt (pas celui de votre profil) ;
  2. menu de gauche **Deploy keys** › bouton **Add deploy key** ;
  3. **Title** : `VPS Infomaniak production` ;
  4. **Key** : Cmd + V ;
  5. laissez **« Allow write access » décoché** (lecture seule) ;
  6. **Add key** (GitHub peut redemander votre mot de passe ou un code).
- **Si tout va bien :** la clé apparaît dans la liste « Deploy keys ».
- **Si « Settings » n’apparaît pas :** votre compte n’est pas administrateur du dépôt ; demandez au
  propriétaire (`Gdapa123`).
- **Si « Key is already in use » :** cette clé est déjà déclarée ailleurs ; recréez-en une (8.1) avec un
  autre nom de fichier.

### 8.3 Dire au serveur d’utiliser cette clé pour GitHub

- **Où :** session SSH du serveur.
- **Quoi :** tapez `nano ~/.ssh/config`, collez ces lignes, enregistrez (**Ctrl + O**, Entrée), quittez
  (**Ctrl + X**) :

  ```
  Host github.com
    IdentityFile ~/.ssh/github_flex
    IdentitiesOnly yes
  ```

  Puis testez :

  ```bash
  chmod 600 ~/.ssh/config
  ssh -T git@github.com
  ```

  La première fois, à « Are you sure you want to continue connecting », tapez `yes`.
- **Si tout va bien :** « Hi Gdapa123/Flex-Checking! You've successfully authenticated, but GitHub does not
  provide shell access. » Ce message est normal.
- **Si `Permission denied (publickey)` :** la clé est absente ou mal collée dans GitHub, ou `~/.ssh/config`
  contient une faute. Revoyez 8.2 et 8.3.

### 8.4 Télécharger le code

```bash
sudo mkdir -p /opt/flex-checking
sudo chown ubuntu:ubuntu /opt/flex-checking
git clone git@github.com:Gdapa123/Flex-Checking.git /opt/flex-checking
cd /opt/flex-checking
ls
```

- **Si tout va bien :** `ls` liste notamment `backend`, `frontend`, `infra`, `docker-compose.prod.yml`.
- **Si « destination path already exists and is not an empty directory » :** le code est déjà là ;
  faites simplement `cd /opt/flex-checking`.

## Étape 9 : Écrire le fichier de configuration `.env`

Le fichier `/opt/flex-checking/.env` contient les réglages et les **secrets** de la production.

⚠️ Règles : ne jamais l’envoyer par email ou messagerie, ne jamais le copier dans le wiki ni dans GitHub
(il est exclu du dépôt par `.gitignore`), ne jamais le montrer en capture d’écran.

### 9.1 Écrire les réglages non secrets

- **Où :** session SSH du serveur, dans `/opt/flex-checking`.
- **Quoi :** tapez `nano .env`, collez le texte ci-dessous **après avoir remplacé** les valeurs `<…>`,
  enregistrez (**Ctrl + O**, Entrée), quittez (**Ctrl + X**). Astuce : préparez le texte dans TextEdit sur
  le Mac, remplacez les valeurs, puis copiez-collez.

  ```
  COMPOSE_FILE=docker-compose.prod.yml
  DOMAINE=<DOMAINE>
  APP_PUBLIC_URL=https://<DOMAINE>
  DJANGO_ALLOWED_HOSTS=<DOMAINE>
  CSRF_TRUSTED_ORIGINS=https://<DOMAINE>
  MYSQL_DATABASE=flex
  MYSQL_USER=flex
  EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
  EMAIL_HOST=<SERVEUR_SMTP>
  EMAIL_PORT=587
  EMAIL_USE_TLS=1
  EMAIL_HOST_USER=<UTILISATEUR_SMTP>
  EMAIL_HOST_PASSWORD=<MOT_DE_PASSE_SMTP>
  DEFAULT_FROM_EMAIL=<EMAIL_ENVOI>
  MYSQL_INNODB_BUFFER=512M
  REDIS_MAXMEMORY=128mb
  WEB_CONCURRENCY=3
  DB_CONCURRENCE=24
  CELERY_CONCURRENCY=2
  ```

Ce que veut dire chaque ligne :

| Variable | Rôle |
|---|---|
| `COMPOSE_FILE` | **`docker-compose.prod.yml` seul.** Sans elle, `docker compose` lirait `docker-compose.yml` (celui du développement) |
| `DOMAINE` | adresse pour laquelle Caddy obtient le certificat HTTPS |
| `APP_PUBLIC_URL` | adresse complète utilisée dans les liens des emails et les QR codes |
| `DJANGO_ALLOWED_HOSTS` | adresses acceptées par Django (les autres sont refusées) |
| `CSRF_TRUSTED_ORIGINS` | origine autorisée pour les formulaires (protection CSRF) |
| `MYSQL_DATABASE`, `MYSQL_USER` | nom de la base et de son utilisateur (pas `root`) |
| `EMAIL_BACKEND` | envoi réel par SMTP (en développement, les emails restent dans la console) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS` | serveur d’envoi de MDE, port **587**, chiffrement activé (`1`) |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | compte d’envoi dédié |
| `DEFAULT_FROM_EMAIL` | **adresse seule** (ex. `evenements@mde.ci`), sans nom ni guillemets |
| `MYSQL_INNODB_BUFFER` | mémoire de MySQL : `512M` au lieu de `1G` par défaut (petit serveur) |
| `REDIS_MAXMEMORY` | mémoire de Redis : `128mb` au lieu de `512mb` |
| `WEB_CONCURRENCY` | processus de l’application web : `3` au lieu de `4` |
| `DB_CONCURRENCE` | requêtes simultanées par processus : `24` (3 × 24 = 72 connexions MySQL au plus, sous la limite de 600) |
| `CELERY_CONCURRENCY` | envois d’emails en parallèle : `2` au lieu de `4`, suffisant pour quelques centaines par cérémonie |

Pourquoi `DEFAULT_FROM_EMAIL` est une adresse seule : le code construit lui-même l’en-tête
« Nom de l’expéditeur `<adresse>` » (`emails.message_depuis_rendu`), le nom étant réglé dans les paramètres
de l’application. Un nom ajouté ici produirait un en-tête invalide.

Conseil : utilisez la même adresse pour `<EMAIL_ENVOI>` et `<UTILISATEUR_SMTP>`. Beaucoup de messageries
refusent d’envoyer au nom d’une autre adresse que celle du compte.

### 9.2 Ajouter les secrets générés

Ces commandes **fabriquent** des secrets au hasard et les ajoutent directement au fichier, sans les
afficher. Tapez-les **une seule fois** chacune.

- **Où :** session SSH du serveur, dans `/opt/flex-checking`.

```bash
echo "DJANGO_SECRET_KEY=$(openssl rand -hex 32)" >> .env
echo "MYSQL_PASSWORD=$(openssl rand -hex 24)" >> .env
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)" >> .env
chmod 600 .env
```

| Secret | Rôle | Généré par |
|---|---|---|
| `DJANGO_SECRET_KEY` | signe les sessions et les jetons ; refusé s’il fait moins de 32 caractères | `openssl rand -hex 32` (64 caractères) |
| `MYSQL_PASSWORD` | mot de passe de l’utilisateur de la base | `openssl rand -hex 24` |
| `MYSQL_ROOT_PASSWORD` | mot de passe administrateur de MySQL (différent du précédent) | `openssl rand -hex 24` |

Vous n’avez pas besoin de connaître ces secrets : ils restent dans `.env`, sur le serveur.

### 9.3 Vérifier le fichier sans afficher les secrets

```bash
cut -d= -f1 .env
ls -l .env
```

- **Si tout va bien :** la liste des **noms** de variables (22 lignes, chaque nom une seule fois), et
  `-rw-------` au début de la ligne de `ls -l`.
- **Si un nom apparaît deux fois :** ouvrez `nano .env`, placez le curseur sur la ligne en trop, **Ctrl + K**,
  puis enregistrez et quittez.
- ⚠️ Les mots de passe MySQL sont enregistrés **au premier démarrage**. Les changer ensuite dans `.env` ne
  change pas la base : MySQL refuserait la connexion. Ne les modifiez plus après l’étape 10.

### 9.4 À ne pas mettre dans `.env`

- `DJANGO_DEBUG` : forcé à `0` par `docker-compose.prod.yml`.
- `JWT_COOKIE_SECURE`, `SECURE_SSL_REDIRECT` : déjà vrais par défaut en production.
- `CELERY_TASK_ALWAYS_EAGER`, `DEMO_MOT_DE_PASSE_*` : développement uniquement.
- `CRON_SECRET` : propre à l’environnement de test Vercel. Ici, Celery beat envoie le sondage chaque heure
  de 8 h à 20 h (heure d’Abidjan).
- `NUM_PROXIES`, `DB_HOST`, `DB_PORT`, `REDIS_URL` : déjà fixés par `docker-compose.prod.yml`.

### 9.5 Pour que les emails arrivent en boîte de réception

- **Où :** gestionnaire DNS du domaine `mde.ci`, avec le service informatique de MDE.
- **Quoi :**
  - vérifier que l’enregistrement **SPF** (texte commençant par `v=spf1`) autorise le serveur SMTP utilisé ;
  - vérifier que **DKIM** est activé pour le compte d’envoi ;
  - ajouter un **DMARC** (`p=none` pour commencer) s’il n’existe pas.
- L’application envoie par SMTP authentifié, pas directement depuis le VPS : l’IP du VPS n’a **pas** besoin
  d’être déclarée dans le SPF.

## Étape 10 : Construire et démarrer l’application

Toutes les commandes : **session SSH du serveur**, dans `/opt/flex-checking` (tapez d’abord
`cd /opt/flex-checking`).

### 10.1 Construire le site (frontend)

Le site est construit dans un conteneur Node 24, toujours la dernière version publiée (`--pull always`) : rien à
installer. Si npm affiche « Unsupported engine » (`EBADENGINE`), la version téléchargée est trop ancienne pour les
correctifs de sécurité exigés par `frontend/package.json` : réessayez plus tard ou prévenez le développeur.

```bash
docker run --rm --pull always -v "$PWD/frontend:/app" -w /app node:24-alpine sh -c "npm ci && npm run build"
```

- **Si tout va bien (2 à 5 minutes) :** la fin affiche « built in … » ; `ls frontend/dist` montre
  `index.html` et `assets`.
- **Si « Killed » ou « JavaScript heap out of memory » :** mémoire insuffisante ; vérifiez le swap
  (`free -h`, étape 5.4) et recommencez.

### 10.2 Démarrer toute la pile

```bash
docker compose up -d --build
```

- Lance, dans l’ordre : `mysql`, `redis`, `migrate` (prépare la base), `django`, `celery`, `celery-beat`,
  `proxy` (Caddy). La première fois : 5 à 15 minutes (téléchargement et construction).
- Les migrations créent aussi les statuts, les quatre programmes et les paramètres.
- Le volume `media-data` (exports de plus de 50 invités, écrits par Celery puis téléchargés par Django) est
  déjà prévu dans `docker-compose.prod.yml` : **aucun fichier compose supplémentaire** n’est nécessaire.
- Les journaux de chaque conteneur sont plafonnés (3 fichiers de 10 Mo) : ils ne peuvent pas remplir le disque.

### 10.3 Vérifier l’état

```bash
docker compose ps -a
```

- **Si tout va bien :** `mysql`, `redis`, `django`, `celery` en `Up … (healthy)` ; `celery-beat` et `proxy`
  en `Up` ; `migrate` en `Exited (0)` (normal : il s’arrête après son travail).
- `celery` peut rester `(health: starting)` jusqu’à 1 minute : attendez et relancez la commande.

### 10.4 Vérifier le certificat HTTPS

```bash
docker compose logs -f proxy
```

- **Si tout va bien :** un message contenant « certificate obtained successfully » pour `<DOMAINE>`.
  Appuyez sur **Ctrl + C** pour arrêter l’affichage (cela n’arrête pas le service).
- Dans le navigateur, `https://<DOMAINE>` affiche l’application avec un **cadenas**.

### 10.5 Si ça ne marche pas

**Certificat HTTPS qui échoue** (« challenge failed », « Timeout during connect », « NXDOMAIN ») :

1. sur le Mac, `dig +short <DOMAINE>` doit donner `<IP_DU_VPS>` (étape 7.2) ;
2. les ports 80 et 443 TCP doivent être ouverts (étape 3) ;
3. puis, sur le serveur : `docker compose restart proxy`.

Let’s Encrypt limite les échecs répétés : après 3 ou 4 essais ratés, attendez **une heure** avant de
recommencer. Ne redémarrez pas Caddy en boucle.

**Un conteneur `unhealthy`, `Restarting` ou `Exited (1)` :** lisez son journal.

```bash
docker compose logs --tail=100 django
```

Remplacez `django` par `mysql`, `celery`, `migrate`… selon le conteneur en cause.

| Message ou symptôme | Cause et solution |
|---|---|
| `DJANGO_SECRET_KEY doit être défini (32 caractères minimum)` | secret absent ou trop court : revoyez 9.2, puis `docker compose up -d` |
| `Access denied for user` | mots de passe MySQL changés après le premier démarrage : remettez les valeurs d’origine dans `.env` |
| `Can't connect to MySQL server` | MySQL encore en démarrage : attendez 1 minute, puis `docker compose up -d` |
| `Bad Request (400)` dans le navigateur | `DJANGO_ALLOWED_HOSTS` ne correspond pas à l’adresse tapée : corrigez `.env`, puis `docker compose up -d` |
| `CSRF verification failed` à la connexion | `CSRF_TRUSTED_ORIGINS` sans `https://` ou mal orthographié : corrigez `.env`, puis `docker compose up -d` |
| `no configuration file provided` | vous n’êtes pas dans `/opt/flex-checking`, ou `COMPOSE_FILE` manque dans `.env` |

Après **toute** modification de `.env` : `docker compose up -d` (recrée les conteneurs concernés).

⚠️ Ne lancez **jamais** `seed_demo` en production : la commande est refusée hors mode debug sans `--force`
(option réservée à un environnement de test).

## Étape 11 : Créer le premier super admin

### 11.1 Créer le compte

- **Où :** session SSH du serveur, dans `/opt/flex-checking`.
- **Quoi :** collez ces deux lignes **ensemble** (la barre `\` en fin de première ligne les relie) :

  ```bash
  docker compose exec django python manage.py shell -c \
    "from apps.comptes.models import Admin; Admin.objects.create_superuser('<EMAIL_SUPER_ADMIN>', '<NOM_SUPER_ADMIN>', input('Mot de passe : '))"
  ```

  Gardez les apostrophes `'` autour de l’email et du nom. Au message « Mot de passe : », tapez un mot de
  passe fort (ici il **s’affiche** : vérifiez que personne ne regarde), puis Entrée. Effacez l’écran ensuite
  avec `clear`.
- **Si tout va bien :** l’invite revient sans message d’erreur.
- **Si `IntegrityError` ou `Duplicate entry` :** ce compte existe déjà.

### 11.2 Se connecter et créer les admins

- **Où :** navigateur, `https://<DOMAINE>/super/connexion`.
- **Quoi :** connectez-vous, puis créez les comptes admins depuis l’interface. Ils reçoivent un mot de passe
  temporaire à changer à la première connexion (voir
  [ADR-003](../decisions/ADR-003-comptes-mot-de-passe-temporaire.md)).

## Étape 12 : Vérifier chaque fonctionnalité

Créez d’abord une **cérémonie de test** dans l’interface. Faites chaque contrôle.

| Contrôle | Comment | Si tout va bien |
|---|---|---|
| Santé | Terminal du Mac : `curl -s https://<DOMAINE>/api/sante/` | réponse JSON positive (Django et base joignables) |
| HTTPS, en-têtes | navigateur : cadenas ; Mac : `curl -sI https://<DOMAINE>` | lignes `strict-transport-security` et `content-security-policy` |
| Email de test | Admin › **Suivi des emails** › envoyer un email de test | email reçu ; dans ses en-têtes, `spf=pass` et `dkim=pass` |
| Inscription → email n°1 | s’inscrire via le lien public de la cérémonie de test | email avec QR code et invitation calendrier (`.ics`) |
| Scan → email n°2 | ouvrir `https://<DOMAINE>/scan` sur un téléphone, scanner le QR | caméra active (grâce au HTTPS), passage enregistré, email n°2 reçu |
| Temps réel | tableau de bord ouvert sur un autre appareil pendant le scan | mention « En direct », chiffres mis à jour sans recharger |
| Sondage (email n°3) | le lendemain de l’émargement de test, après 8 h | email du sondage reçu (envoyé par Celery beat) |
| Export lourd | export CSV ou Excel d’une liste de **plus de 50** invités | fichier téléchargé (volume `media-data`) |
| Rapport PDF | rapport de la cérémonie de test | PDF ouvert |
| Hors ligne | couper le réseau du téléphone pendant un scan, puis le rétablir | scan mis en attente, puis synchronisé |

**Email non reçu ?**

1. Regardez les **indésirables** (spam).
2. Admin › Suivi des emails : l’email est-il « en échec » ? Super admin › **Erreurs** : un message y figure-t-il ?
3. Journal du service d’envoi (session SSH, dans `/opt/flex-checking`) :

   ```bash
   docker compose logs --tail=100 celery
   ```

   - `Authentication failed` ou `535` : identifiant ou mot de passe SMTP faux (étape 9.1) ;
   - `Connection timed out` : mauvais `EMAIL_HOST` ou port (utilisez 587, jamais 25, bloqué sur VPS Lite) ;
   - `Sender address rejected` : `DEFAULT_FROM_EMAIL` différent du compte d’envoi.
4. Après correction de `.env` : `docker compose up -d`, puis renvoyez depuis Suivi des emails.

## Étape 13 : Test de charge (avant la première cérémonie)

Le VPS est plus petit que la machine des mesures de référence (8 cœurs, `infra/charge/README.md`).
Faites ce test **avant d’ouvrir les inscriptions**, sur une cérémonie de test.

### 13.1 Couper l’envoi réel des emails pendant le test

Le test crée des centaines d’invités `charge.*@test.ci`. Sans précaution, Celery leur enverrait de vrais
emails (refusés, et mauvais pour la réputation de l’adresse d’envoi).

- **Où :** session SSH, dans `/opt/flex-checking`.
- **Quoi :** `nano .env`, remplacez la ligne `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` par
  `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`, enregistrez, quittez, puis :

  ```bash
  docker compose up -d
  ```

### 13.2 Lancer les mesures

Suivez `infra/charge/README.md` (il faut une cérémonie de test, son lien d’inscription, son identifiant et un
compte admin), avec **deux adaptations** pour la production :

- le réseau Docker s’appelle `flex-checking-prod_default` (au lieu de `flex-checking_default`) ;
- `docker compose` vise déjà la production grâce à `COMPOSE_FILE` dans `.env`.

### 13.3 Nettoyer et rétablir les emails

```bash
docker compose exec django python manage.py shell -c "from apps.noyau.models import Invite; print(Invite.objects.filter(email__startswith='charge.', email__endswith='@test.ci').delete())"
docker compose restart django
```

Les passages, emails et sondages liés à ces invités sont supprimés avec eux.
Puis remettez `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` dans `.env`, lancez
`docker compose up -d`, et refaites l’email de test de l’étape 12.

### 13.4 Interpréter

Si les temps de réponse sont mauvais (plusieurs secondes à l’ouverture du lien d’inscription) : passez à
4 vCPU / 8 Go (VPS Lite supérieur ou VPS Cloud), puis remettez `WEB_CONCURRENCY=4` et `CELERY_CONCURRENCY=4`
dans `.env`.

## Étape 14 : Sauvegardes chiffrées

La base contient les données personnelles des invités. Les sauvegardes sont donc **chiffrées** (AES-256)
avant d’être écrites, puis rapatriées sur un poste de MDE.
En complément, MySQL garde ses journaux binaires **7 jours** (`--binlog-expire-logs-seconds=604800` dans
`docker-compose.prod.yml`) : ils couvrent une semaine si une sauvegarde nocturne a manqué.

### 14.1 Créer la phrase de chiffrement

- **Où :** session SSH du serveur.
- **Quoi :**

  ```bash
  sudo sh -c 'umask 077; openssl rand -base64 32 > /root/.flex-sauvegarde-phrase'
  sudo chmod 600 /root/.flex-sauvegarde-phrase
  sudo cat /root/.flex-sauvegarde-phrase
  ```

- **Si tout va bien :** une ligne d’environ 44 caractères s’affiche.
- ⚠️ **Copiez-la immédiatement hors du serveur**, dans le coffre de mots de passe de MDE (pas dans le wiki,
  pas par email). Sans elle, **aucune sauvegarde ne peut être relue**, y compris si le serveur disparaît.
  Puis effacez l’écran : `clear`.

### 14.2 Créer le script de sauvegarde

- **Où :** session SSH du serveur.
- **Quoi :**

  ```bash
  mkdir -p /opt/flex-checking/sauvegardes
  chmod 700 /opt/flex-checking/sauvegardes
  sudo nano /usr/local/bin/flex-sauvegarde.sh
  ```

  Collez ce script, enregistrez (**Ctrl + O**, Entrée), quittez (**Ctrl + X**) :

  ```bash
  #!/bin/bash
  # Sauvegarde chiffrée de la base Flex'Checking (lancée chaque nuit par root)
  set -euo pipefail
  umask 077
  cd /opt/flex-checking
  FICHIER="sauvegardes/flex-$(date +%F).sql.gz.gpg"
  docker compose exec -T mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines "$MYSQL_DATABASE"' \
    | gzip \
    | gpg --symmetric --cipher-algo AES256 --batch --yes --pinentry-mode loopback \
          --passphrase-file /root/.flex-sauvegarde-phrase -o "$FICHIER"
  chown ubuntu:ubuntu "$FICHIER"
  find sauvegardes -name 'flex-*.sql.gz.gpg' -mtime +14 -delete
  ```

  Puis rendez-le exécutable et lancez-le une première fois :

  ```bash
  sudo chmod 700 /usr/local/bin/flex-sauvegarde.sh
  sudo /usr/local/bin/flex-sauvegarde.sh
  ls -lh /opt/flex-checking/sauvegardes
  ```

- **Si tout va bien :** un fichier `flex-AAAA-MM-JJ.sql.gz.gpg` apparaît (quelques Ko ou plus).
- Le dossier `sauvegardes/` est exclu du dépôt Git (`.gitignore`). Les fichiers de plus de 14 jours sont
  supprimés automatiquement.
- **Si `gpg: can't open '/root/.flex-sauvegarde-phrase'` :** refaites 14.1.
- **Si `service "mysql" is not running` :** l’application n’est pas démarrée (étape 10).

### 14.3 Programmer la sauvegarde chaque nuit à 2 h 30

```bash
( sudo crontab -l 2>/dev/null; echo "30 2 * * * /usr/local/bin/flex-sauvegarde.sh" ) | sudo crontab -
sudo crontab -l
```

- **Si tout va bien :** la ligne `30 2 * * * /usr/local/bin/flex-sauvegarde.sh` s’affiche, une seule fois.

### 14.4 Rapatrier les sauvegardes sur un poste de MDE

Une sauvegarde restée sur le VPS ne protège pas d’une perte du VPS.

- **Où :** Terminal du Mac (poste MDE autorisé), au moins **une fois par semaine** et après chaque cérémonie.
- **Quoi :**

  ```bash
  mkdir -p ~/Sauvegardes-Flex
  scp "ubuntu@<IP_DU_VPS>:/opt/flex-checking/sauvegardes/*.gpg" ~/Sauvegardes-Flex/
  ls -lh ~/Sauvegardes-Flex
  ```

- Les fichiers restent chiffrés sur le Mac. Gardez-les sur un disque protégé (FileVault activé), avec un
  accès limité à la direction des événements.

### 14.5 Restaurer une sauvegarde (à tester au moins une fois)

- **Où :** session SSH du serveur, dans `/opt/flex-checking`.
- ⚠️ La restauration **remplace** les données actuelles. Faites d’abord une sauvegarde du moment :
  `sudo /usr/local/bin/flex-sauvegarde.sh`.
- **Quoi :** remplacez `AAAA-MM-JJ` par la date voulue, sur **une seule ligne** :

  ```bash
  sudo gpg --decrypt --batch --pinentry-mode loopback --passphrase-file /root/.flex-sauvegarde-phrase sauvegardes/flex-AAAA-MM-JJ.sql.gz.gpg | gunzip | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
  ```

- **Si tout va bien :** l’invite revient sans erreur ; les données de cette date sont visibles dans l’application.
- **Si `gpg: decryption failed: Bad session key` :** la phrase n’est pas la bonne.
- **Restaurer sur un nouveau serveur :** refaites les étapes 1 à 10 ; recréez
  `/root/.flex-sauvegarde-phrase` avec la phrase conservée (`sudo nano /root/.flex-sauvegarde-phrase`, puis
  `sudo chmod 600 /root/.flex-sauvegarde-phrase`) ; renvoyez le fichier depuis le Mac :

  ```bash
  scp ~/Sauvegardes-Flex/flex-AAAA-MM-JJ.sql.gz.gpg ubuntu@<IP_DU_VPS>:/opt/flex-checking/sauvegardes/
  ```

  puis lancez la commande de restauration ci-dessus.

## Étape 15 : Protection des données personnelles en production

### 15.1 Sur le serveur

- **Sauvegardes chiffrées** (étape 14), phrase de chiffrement conservée **hors du serveur**, copies sur un
  poste MDE protégé.
- **Accès SSH par clé uniquement** (étape 5.3), pas de connexion root. Seules les personnes qui administrent
  le serveur ont une clé. Pour retirer l’accès d’une personne : `nano ~/.ssh/authorized_keys` et supprimez sa
  ligne (Ctrl + K).
- **Mises à jour de sécurité automatiques** (étape 5.2).
- **Le fichier `.env` ne se partage pas** : ni par email, ni par messagerie, ni dans le wiki ou GitHub.
- Les journaux de Caddy masquent déjà les recherches d’invités et les liens personnels du sondage
  (`infra/Caddyfile.prod`). MySQL et Redis ne sont pas joignables depuis Internet.

### 15.2 Dans l’application, après la mise en ligne

- **Où :** navigateur, connecté en super admin › **Paramètres** › **Données personnelles**.
- **Quoi :**
  - **Durée de conservation** (en mois) : les données des invités des cérémonies plus anciennes que cette
    durée sont **anonymisées automatiquement chaque nuit**. Choisissez la durée avec la direction et le
    service juridique.
  - **Adresse de contact données personnelles** : `<EMAIL_CONTACT_DONNEES>`. Elle est affichée sur la page
    publique `https://<DOMAINE>/confidentialite`.
- **Si tout va bien :** dans une fenêtre de navigation privée, `https://<DOMAINE>/confidentialite` affiche
  l’adresse de contact.

> ⚠️ Ces réglages existent depuis la version du 2026-10-22. Si la section n’apparaît pas, la version déployée
> est antérieure : mettez à jour l’application (étape « Mettre à jour l’application »).
> Fonctionnement détaillé : [donnees-personnelles](../features/donnees-personnelles.md).

### 15.3 Cadre légal (à vérifier avec le service juridique)

- La Côte d’Ivoire encadre les données personnelles par la **loi n° 2013-450** relative à la protection des
  données à caractère personnel. L’autorité de contrôle est l’**ARTCI**.
- Une **déclaration ou une autorisation** du traitement auprès de l’ARTCI peut être nécessaire avant la mise
  en service : **à vérifier avec le service juridique de MDE**. Ce guide n’affirme aucune obligation précise.
- À préparer avec eux : finalité du traitement, durée de conservation, information des invités (page
  `/confidentialite`), personne à contacter.

## Mettre à jour l’application

À faire quand une nouvelle version est publiée sur GitHub. **Jamais le jour d’une cérémonie.**

- **Où :** session SSH du serveur.

```bash
cd /opt/flex-checking
sudo /usr/local/bin/flex-sauvegarde.sh
git pull
docker run --rm --pull always -v "$PWD/frontend:/app" -w /app node:24-alpine sh -c "npm ci && npm run build"
docker compose build --pull
docker compose up -d
docker compose ps -a
docker image prune -f
```

- `migrate` s’exécute avant le redémarrage de Django ; `docker image prune -f` libère le disque.
- **Si tout va bien :** même état qu’à l’étape 10.3.
- **Si `git pull` refuse (« Your local changes would be overwritten ») :** quelqu’un a modifié un fichier sur
  le serveur. Ne forcez rien : notez le message et demandez au développeur.
- Le site installé sur les téléphones (PWA) se met à jour au chargement suivant (page d’entrée en `no-cache`).

## Veille de sécurité (une fois par mois, et dès qu’une alerte paraît)

Les failles des briques utilisées (Python, Node.js, MySQL, Redis, Caddy, Ubuntu) sont publiées sur leurs sites
officiels. **Où :** navigateur. **Quoi :** consulter
[nodejs.org/en/blog/vulnerability](https://nodejs.org/en/blog/vulnerability) (Node.js ne sert qu’à **construire** le
frontend ; en production, Caddy sert des fichiers statiques), [python.org](https://www.python.org/downloads/),
[ubuntu.com/security/notices](https://ubuntu.com/security/notices). Ce projet n’utilise **pas PHP** : les alertes
PHP (par exemple CVE-2026-109618 et CVE-2026-109619 du 21/10/2026) ne le concernent pas.

Node.js : les commandes de ce guide prennent toujours la dernière version 24.x (`--pull always`) ; rien à modifier,
il suffit de reconstruire (« Mettre à jour l’application »). La version minimale acceptée est fixée dans
`frontend/package.json` (`engines`), à relever par le développeur après une alerte. Pour les images de base du
serveur (Python, MySQL, Redis, Caddy), reconstruisez avec `docker compose build --pull` puis
`docker compose up -d` : `--pull` télécharge leurs derniers correctifs. Les mises à jour d’Ubuntu s’installent
seules (`unattended-upgrades`).

## Surveillance minimale (gratuite)

- **État :** `docker compose ps -a` ; **journaux :** `docker compose logs --tail=100 <SERVICE>`
  (`django`, `celery`, `proxy`…), dans `/opt/flex-checking`.
- **Erreurs de l’application :** Super admin › **Erreurs** (voir [erreurs-techniques](../features/erreurs-techniques.md)).
- Les conteneurs redémarrent seuls (`restart: unless-stopped`), y compris après un redémarrage du VPS.
- **Sonde gratuite** (facultatif) : un service comme UptimeRobot qui interroge `https://<DOMAINE>/api/sante/`
  toutes les 5 minutes et prévient par email en cas de panne.
- **Espace disque :** `df -h /` ; au-delà de 80 % d’occupation, lancez `docker image prune -f` et vérifiez le
  dossier `sauvegardes`.

## Liste de contrôle finale

- [ ] Clé SSH créée sur le Mac, phrase secrète rangée dans le coffre de MDE
- [ ] VPS Lite 2 vCPU / 4 Go commandé, Ubuntu 24.04, IP notée
- [ ] Pare-feu : 22/TCP, 80/TCP, 443/TCP, 443/UDP ouverts, rien d’autre
- [ ] Connexion `ssh ubuntu@<IP_DU_VPS>` fonctionnelle
- [ ] Système à jour, mises à jour automatiques actives, fail2ban installé
- [ ] SSH : mots de passe et root interdits, testé depuis une nouvelle fenêtre
- [ ] Swap de 2 Go actif
- [ ] Docker installé, `docker ps` fonctionne sans `sudo`
- [ ] DNS : `dig +short <DOMAINE>` renvoie l’IP du VPS
- [ ] Deploy key GitHub en lecture seule, code cloné dans `/opt/flex-checking`
- [ ] `.env` complet, en `chmod 600`, avec `COMPOSE_FILE=docker-compose.prod.yml` et `DEFAULT_FROM_EMAIL` en adresse seule
- [ ] SPF, DKIM et DMARC vérifiés pour l’adresse d’envoi
- [ ] Frontend construit, pile démarrée, conteneurs sains, `migrate` en `Exited (0)`
- [ ] Cadenas HTTPS sur `https://<DOMAINE>`
- [ ] Super admin créé, admins créés depuis l’interface
- [ ] Les dix contrôles de l’étape 12 réussis (sondage compris, le lendemain)
- [ ] Test de charge passé, invités `charge.*@test.ci` supprimés, envoi SMTP rétabli
- [ ] Phrase de chiffrement des sauvegardes conservée hors du serveur
- [ ] Sauvegarde chiffrée nocturne programmée et vérifiée
- [ ] Restauration testée au moins une fois
- [ ] Sauvegardes rapatriées sur un poste MDE
- [ ] Durée de conservation et contact données personnelles réglés, page `/confidentialite` vérifiée
- [ ] Démarches ARTCI vérifiées avec le service juridique
- [ ] Sonde de disponibilité en place (facultatif)

## Sources

Documentation Infomaniak consultée le 2026-10-22 :

- Offre et prix VPS Lite (formule 2 vCPU / 4 Go / 60 Go affichée autour de 7 CHF/mois en paiement annuel,
  à revérifier) : https://www.infomaniak.com/fr/hebergement/vps-lite
- Première connexion SSH, utilisateurs par défaut (`ubuntu` pour Ubuntu), clé créée ou importée à la
  commande, `chmod 400` : https://www.infomaniak.com/fr/support/faq/1973/se-connecter-en-ssh-1ere-connexion-vps-cloud-vps-lite-linux
- Pare-feu VPS Cloud / VPS Lite (menu **Firewall**, « Ajouter une règle », « Sélection manuelle » ; port 25
  sortant bloqué sur VPS Lite) : https://www.infomaniak.com/fr/support/faq/2822/gerer-le-pare-feu-vps-cloud-vps-lite

Autres :

- Deploy keys GitHub : https://docs.github.com/fr/authentication/connecting-to-github-with-ssh/managing-deploy-keys
- Installation de Docker sur Ubuntu : https://docs.docker.com/engine/install/ubuntu/

Non confirmé par la documentation lue : le chemin exact du menu qui affiche l’IP, le libellé exact du champ
de clé SSH à la commande, la présence d’une règle SSH par défaut dans le pare-feu, et la saisie TCP/UDP dans
le formulaire de règle. Ces points sont décrits « tels qu’ils peuvent s’appeler ».

Dans le dépôt (le code fait foi) : `docker-compose.prod.yml`, `infra/Caddyfile.prod`, `.env.example`,
`backend/config/settings.py`, `README.md` (§ 7), `infra/charge/README.md`.

## Liens

- Exploitation générale : [deployment](deployment.md), [setup](setup.md)
- Architecture : [system-overview](../architecture/system-overview.md), [integrations](../architecture/integrations.md)
- Envoi du sondage par Celery beat : [ADR-012](../decisions/ADR-012-sondage-satisfaction.md)
- Risques et dette : [risques-et-dette](../project/risques-et-dette.md)
- Données personnelles : [donnees-personnelles](../features/donnees-personnelles.md), [ADR-013](../decisions/ADR-013-conservation-limitee-anonymisation.md)
