import { expect, test } from '@playwright/test';

/**
 * Affichage sur tout type d'écran : chaque écran principal est ouvert du petit téléphone (320 px) au grand écran
 * (1920 px). Aucun ne doit défiler horizontalement ni avoir d'élément qui dépasse du bord (hors zones prévues pour
 * défiler : tableaux, onglets).
 */
const LARGEURS = [
  [320, 640],
  [375, 740],
  [414, 860],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1920, 1080],
];

/**
 * Éléments qui dépassent du bord de la fenêtre, ou qui sont coupés par un conteneur masquant (`overflow: hidden`) :
 * seuls les conteneurs défilants (`auto`, `scroll` : tableaux, onglets) peuvent contenir plus large qu'eux.
 */
function debordements() {
  const vw = document.documentElement.clientWidth;
  const resultat = [];
  const decrire = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 4).join('.')}` : '';
    const texte = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '')
      .trim()
      .slice(0, 40)
      .replace(/\s+/g, ' ');
    return `${el.tagName.toLowerCase()}${id}${cls} « ${texte} »`;
  };
  const visible = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const st = getComputedStyle(n);
      if (st.visibility === 'hidden' || st.display === 'none' || n.inert || n.getAttribute('aria-hidden') === 'true')
        return false;
    }
    return true;
  };
  // borne horizontale imposée à l'élément : premier ancêtre masquant (sa propre boîte), sinon la fenêtre ; null si un
  // ancêtre défile (tableau, onglets : contenu plus large prévu)
  const borne = (el) => {
    let bornePar = null;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return null;
      if (!bornePar && (ox === 'hidden' || ox === 'clip')) bornePar = p;
    }
    if (!bornePar) return { gauche: 0, droite: vw, conteneur: null };
    const r = bornePar.getBoundingClientRect();
    return { gauche: r.left, droite: r.right, conteneur: bornePar };
  };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue; // texte réservé aux lecteurs d'écran (sr-only) compris
    const b = borne(el);
    if (!b || (r.right <= b.droite + 1 && r.left >= b.gauche - 1)) continue;
    if (!visible(el)) continue;
    // ne garder que l'élément le plus haut qui dépasse de la même borne
    const parent = el.parentElement;
    if (parent && parent !== b.conteneur) {
      const rp = parent.getBoundingClientRect();
      if (rp.right > b.droite + 1 || rp.left < b.gauche - 1) continue;
    }
    resultat.push(
      `${decrire(el)} (${Math.round(r.left)}→${Math.round(r.right)}, borne ${Math.round(b.gauche)}→${Math.round(b.droite)})`,
    );
  }
  const page =
    document.documentElement.scrollWidth > vw + 1
      ? [`page : largeur ${document.documentElement.scrollWidth} / ${vw}`]
      : [];
  return [...page, ...resultat.slice(0, 6)];
}

async function connecterSuperAdmin(page) {
  expect(process.env.DEMO_MOT_DE_PASSE_SUPER_ADMIN, 'définir DEMO_MOT_DE_PASSE_SUPER_ADMIN').toBeTruthy();
  await page.goto('/super/connexion');
  await page.getByLabel('Email').fill('direction.evenements@mde.ci');
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.DEMO_MOT_DE_PASSE_SUPER_ADMIN);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('heading', { name: 'Vue globale' }).waitFor();
}

async function controler(page, nom, problemes) {
  await page.evaluate(() => document.fonts.ready); // polices chargées : largeurs de texte définitives
  await page.waitForTimeout(300);
  const d = await page.evaluate(debordements);
  if (d.length) problemes.push(`${page.viewportSize().width}px ${nom}\n    ${d.join('\n    ')}`);
}

test('aucun écran ne déborde, du téléphone au grand écran', async ({ page }) => {
  test.setTimeout(240_000);
  await connecterSuperAdmin(page);

  const evenements = await page.evaluate(() => fetch('/api/evenements/').then((r) => r.json()));
  const pmd = evenements.find((e) => e.programmeNom === 'PMD' && e.etatInscriptions === 'OUVERT') || evenements[0];
  const ev = evenements.find((e) => e.statut === 'AUJOURDHUI') || evenements[0];

  const ecrans = [
    '/connexion',
    '/confidentialite',
    `/i/${pmd.slugInscription}`,
    `/i/${pmd.slugInscription}/pratique`,
    '/super',
    '/super/programmes',
    '/super/evenements',
    '/super/invites',
    '/super/admins',
    '/super/parametres',
    '/super/journal',
    '/super/analyses',
    '/super/erreurs',
    '/admin',
    `/admin/evenements/${ev.id}`,
    `/admin/evenements/${ev.id}/invites`,
    `/admin/evenements/${ev.id}/emails`,
    '/scan',
  ];

  const problemes = [];
  for (const [largeur, hauteur] of LARGEURS) {
    await page.setViewportSize({ width: largeur, height: hauteur });
    for (const url of ecrans) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      const d = await page.evaluate(debordements);
      if (d.length) problemes.push(`${largeur}px ${url}\n    ${d.join('\n    ')}`);
    }
  }
  console.log(`${ecrans.length * LARGEURS.length} affichages contrôlés`);
  expect(problemes, problemes.join('\n')).toEqual([]);
});

test('écrans ouverts par une action : poste de scan, fiche et ajout d’invité', async ({ page }) => {
  test.setTimeout(240_000);
  await connecterSuperAdmin(page);
  const evenements = await page.evaluate(() => fetch('/api/evenements/').then((r) => r.json()));
  const ev = evenements.find((e) => e.programmeNom === 'PMD' && e.etatInscriptions === 'OUVERT') || evenements[0];

  const problemes = [];
  for (const largeur of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width: largeur, height: largeur < 768 ? 720 : 900 });
    for (const mode of ['Code 4 chiffres', 'Manuel', 'Douchette']) {
      await page.goto('/scan');
      await page.getByRole('radio', { name: new RegExp(ev.nomAffiche) }).click();
      await page.getByRole('radio', { name: mode }).click();
      await page.getByRole('button', { name: 'Démarrer l’émargement' }).click();
      await page.waitForURL(/\/scan\/.+/);
      await controler(page, `poste de scan · ${mode}`, problemes);
    }
    await page.goto(`/admin/evenements/${ev.id}/invites`);
    await page.getByRole('button', { name: 'Ajouter un invité' }).first().click();
    await page.getByRole('heading', { name: 'Ajouter un invité' }).waitFor();
    await controler(page, 'panneau « Ajouter un invité »', problemes);
    await page.keyboard.press('Escape');
    // tableau à partir de 1024 px (`lg`), liste de cartes en dessous
    const ligne =
      largeur >= 1024
        ? page.locator('tbody tr').first().locator('td').nth(2)
        : page.locator('ul li button.text-left').first();
    await ligne.click();
    await page.getByRole('dialog').waitFor();
    await controler(page, 'fiche invité', problemes);
  }
  expect(problemes, problemes.join('\n')).toEqual([]);
});
