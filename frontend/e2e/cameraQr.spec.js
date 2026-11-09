import { expect, test } from '@playwright/test';
import path from 'node:path';
import { SESSION_ADMIN } from '../playwright.config.js';

/**
 * Lecture par la vraie caméra (ZXing) : Chromium reçoit une fausse caméra qui filme un QR code piégé
 * (lien « https://site-piege.example/connexion », fichier généré `fixtures/qr-lien-piege.mjpeg`).
 */
const VIDEO = path.resolve('e2e/fixtures/qr-lien-piege.mjpeg');

test.use({
  storageState: SESSION_ADMIN, // session de auth.setup.js : pas de nouvelle connexion
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO}`,
    ],
  },
});

test('caméra : un QR code piégé affiche « QR code non reconnu », sans envoi ni ouverture', async ({ page }) => {
  await page.goto('/scan');
  const evenements = await page.evaluate(() => fetch('/api/evenements/').then((r) => r.json()));
  const ev = evenements.find((e) => e.programmeNom === 'PMD' && e.etatInscriptions === 'OUVERT');
  expect(ev, 'un événement PMD ouvert doit exister (seed_demo)').toBeTruthy();

  const emargements = [];
  page.on('request', (r) => {
    if (r.url().includes('/emargement/')) emargements.push(r.url());
  });
  await page.goto('/scan');
  await page.getByRole('radio', { name: new RegExp(ev.nomAffiche) }).click();
  await page.getByRole('radio', { name: 'QR caméra' }).click();
  await page.getByRole('radio', { name: 'Téléphone' }).click();
  await page.getByRole('button', { name: 'Démarrer l’émargement' }).click();

  await expect(page.getByText('QR code non reconnu').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/contient un lien, ce n’est pas une invitation : ne l’ouvrez pas/)).toBeVisible();
  expect(page.url()).toContain('/scan/');
  expect(page.context().pages()).toHaveLength(1); // aucun onglet ouvert
  expect(emargements).toHaveLength(0); // rien envoyé au serveur
});
