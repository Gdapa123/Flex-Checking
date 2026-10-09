import { describe, expect, it } from 'vitest';
import fixtures from '../../shared/token-fixtures.json';
import { contraste, controlesContraste, deriverTokens, variablesCss } from '../src/theme/tokens';

describe('deriverTokens — cas de référence partagés avec Python', () => {
  for (const cas of fixtures.cas) {
    it(cas.nom, () => {
      const t = deriverTokens(cas.principale, cas.secondaire);
      for (const [cle, attendu] of Object.entries(cas.attendu)) expect(t[cle], cle).toBe(attendu);
    });
  }
  it('contrastes', () => {
    for (const c of fixtures.contrastes) expect(Math.round(contraste(c.a, c.b) * 100) / 100).toBe(c.ratio);
  });
});

describe('variables et contrôles', () => {
  it('pose les 8 variables', () => {
    expect(Object.keys(variablesCss('#8F1C1F', '#F7941D'))).toHaveLength(8);
  });
  it('alerte si la principale est trop claire pour du texte blanc', () => {
    const c = controlesContraste('#F5CB23', '#FAEE8B');
    expect(c.find((x) => x.cle === 'pblanc').ok).toBe(false);
    expect(c.find((x) => x.cle === 'onp').ok).toBe(true);
  });
});
