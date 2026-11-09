import { expect, test } from '@playwright/test';
import { SESSION_ADMIN } from '../playwright.config.js';

/**
 * Écrans admin et scan avec la session admin enregistrée par `auth.setup.js` (aucune nouvelle connexion : la limite
 * serveur de 5 connexions/min par compte reste intacte).
 */
test.use({ storageState: SESSION_ADMIN });

/** Graduation PMD ouverte aux inscriptions (créée par seed_demo). */
async function evenementPmdOuvert(page) {
  await page.goto('/scan');
  const evenements = await page.evaluate(() => fetch('/api/evenements/').then((r) => r.json()));
  const ev = evenements.find((e) => e.programmeNom === 'PMD' && e.etatInscriptions === 'OUVERT');
  expect(ev, 'un événement PMD ouvert doit exister (seed_demo)').toBeTruthy();
  return ev;
}

/** Tableau des invités de l'événement, filtré sur `email`. */
function urlInvites(ev, email) {
  return `/admin/evenements/${ev.id}/invites?q=${encodeURIComponent(email)}`;
}

test('douchette : un QR code étranger (lien piégé) n’est ni envoyé ni ouvert', async ({ page }) => {
  const ev = await evenementPmdOuvert(page);
  const emargements = [];
  page.on('request', (r) => {
    if (r.url().includes('/emargement/')) emargements.push(r.url());
  });
  await page.goto('/scan');
  await page.getByRole('radio', { name: new RegExp(ev.nomAffiche) }).click();
  await page.getByRole('radio', { name: 'Douchette' }).click();
  await page.getByRole('button', { name: 'Démarrer l’émargement' }).click();
  const champ = page.locator('#douchette');
  await champ.fill('https://site-piege.example/connexion');
  await champ.press('Enter');
  await expect(page.getByText('QR code non reconnu').first()).toBeVisible();
  await expect(page.getByText(/contient un lien, ce n’est pas une invitation : ne l’ouvrez pas/)).toBeVisible();
  expect(page.url()).toContain('/scan/');
  expect(page.context().pages()).toHaveLength(1); // aucun onglet ouvert
  expect(emargements).toHaveLength(0); // rien envoyé au serveur
});

test('recherche du scan : une seule requête pour un nom tapé lettre par lettre', async ({ page }) => {
  const ev = await evenementPmdOuvert(page);
  const recherches = [];
  page.on('request', (r) => {
    if (/\/invites\/\?.*q=/.test(r.url())) recherches.push(new URL(r.url()).searchParams.get('q'));
  });
  await page.goto('/scan');
  await page.getByRole('radio', { name: new RegExp(ev.nomAffiche) }).click();
  await page.getByRole('radio', { name: 'Manuel' }).click();
  await page.getByRole('radio', { name: 'Téléphone' }).click();
  await page.getByRole('button', { name: 'Démarrer l’émargement' }).click();
  await page.getByLabel('Nom, prénom ou email').pressSequentially('Kouassi', { delay: 60 });
  await expect(page.getByText(/\d+ résultats?/)).toBeVisible();
  expect(recherches).toEqual(['Kouassi']); // et non « K », « Ko », « Kou »…
});

test('temps réel : une inscription apparaît chez l’admin sans rechargement', async ({ page, playwright, baseURL }) => {
  const ev = await evenementPmdOuvert(page);
  const email = `direct.${Date.now()}@sib.ci`;

  await page.goto(urlInvites(ev, email));
  await expect(page.getByText(/En direct/)).toBeVisible(); // WebSocket connecté : interrogation périodique coupée
  await expect(page.getByRole('row', { name: /Yao KONAN/ })).toHaveCount(0);

  // inscription publique depuis un contexte sans session (comme un invité)
  const anonyme = await playwright.request.newContext({ baseURL });
  const r = await anonyme.post(`/api/public/evenements/${ev.slugInscription}/inscription/`, {
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
  await anonyme.dispose();
  // sans WebSocket, la liste ne serait rafraîchie par aucune interrogation : l'apparition prouve la notification
  await expect(page.getByRole('row', { name: /Yao KONAN/ })).toBeVisible({ timeout: 4000 });
});
