import { describe, expect, it } from 'vitest';
import { cheminInterne } from '../src/features/auth/FormulaireConnexion';

describe('retour après connexion', () => {
  it('accepte un chemin interne', () => {
    expect(cheminInterne('/admin/evenements/2?q=x')).toBe('/admin/evenements/2?q=x');
  });
  it.each([
    '//pirate.example',
    '/\\pirate.example',
    '/admin\\..\\pirate',
    'https://pirate.example',
    'javascript:alert(1)',
    '',
    null,
    '/a\u0000b',
  ])('refuse « %s »', (chemin) => {
    expect(cheminInterne(chemin)).toBeNull();
  });
});
