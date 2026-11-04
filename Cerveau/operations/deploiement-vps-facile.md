---
type: operations
statut: partiel
verifie: 2026-11-03
commit: 107d1f8
sources: [infra/vps/commun.sh, infra/vps/preparer-serveur.sh, infra/vps/installer.sh, infra/vps/activer-sauvegardes.sh, infra/vps/sauvegarde.sh, infra/vps/restaurer.sh, infra/vps/mettre-a-jour.sh, docker-compose.prod.yml, infra/Caddyfile.prod, backend/apps/comptes/models.py]
---

# Mettre Flex’Checking en ligne sur un VPS Lite — version facile

**8 étapes, environ 1 h 30** (plus l’attente du DNS). Les commandes compliquées sont faites par des scripts
du dépôt (`infra/vps/`) : vous n’avez qu’à **copier-coller** les lignes grises et répondre aux questions.

Le guide détaillé, avec chaque commande expliquée et tous les cas d’erreur, reste disponible :
[deploiement-infomaniak](deploiement-infomaniak.md).

> Statut : les scripts d’installation, de sauvegarde, de restauration et de mise à jour ont été testés le
> 2026-11-02 sur une copie locale (Ubuntu 24.04 en conteneur, domaine `localhost`). `preparer-serveur.sh`
> (mise à jour du système, swap, Docker, SSH) n’a pas pu être testé hors d’un vrai serveur. Aucun VPS réel
> n’a encore été installé avec ce guide.

---

## Ce qu’il faut avoir sous la main

- Un **Mac** (application **Terminal** : Cmd + Espace, tapez « Terminal », Entrée).
- Un accès au **Manager Infomaniak** (pour commander le serveur).
- Un accès à la **zone DNS** de `mde.ci` (ou le service informatique de MDE).
- Le **compte email d’envoi** : adresse (ex. `evenements@mde.ci`), son **mot de passe**, et le nom du
  **serveur SMTP** (ex. `mail.infomaniak.com`, demandez au service informatique).
- L’**adresse du site** retenue : `inscription.mde.ci` (décision du 2026-11-04).

Dans ce guide, remplacez `IP_DU_VPS` par l’adresse IP du serveur (étape 2).

---

## Étape 1 — Créer votre clé SSH (sur le Mac, 2 min)

La clé SSH remplace le mot de passe pour entrer sur le serveur. Dans le Terminal du Mac :

```bash
ls ~/.ssh/id_ed25519.pub || ssh-keygen -t ed25519 -C "flex-checking-mde"
```

- Si on vous pose des questions : **Entrée** pour l’emplacement, puis choisissez une phrase secrète (deux
  fois) et rangez-la dans le coffre de mots de passe de MDE.

Puis copiez la clé **publique** :

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

Rien ne s’affiche : c’est normal, la clé est copiée.

## Étape 2 — Commander le VPS Lite (navigateur, 15 min)

1. Page <https://www.infomaniak.com/fr/hebergement/vps-lite> : formule **2 vCPU / 4 Go de RAM**.
2. Système : **Ubuntu 24.04**.
3. Clé SSH : choisissez **importer** votre clé et collez-la (**Cmd + V**).
4. Une fois le serveur livré, ouvrez-le dans le Manager et **notez son adresse IPv4** : c’est `IP_DU_VPS`.

## Étape 3 — Ouvrir le pare-feu (navigateur, 5 min)

Manager Infomaniak › votre VPS › **Firewall** › **Ajouter une règle** (« Sélection manuelle »), une règle par
ligne :

| Port | Protocole |
|---|---|
| 22 | TCP |
| 80 | TCP |
| 443 | TCP |
| 443 | UDP |

N’ouvrez **rien d’autre**.

## Étape 4 — Créer l’adresse du site (DNS, 5 min + attente)

Dans la zone DNS de `mde.ci`, ajoutez **un seul** enregistrement :

- type **A**, nom **`inscription`**, valeur **`IP_DU_VPS`**.

Ne touchez à aucun autre enregistrement. Vérifiez depuis le Terminal du Mac (recommencez toutes les
15 minutes jusqu’à voir l’IP du serveur) :

```bash
dig +short inscription.mde.ci
```

⚠️ Attendez que cette commande affiche `IP_DU_VPS` **avant l’étape 6** (sinon le cadenas HTTPS ne peut pas
être obtenu).

## Étape 5 — Se connecter et préparer le serveur (15 min)

Dans le Terminal du Mac :

```bash
ssh ubuntu@IP_DU_VPS
```

Première fois : tapez `yes`, Entrée. Vous êtes sur le serveur quand l’invite devient `ubuntu@…:~$`.

Copiez-collez ces lignes **sur le serveur** :

```bash
sudo mkdir -p /opt/flex-checking && sudo chown ubuntu: /opt/flex-checking
git clone https://github.com/Gdapa123/Flex-Checking.git /opt/flex-checking
cd /opt/flex-checking
sudo infra/vps/preparer-serveur.sh
```

Le script met le système à jour, installe Docker et les protections, ajoute de la mémoire de secours et
interdit les connexions par mot de passe. Il se termine par **« ✓ Serveur prêt »**.

Ensuite, **comme le script le demande** :

1. ouvrez une **nouvelle** fenêtre du Terminal (Cmd + N) et vérifiez que `ssh ubuntu@IP_DU_VPS` fonctionne ;
2. dans l’ancienne fenêtre, tapez `exit` ;
3. si le script a demandé un redémarrage : avant `exit`, tapez `sudo reboot`, attendez 1 minute.

## Étape 6 — Installer l’application (20 min)

Reconnectez-vous puis lancez l’installation :

```bash
ssh ubuntu@IP_DU_VPS
cd /opt/flex-checking
infra/vps/installer.sh
```

Le script pose **4 questions** :

| Question | Exemple |
|---|---|
| 1. Adresse du site | `inscription.mde.ci` |
| 2. Adresse email d’envoi | `evenements@mde.ci` |
| 3. Serveur d’envoi SMTP | `mail.infomaniak.com` |
| 4. Mot de passe du compte email (ne s’affiche pas pendant la frappe) | — |

Puis il construit et démarre tout (10 à 15 minutes la première fois). À la fin, il crée le **premier super
admin** : tapez son email, son nom complet, puis deux fois un mot de passe (10 caractères minimum, il ne
s’affiche pas).

Il se termine par **« ✓ Installation terminée »** et l’adresse de connexion.

- Les secrets (clé de l’application, mots de passe de la base) sont fabriqués au hasard et rangés dans le
  fichier `.env` du serveur. Vous n’avez pas besoin de les connaître. **Ne partagez jamais ce fichier.**
- Si le message « ⚠ Le certificat HTTPS n’est pas encore valide » apparaît : le DNS n’est pas encore prêt
  (étape 4). Attendez 10 minutes, puis `docker compose restart proxy`.

## Étape 7 — Activer les sauvegardes (5 min)

```bash
sudo infra/vps/activer-sauvegardes.sh
```

Le script affiche **une phrase de chiffrement**, une seule fois.
⚠️ **Recopiez-la tout de suite dans le coffre de mots de passe de MDE.** Sans elle, aucune sauvegarde ne
pourra être relue. Appuyez ensuite sur Entrée.

La base est alors sauvegardée, chiffrée, **chaque nuit à 2 h 30** (14 jours gardés), et une première
sauvegarde est faite immédiatement.

## Étape 8 — Vérifier (navigateur, 30 min)

1. Ouvrez `https://inscription.mde.ci/super/connexion` : le **cadenas** est affiché ; connectez-vous avec le
   super admin.
2. Créez les comptes **admins** depuis l’interface.
3. Créez une **cérémonie de test**, inscrivez-vous avec votre propre email : l’email n°1 avec le QR code
   arrive (regardez aussi les indésirables).
4. Sur un téléphone, ouvrez `https://inscription.mde.ci/scan` et scannez le QR : l’email n°2 arrive.
5. Super admin › **Paramètres** › **Données personnelles** : réglez la durée de conservation et l’adresse
   de contact.

Avant la première vraie cérémonie, faites le **test de charge** de l’étape 13 du
[guide détaillé](deploiement-infomaniak.md).

---

## Au quotidien

Toujours depuis le serveur : `ssh ubuntu@IP_DU_VPS` puis `cd /opt/flex-checking`.

| Je veux… | Commande |
|---|---|
| **Mettre à jour** l’application (jamais le jour d’une cérémonie) | `infra/vps/mettre-a-jour.sh` |
| Faire une sauvegarde maintenant | `sudo infra/vps/sauvegarde.sh` |
| Voir les sauvegardes | `ls -lh sauvegardes` |
| **Restaurer** une sauvegarde (remplace les données actuelles) | `sudo infra/vps/restaurer.sh sauvegardes/flex-AAAA-MM-JJ-HHMMSS.sql.gz.gpg` |
| Voir si tout tourne | `docker compose ps -a` |
| Lire les messages d’erreur | `docker compose logs --tail=100 django` (ou `celery`, `proxy`, `mysql`) |

**Copier les sauvegardes sur le Mac** (au moins une fois par semaine et après chaque cérémonie), dans le
Terminal du **Mac** :

```bash
mkdir -p ~/Sauvegardes-Flex && scp "ubuntu@IP_DU_VPS:/opt/flex-checking/sauvegardes/*.gpg" ~/Sauvegardes-Flex/
```

Les fichiers restent chiffrés : gardez-les sur un disque protégé.

## En cas de problème

| Ce que je vois | Que faire |
|---|---|
| `Permission denied (publickey)` en se connectant | la clé n’est pas celle donnée à Infomaniak (étape 2.3) ou l’utilisateur n’est pas `ubuntu` |
| `Operation timed out` en se connectant | port 22 fermé (étape 3) ou mauvaise IP |
| « Docker n’est pas utilisable sans sudo » | tapez `exit`, reconnectez-vous, relancez |
| Pas de cadenas, « certificat pas encore valide » | DNS pas prêt (étape 4) ou ports 80/443 fermés ; puis `docker compose restart proxy` |
| Les emails n’arrivent pas | indésirables ; puis `docker compose logs --tail=100 celery` : `535` = mauvais mot de passe, `timed out` = mauvais serveur SMTP |
| « git pull refusé » pendant une mise à jour | ne forcez rien, prévenez le développeur |
| Autre chose | guide détaillé, [§ 10.5](deploiement-infomaniak.md#105-si-ça-ne-marche-pas) |

Pour changer un réglage (par exemple le mot de passe email) : `nano .env`, modifiez la ligne, **Ctrl + O**,
Entrée, **Ctrl + X**, puis `docker compose up -d`. ⚠️ Ne modifiez jamais `MYSQL_PASSWORD` ni
`MYSQL_ROOT_PASSWORD` après l’installation.

## Ce que font les scripts (pour le développeur)

| Script | Lancé par | Effet |
|---|---|---|
| `infra/vps/preparer-serveur.sh` | `sudo`, une fois | `full-upgrade`, `unattended-upgrades`, `fail2ban`, fuseau `Africa/Abidjan`, swap 2 Go, Docker (`get.docker.com`), utilisateur dans le groupe `docker`, SSH sans mot de passe ni root (seulement si une clé est installée, avec `sshd -t` avant redémarrage) |
| `infra/vps/installer.sh` | utilisateur | écrit `.env` (4 questions, `chmod 600`, secrets `openssl rand`, dimensionnement VPS Lite : `MYSQL_INNODB_BUFFER=512M`, `REDIS_MAXMEMORY=128mb`, `WEB_CONCURRENCY=3`, `CELERY_CONCURRENCY=2`), construit `frontend/dist` dans `node:24-alpine`, `docker compose up -d --build`, attend `/api/sante/`, `createsuperuser` si aucun super admin |
| `infra/vps/activer-sauvegardes.sh` | `sudo`, une fois | phrase `/root/.flex-sauvegarde-phrase`, lien `/usr/local/bin/flex-sauvegarde.sh`, crontab root `30 2 * * *`, première sauvegarde |
| `infra/vps/sauvegarde.sh` | cron root / `sudo` | `mysqldump` → `gzip` → `gpg` AES-256, `sauvegardes/flex-AAAA-MM-JJ-HHMMSS.sql.gz.gpg`, purge après 14 jours |
| `infra/vps/restaurer.sh` | `sudo` | vérifie le déchiffrement, confirmation « RESTAURER », sauvegarde de l’état actuel, restauration depuis une copie temporaire, redémarrage de django / celery |
| `infra/vps/mettre-a-jour.sh` | utilisateur | sauvegarde (`sudo -n`), `git pull --ff-only`, site reconstruit, `docker compose build --pull`, `up -d` (migrations avant Django), contrôle de santé, `docker image prune` |

Tous chargent `infra/vps/commun.sh`. Les mêmes choix que le [guide détaillé](deploiement-infomaniak.md)
(étapes 5, 6, 9, 10, 11, 14), en scripts. Le mot de passe SMTP est écrit entre apostrophes dans `.env`
(aucune interprétation de `$` par Docker Compose) ; une apostrophe dans ce mot de passe est refusée par
le script. L’identifiant SMTP est l’adresse d’envoi ; s’il diffère, corriger `EMAIL_HOST_USER` dans `.env`.

## Liens

- Guide détaillé : [deploiement-infomaniak](deploiement-infomaniak.md)
- Exploitation : [deployment](deployment.md), [setup](setup.md)
- Données personnelles : [donnees-personnelles](../features/donnees-personnelles.md)
