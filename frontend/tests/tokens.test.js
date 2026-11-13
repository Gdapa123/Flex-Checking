import { describe, expect, it } from 'vitest';
import fixtures from '../../shared/token-fixtures.json';
import { contraste, controlesContraste, deriverTokens, logoBlanc, variablesCss } from '../src/theme/tokens';

describe('deriverTokens — cas de référence partagés avec Python', () => {
  for (const cas of fixtures.cas) {
    it(cas.nom, () => {
      const t = deriverTokens(cas.principale, cas.secondaire, cas.texte, cas.titres);
      for (const [cle, attendu] of Object.entries(cas.attendu)) expect(t[cle], cle).toBe(attendu);
    });
  }
  it('contrastes', () => {
    for (const c of fixtures.contrastes) expect(Math.round(contraste(c.a, c.b) * 100) / 100).toBe(c.ratio);
  });
});

describe('variables et contrôles', () => {
  it('pose les 9 variables', () => {
    expect(Object.keys(variablesCss('#8F1C1F', '#F7941D'))).toHaveLength(9);
  });
  it('alerte si la principale est trop claire pour du texte blanc', () => {
    const c = controlesContraste('#F5CB23', '#FAEE8B');
    expect(c.find((x) => x.cle === 'pblanc').ok).toBe(false);
    expect(c.find((x) => x.cle === 'onp').ok).toBe(true);
  });
});

describe('couleurs du texte et des titres choisies (2026-11-10)', () => {
  it('remplacent le texte automatique et les titres par défaut', () => {
    const v = variablesCss('#8F1C1F', '#F7941D', '#FFF8E0', '#123456');
    expect(v['--op']).toBe('#FFF8E0');
    expect(v['--ti']).toBe('#123456');
  });
  it('alertent si les titres se lisent mal sur fond blanc', () => {
    expect(controlesContraste('#8F1C1F', '#F7941D', '', '#F2F2F2').find((c) => c.cle === 'titres').ok).toBe(false);
    expect(controlesContraste('#8F1C1F', '#F7941D').find((c) => c.cle === 'titres').ok).toBe(true);
  });
  it('le logo suit le fond, pas la couleur de texte choisie', () => {
    expect(logoBlanc('#8F1C1F')).toBe(true);
    expect(logoBlanc('#F5CB23')).toBe(false);
  });
});
