import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Audit axe-core (WCAG 2.1 AA) des écrans principaux : aucune violation sérieuse ou critique. */
async function auditer(page, url, attendre) {
  await page.goto(url);
  await attendre();
  await page.waitForTimeout(400);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations
    .filter((v) => ['serious', 'critical'].includes(v.impact))
    .map((v) => `${url} · ${v.id} (${v.impact}) : ${v.nodes.length} élément(s) — ${v.nodes[0].target.join(' ')}`);
}

test('accessibilité des écrans principaux', async ({ page }) => {
  const problemes = [];
  // Public
  const evts = await page.request.get('/api/public/evenements/inexistant/');
  expect(evts.status()).toBe(404);
  problemes.push(
    ...(await auditer(page, '/connexion', () =>
      page.getByRole('heading', { name: 'Espace administrateur' }).waitFor(),
    )),
  );
  problemes.push(
    ...(await auditer(page, '/super/connexion', () =>
      page.getByRole('heading', { name: 'Configuration globale' }).waitFor(),
    )),
  );
  problemes.push(
    ...(await auditer(page, '/i/inexistant', () =>
      page.getByRole('heading', { name: 'Ce lien n’est plus valide' }).waitFor(),
    )),
  );

  // Connexion super admin (accès à tous les espaces)
  await page.getByRole('link', { name: 'Aller sur mde.ci' }).waitFor();
  await page.goto('/super/connexion');
  await page.getByLabel('Email').fill('direction.evenements@mde.ci');
  expect(
    process.env.DEMO_MOT_DE_PASSE_SUPER_ADMIN,
    'définir DEMO_MOT_DE_PASSE_SUPER_ADMIN (fichier .env ou CI)',
  ).toBeTruthy();
  await page.getByLabel('Mot de passe').fill(process.env.DEMO_MOT_DE_PASSE_SUPER_ADMIN);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('heading', { name: 'Vue globale' }).waitFor();

  const evenements = await page.evaluate(() => fetch('/api/evenements/').then((r) => r.json()));
  const pmd = evenements.find((e) => e.programmeNom === 'PMD' && e.etatInscriptions === 'OUVERT');
  const encours = evenements.find((e) => e.statut === 'AUJOURDHUI') || evenements[0];

  problemes.push(
    ...(await auditer(page, `/i/${pmd.slugInscription}`, () =>
      page.getByRole('heading', { name: pmd.nomAffiche }).waitFor(),
    )),
  );
  problemes.push(
    ...(await auditer(page, `/i/${pmd.slugInscription}/pratique`, () =>
      page.getByRole('heading', { name: 'Itinéraire' }).waitFor(),
    )),
  );
  const ecrans = [
    ['/super', 'Vue globale'],
    ['/super/programmes', 'Programmes'],
    ['/super/evenements', 'Cérémonies'],
    ['/super/invites', 'Tous les invités'],
    ['/super/admins', 'Comptes admins'],
    ['/super/parametres', 'Paramètres'],
    ['/super/journal', 'Exports et journal d’activité'],
    ['/super/analyses', 'Analyses'],
    ['/super/analyses?onglet=technique', 'Analyses'],
    ['/super/erreurs', 'Erreurs techniques'],
    ['/admin', 'Vos cérémonies'],
    [`/admin/evenements/${encours.id}`, 'Tableau de bord'],
    [`/admin/evenements/${encours.id}/invites`, 'Gestion des invités'],
    ['/scan', 'Démarrer l’émargement'],
  ];
  for (const [url, titre] of ecrans)
    problemes.push(
      ...(await auditer(page, url, () => page.getByRole('heading', { name: titre, exact: true }).first().waitFor())),
    );

  expect(problemes, problemes.join('\n')).toEqual([]);
});
