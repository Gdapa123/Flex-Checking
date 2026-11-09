import { describe, expect, it } from 'vitest';
import { preparerCarte, tailleLisible, TAILLE_MAX } from '../src/lib/carteInvitation';

// miroir de `cartes_invitation.preparer` (backend) : JPEG, PNG ou PDF, 1,8 Mo au plus
describe('carte d’invitation', () => {
  it('PDF envoyé tel quel, en base64', async () => {
    const pdf = new File(['%PDF-1.4\n%%EOF\n'], 'Carte PMD.pdf', { type: 'application/pdf' });
    const r = await preparerCarte(pdf);
    expect(r.nom).toBe('Carte PMD.pdf');
    expect(atob(r.contenu)).toBe('%PDF-1.4\n%%EOF\n');
  });

  it('refuse un autre format et un PDF trop lourd', async () => {
    const svg = new File(['<svg/>'], 'carte.svg', { type: 'image/svg+xml' });
    await expect(preparerCarte(svg)).rejects.toThrow('Format non accepté');
    const lourd = new File([new Uint8Array(TAILLE_MAX + 1)], 'lourd.pdf', { type: 'application/pdf' });
    await expect(preparerCarte(lourd)).rejects.toThrow('1,8 Mo');
  });

  it('taille lisible', () => {
    expect(tailleLisible(350_000)).toBe('350 ko');
    expect(tailleLisible(1_234_567)).toBe('1,2 Mo');
  });
});
