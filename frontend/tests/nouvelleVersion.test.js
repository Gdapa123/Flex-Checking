import { describe, expect, it, vi } from 'vitest';
import { rechargerSiNouvelleVersion } from '../src/lib/nouvelleVersion';

const memoire = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

describe('rechargement après une mise à jour du site', () => {
  it('recharge une fois quand un fichier de l’ancienne version manque', () => {
    const stockage = memoire();
    const recharger = vi.fn();
    const evenement = { preventDefault: vi.fn() };
    expect(rechargerSiNouvelleVersion(evenement, { stockage, recharger, maintenant: 1_000_000 })).toBe(true);
    expect(recharger).toHaveBeenCalledOnce();
    expect(evenement.preventDefault).toHaveBeenCalledOnce();
  });

  it('pas de boucle : second échec en moins d’une minute laissé passer', () => {
    const stockage = memoire();
    const recharger = vi.fn();
    rechargerSiNouvelleVersion({ preventDefault() {} }, { stockage, recharger, maintenant: 1_000_000 });
    const evenement = { preventDefault: vi.fn() };
    expect(rechargerSiNouvelleVersion(evenement, { stockage, recharger, maintenant: 1_030_000 })).toBe(false);
    expect(recharger).toHaveBeenCalledOnce();
    expect(evenement.preventDefault).not.toHaveBeenCalled();
    expect(rechargerSiNouvelleVersion({ preventDefault() {} }, { stockage, recharger, maintenant: 1_070_000 })).toBe(true);
  });

  it('stockage indisponible : aucun rechargement', () => {
    const stockage = {
      getItem: () => {
        throw new Error('bloqué');
      },
    };
    const recharger = vi.fn();
    expect(rechargerSiNouvelleVersion({ preventDefault() {} }, { stockage, recharger })).toBe(false);
    expect(recharger).not.toHaveBeenCalled();
  });
});
