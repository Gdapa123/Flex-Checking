import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DOSSIER_EMAILS } from '../playwright.config.js';

const ADMIN = { email: 'mariam.kone@mde.ci', mdp: process.env.DEMO_MOT_DE_PASSE_ADMIN };

/** Cherche, dans les emails écrits par Django, celui adressé à `dest` et contenant `motif`. */
async function attendreEmail(dest, motif) {
  for (let i = 0; i < 40; i++) {
    const fichiers = fs.existsSync(DOSSIER_EMAILS) ? fs.readdirSync(DOSSIER_EMAILS) : [];
    for (const f of fichiers) {
      const contenu = fs.readFileSync(path.join(DOSSIER_EMAILS, f), 'utf8');
      if (contenu.includes(`To: ${dest}`) && motif.test(contenu)) return contenu;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Email introuvable pour ${dest}`);
}

async function connexion(page) {
  expect(ADMIN.mdp, 'définir DEMO_MOT_DE_PASSE_ADMIN (fichier .env ou CI)').toBeTruthy();
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(ADMIN.mdp);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Vos cérémonies' })).toBeVisible();
}

/** Connexion admin puis événement ouvert aux inscriptions (Graduation PMD de l'année, créée par seed_demo). */
async function evenementPmdOuvert(page) {
  await connexion(page);
  const evenements = await page.evaluate(() => fetch('/api/evenements/').then((r) => r.json()));
  const ev = evenements.find((e) => e.programmeNom === 'PMD' && e.etatInscriptions === 'OUVERT');
  expect(ev, 'un événement PMD ouvert doit exister (seed_demo)').toBeTruthy();
  return ev;
}

/** Tableau des invités de l'événement, filtré sur `email`. */
function urlInvites(ev, email) {
  return `/admin/evenements/${ev.id}/invites?q=${encodeURIComponent(email)}`;
}

test('inscription → email 1 → scan par code → Présent → email 2 → tableau admin → export', async ({
  page,
  browser,
  baseURL,
}) => {
  const ev = await evenementPmdOuvert(page);
  const email = `e2e.${Date.now()}@sib.ci`;

  await test.step('inscription (contexte public, sans session)', async () => {
    const invite = await browser.newContext({ locale: 'fr-FR', baseURL });
    const p = await invite.newPage();
    await p.goto(`/i/${ev.slugInscription}`);
    await expect(p.getByRole('heading', { name: ev.nomAffiche })).toBeVisible();
    await expect(p.getByRole('heading', { name: 'Comment ça se passe ?' })).toBeVisible();
    await p.getByRole('button', { name: 'Commencer mon inscription' }).click();
    await p.getByRole('button', { name: 'Confirmer mon inscription' }).click();
    await expect(p.getByText(/informations à compléter/)).toBeVisible(); // validation
    await p.getByRole('radio', { name: 'Mme' }).click();
    const champs = {
      Nom: 'Kouassi',
      Prénom: 'Aya',
      Email: email,
      Téléphone: '0712345678',
      Entreprise: 'SIB',
      Fonction: 'Directrice financière',
    };
    for (const [libelle, valeur] of Object.entries(champs)) {
      await p.getByLabel(libelle, { exact: true }).fill(valeur);
    }
    await p.getByLabel(/J’accepte/).check();
    await p.getByRole('button', { name: 'Confirmer mon inscription' }).click();
    await expect(p.getByRole('heading', { name: 'Inscription réussie' })).toBeVisible();
    await expect(p.getByText('Inscrit·e')).toBeVisible();
    // Infos pratiques affichées sous la confirmation : agenda (liens pré-remplis) et itinéraire
    const agenda = p.getByRole('region', { name: 'Ajouter à mon agenda' });
    await expect(agenda.getByRole('link', { name: /Google Agenda/ })).toHaveAttribute(
      'href',
      /calendar\.google\.com.*TEMPLATE/,
    );
    await expect(agenda.getByRole('link', { name: /Microsoft 365/ })).toHaveAttribute('href', /outlook\.office\.com/);
    await expect(
      p.getByRole('region', { name: 'Itinéraire' }).getByRole('link', { name: /Google Maps/ }),
    ).toBeVisible();
    await invite.close();
  });

  const code = await test.step('email n°1 : QR (pièce jointe) et code de secours', async () => {
    const email1 = await attendreEmail(email, /Code de secours/);
    expect(email1).toContain('qr-code.png');
    expect(email1).toContain('graduation.ics');
    expect(email1).toContain(`/i/${ev.slugInscription}/pratique#agenda`);
    return /secours[^:]*:\s*(\d{4})/.exec(email1)[1];
  });

  await test.step('scan par code à 4 chiffres', async () => {
    await page.goto('/scan');
    await page.getByRole('radio', { name: new RegExp(ev.nomAffiche) }).click();
    await page.getByRole('radio', { name: 'Code 4 chiffres' }).click();
    await page.getByRole('button', { name: 'Démarrer l’émargement' }).click();
    for (const chiffre of code) await page.getByRole('button', { name: chiffre, exact: true }).click();
    await expect(page.getByText('Présence enregistrée')).toBeVisible();
    await expect(page.getByText('Mme Aya KOUASSI').first()).toBeVisible();
    await expect(page.getByText(/Email n°2 envoyé/)).toBeVisible();
  });

  await test.step("pause au toucher puis retour automatique à l'attente", async () => {
    await page.getByText('Présence enregistrée').click(); // pause
    await page.getByText(/touchez pour reprendre/).click();
    await expect(page.getByText(/Présence enregistrée/)).toBeHidden({ timeout: 10_000 });
  });

  await test.step('email n°2 (magazine)', async () => {
    await attendreEmail(email, /Lire le magazine/);
  });

  await test.step('visible dans le tableau admin au statut Présent', async () => {
    await page.goto(urlInvites(ev, email));
    const ligne = page.getByRole('row', { name: /Aya KOUASSI/ });
    await expect(ligne).toBeVisible();
    await expect(ligne.getByText('Présent', { exact: true })).toBeVisible();
    await expect(ligne.getByText('Code 4 chiffres')).toBeVisible();
  });

  await test.step('export CSV de la vue filtrée', async () => {
    const [telechargement] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'CSV' }).click(),
    ]);
    const csv = fs.readFileSync(await telechargement.path(), 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(email);
    expect(csv).toContain('Présent');
  });
});

test('temps réel : une inscription apparaît chez l’admin sans rechargement', async ({ page, request }) => {
  const ev = await evenementPmdOuvert(page);
  const email = `direct.${Date.now()}@sib.ci`;

  await page.goto(urlInvites(ev, email));
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
