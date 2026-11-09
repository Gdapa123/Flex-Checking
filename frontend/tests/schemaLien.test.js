import { describe, expect, it } from 'vitest';
import { schemaLien, schemaLiensCeremonie } from '../src/lib/schemas';

// miroir de `validation.valider_lien` (backend) : vide, ou http(s) sans espace
describe('liens d’une cérémonie', () => {
  it.each(['', 'https://mde.ci', 'http://mde.ci/magazine/pmd-2026', 'https://drive.google.com/file/d/abc/view'])(
    'accepte %s',
    (v) => expect(schemaLien.safeParse(v).success).toBe(true),
  );

  it.each(['javascript:alert(1)', 'mde.ci', 'https:// mde.ci', 'ftp://mde.ci/fichier', 'https://mde.ci/a b'])(
    'refuse %s',
    (v) => expect(schemaLien.safeParse(v).success).toBe(false),
  );

  it('signale le champ fautif', () => {
    const r = schemaLiensCeremonie.safeParse({ lienMagazine: '', lienBrochure: 'brochure' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].path).toEqual(['lienBrochure']);
  });
});
