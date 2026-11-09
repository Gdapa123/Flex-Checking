import { expect, test } from '@playwright/test';
import zlib from 'node:zlib';

// Carte d'invitation du programme (SA5) : un fichier téléversé, pas un lien ; jointe au .ics des invités.
const SUPER = { email: 'direction.evenements@mde.ci', mdp: process.env.DEMO_MOT_DE_PASSE_SUPER_ADMIN };

/** PNG valide de 2 × 2 pixels, construit sans dépendance. */
function png() {
  const crc = (buf) => {
    let c = ~0;
    for (const o of buf) {
      c ^= o;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const bloc = (type, donnees) => {
    const t = Buffer.concat([Buffer.from(type), donnees]);
    const l = Buffer.alloc(4);
    l.writeUInt32BE(donnees.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(t));
    return Buffer.concat([l, t, c]);
  };
  const ihdr = Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
  const lignes = Buffer.from([0, 200, 30, 30, 200, 30, 30, 0, 200, 30, 30, 200, 30, 30]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', zlib.deflateSync(lignes)),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

test('super admin : carte d’invitation téléversée, jointe au .ics, puis retirée', async ({ browser, baseURL }) => {
  test.skip(!SUPER.mdp, 'définir DEMO_MOT_DE_PASSE_SUPER_ADMIN');
  const contexte = await browser.newContext({ locale: 'fr-FR', baseURL, storageState: undefined });
  const p = await contexte.newPage();
  await p.goto('/super/connexion');
  await p.getByLabel('Email').fill(SUPER.email);
  await p.getByLabel('Mot de passe', { exact: true }).fill(SUPER.mdp);
  await p.getByRole('button', { name: 'Se connecter' }).click();
  await p.waitForURL((url) => url.pathname.startsWith('/super') && !url.pathname.includes('connexion'));

  const evenements = await p.evaluate(() => fetch('/api/evenements/').then((r) => r.json()));
  const ev = evenements.find((e) => e.programmeNom === 'PMD' && e.etatInscriptions === 'OUVERT');
  await p.goto(`/super/evenements/${ev.id}`);
  await p.getByLabel('Carte d’invitation du programme').setInputFiles({
    name: 'carte-pmd.png',
    mimeType: 'image/png',
    buffer: png(),
  });
  await expect(p.getByRole('link', { name: /carte-pmd\.png/ })).toBeVisible();

  const ics = await p.evaluate(
    (slug) => fetch(`/api/public/evenements/${slug}/agenda.ics`).then((r) => r.text()),
    ev.slugInscription,
  );
  expect(ics).toContain('ATTACH;FMTTYPE=image/png:');
  expect(ics).toContain(`/api/public/evenements/${ev.slugInscription}/carte-invitation/`);

  await p.getByRole('button', { name: 'Retirer la carte' }).click();
  await expect(p.getByRole('link', { name: /carte-pmd\.png/ })).toBeHidden();
  await contexte.close();
});
