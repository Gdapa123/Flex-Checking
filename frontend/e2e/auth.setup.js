import { expect, test as setup } from '@playwright/test';
import { SESSION_ADMIN } from '../playwright.config.js';

// Une seule connexion admin pour les tests qui réutilisent la session (cookies httpOnly enregistrés localement,
// dossier ignoré par git) ; le parcours complet garde sa propre connexion, qui teste l'écran de connexion.
setup('connexion admin enregistrée', async ({ page }) => {
  const mdp = process.env.DEMO_MOT_DE_PASSE_ADMIN;
  expect(mdp, 'définir DEMO_MOT_DE_PASSE_ADMIN (fichier .env ou CI)').toBeTruthy();
  await page.goto('/connexion');
  await page.getByLabel('Email').fill('mariam.kone@mde.ci');
  await page.getByLabel('Mot de passe', { exact: true }).fill(mdp);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Vos cérémonies' })).toBeVisible();
  await page.context().storageState({ path: SESSION_ADMIN });
});
