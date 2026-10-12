import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DOSSIER_EMAILS } from '../playwright.config.js';

const ADMIN = { email: 'mariam.kone@mde.ci', mdp: process.env.DEMO_MOT_DE_PASSE_ADMIN };

/** Cherche, dans les emails écrits par Django, celui adressé à `dest` et contenant `motif`. */
async function attendreEmail(dest, motif) {
  for (let i = 0; i < 40; i++) {
    if (fs.existsSync(DOSSIER_EMAILS)) {
      for (const f of fs.readdirSync(DOSSIER_EMAILS)) {
        const contenu = fs.readFileSync(path.join(DOSSIER_EMAILS, f), 'utf8');
        if (contenu.includes(`To: ${dest}`) && motif.test(contenu)) return contenu;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Email introuvable pour ${dest}`);
}

async function connexion(page) {
  expect(ADMIN.mdp, 'définir DEMO_MOT_DE_PASSE_ADMIN (fichier .env ou CI)').toBeTruthy();
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Mot de passe').fill(ADMIN.mdp);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Vos cérémonies' })).toBeVisible();
}

test('inscription → email 1 → scan par code → Présent → email 2 → tableau admin → export', async ({ page, request }) => {
  // Événement ouvert aux inscriptions (Graduation PMD de l'année)
  await connexion(page);
  const evenements = await page.evaluate(() => fetch('/api/evenements/').then((r) => r.json()));
  const ev = evenements.find((e) => e.programmeNom === 'PMD' && e.etatInscriptions === 'OUVERT');
  expect(ev, 'un événement PMD ouvert doit exister (seed_demo)').toBeTruthy();
  const email = `e2e.${Date.now()}@sib.ci`;

  // 1. Inscription (contexte public, sans session)
  const invite = await page.context().browser().newContext({ locale: 'fr-FR' });
  const p = await invite.newPage();
  await p.goto(`http://localhost:5174/i/${ev.slugInscription}`);
  await expect(p.getByRole('heading', { name: ev.nomAffiche })).toBeVisible();
  await expect(p.getByRole('heading', { name: 'Comment ça se passe ?' })).toBeVisible();
  await p.getByRole('button', { name: 'Commencer mon inscription' }).click();
  await p.getByRole('button', { name: 'Confirmer mon inscription' }).click();
  await expect(p.getByText(/champs à corriger/)).toBeVisible(); // validation
  await p.getByRole('radio', { name: 'Mme' }).click();
  await p.getByLabel('Nom', { exact: true }).fill('Kouassi');
  await p.getByLabel('Prénom', { exact: true }).fill('Aya');
  await p.getByLabel('Email', { exact: true }).fill(email);
  await p.getByLabel('Téléphone', { exact: true }).fill('0712345678');
  await p.getByLabel('Entreprise', { exact: true }).fill('SIB');
  await p.getByLabel('Fonction', { exact: true }).fill('Directrice financière');
  await p.getByLabel(/J’accepte/).check();
  await p.getByRole('button', { name: 'Confirmer mon inscription' }).click();
  await expect(p.getByRole('heading', { name: 'Inscription réussie' })).toBeVisible();
  await expect(p.getByText('Inscrit·e')).toBeVisible();
  // Ajouter à l'agenda : Google Agenda ou Microsoft 365, avec liens pré-remplis
  await p.getByRole('button', { name: 'Ajouter à l’agenda' }).click();
  const feuille = p.getByRole('dialog', { name: 'Ajouter à mon agenda' });
  await expect(feuille.getByRole('link', { name: /Google Agenda/ })).toHaveAttribute('href', /calendar\.google\.com.*TEMPLATE/);
  await expect(feuille.getByRole('link', { name: /Microsoft 365/ })).toHaveAttribute('href', /outlook\.office\.com/);
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'Enregistrer l’itinéraire' }).click();
  await expect(p.getByRole('dialog', { name: 'Itinéraire' }).getByRole('link', { name: /Google Maps/ })).toBeVisible();
  await p.keyboard.press('Escape');
  await invite.close();

  // 2. Email n°1 : QR (pièce jointe) et code de secours
  const email1 = await attendreEmail(email, /Code de secours/);
  expect(email1).toContain('qr-code.png');
  expect(email1).toContain('graduation.ics');
  expect(email1).toContain(`/i/${ev.slugInscription}/pratique#agenda`);
  const code = /secours[^:]*:\s*(\d{4})/.exec(email1)[1];

  // 3. Scan par code à 4 chiffres
  await page.goto('/scan');
  await page.getByRole('radio', { name: new RegExp(ev.nomAffiche) }).click();
  await page.getByRole('radio', { name: 'Code 4 chiffres' }).click();
  await page.getByRole('button', { name: 'Démarrer l’émargement' }).click();
  for (const chiffre of code) await page.getByRole('button', { name: chiffre, exact: true }).click();
  await expect(page.getByText('Présence enregistrée')).toBeVisible();
  await expect(page.getByText('Mme Aya KOUASSI').first()).toBeVisible();
  await expect(page.getByText(/Email n°2 envoyé/)).toBeVisible();

  // 4. Pause au toucher puis retour automatique à l'attente
  await page.getByText('Présence enregistrée').click(); // pause
  await page.getByText(/touchez pour reprendre/).click();
  await expect(page.getByText(/Présence enregistrée/)).toBeHidden({ timeout: 10_000 });

  // 5. Email n°2 (magazine)
  await attendreEmail(email, /Lire le magazine/);

  // 6. Visible dans le tableau admin au statut Présent
  await page.goto(`/admin/evenements/${ev.id}/invites?q=${encodeURIComponent(email)}`);
  const ligne = page.getByRole('row', { name: /Aya KOUASSI/ });
  await expect(ligne).toBeVisible();
  await expect(ligne.getByText('Présent', { exact: true })).toBeVisible();
  await expect(ligne.getByText('Code 4 chiffres')).toBeVisible();

  // 7. Export CSV de la vue filtrée
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
  const fichier = await telechargement.path();
  const csv = fs.readFileSync(fichier, 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain(email);
  expect(csv).toContain('Présent');
  void request;
});

test('temps réel : une inscription apparaît chez l’admin sans rechargement', async ({ page, request }) => {
  await connexion(page);
  const evenements = await page.evaluate(() => fetch('/api/evenements/').then((r) => r.json()));
  const ev = evenements.find((e) => e.programmeNom === 'PMD' && e.etatInscriptions === 'OUVERT');
  const email = `direct.${Date.now()}@sib.ci`;

  await page.goto(`/admin/evenements/${ev.id}/invites?q=${encodeURIComponent(email)}`);
  await expect(page.getByText(/En direct/)).toBeVisible(); // WebSocket connecté : interrogation périodique coupée
  await expect(page.getByRole('row', { name: /Yao KONAN/ })).toHaveCount(0);

  const r = await request.post(`/api/public/evenements/${ev.slugInscription}/inscription/`, {
    data: {
      civilite: 'M',
      nom: 'Konan',
      prenom: 'Yao',
      email,
      telephone: '0701020304',
      entreprise: 'SIB',
      fonction: 'Analyste',
      consentementDonnees: true,
    },
  });
  expect(r.status()).toBe(201);
  // sans WebSocket, la liste ne serait rafraîchie par aucune interrogation : l'apparition prouve la notification
  await expect(page.getByRole('row', { name: /Yao KONAN/ })).toBeVisible({ timeout: 4000 });
});
