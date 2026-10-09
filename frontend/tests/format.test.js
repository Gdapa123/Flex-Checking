import { describe, expect, it } from 'vitest';
import { dateBandeau, dateCourte, dateLongue, heure, heureTexte, jourHeure } from '../src/lib/format';

describe('formats français, fuseau Africa/Abidjan', () => {
  it('dates', () => {
    expect(dateLongue('2026-11-14')).toBe('Samedi 14 novembre 2026');
    expect(dateCourte('2026-11-14')).toBe('Sam. 14 nov. 2026');
    expect(dateBandeau('2026-11-14')).toBe('Sam. 14.11');
  });
  it('heures', () => {
    expect(heureTexte('18:00:00')).toBe('18h00');
    expect(heure('2026-11-14T18:42:10Z')).toBe('18h42');
    expect(jourHeure('2026-11-14T18:42:10Z')).toBe('14/11/2026 18:42');
  });
});
