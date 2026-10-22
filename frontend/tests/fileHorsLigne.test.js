import { beforeEach, describe, expect, it, vi } from 'vitest';

// IndexedDB remplacée par une table en mémoire (seules les opérations utilisées par la file)
const table = new Map();
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_s, item) => table.set(item.id, item),
    delete: async (_s, id) => table.delete(id),
    getAll: async () => [...table.values()],
    getAllFromIndex: async (_s, _i, ev) => [...table.values()].filter((i) => i.evenementId === ev),
    countFromIndex: async (_s, _i, ev) => [...table.values()].filter((i) => i.evenementId === ev).length,
    count: async () => table.size,
  }),
}));

const { ajouter, compter, synchroniser } = await import('../src/features/scan/fileHorsLigne.js');

function erreur(status, code) {
  return Object.assign(new Error('refus'), { status, data: code ? { code } : {} });
}

describe('file hors ligne du scan', () => {
  beforeEach(() => table.clear());

  it('retire un « C’est moi » dont le jeton a expiré et rejoue les passages suivants', async () => {
    const perime = await ajouter(1, { inviteId: 1, choixBorne: 'perime' });
    perime.cree = 1;
    await ajouter(1, { code: '1234' });
    const envoyer = vi.fn(async (p) => {
      if (p.choixBorne) throw erreur(403, 'CHOIX_BORNE_INVALIDE');
      return { resultat: 'OK' };
    });
    const resultats = await synchroniser(1, envoyer);
    expect(envoyer).toHaveBeenCalledTimes(2);
    expect(resultats).toHaveLength(1);
    expect(await compter(1)).toBe(0);
  });

  it('garde la file et s’arrête sur un autre 403 (CSRF, droits retirés)', async () => {
    await ajouter(1, { code: '1111' });
    await ajouter(1, { code: '2222' });
    const envoyer = vi.fn(async () => {
      throw erreur(403);
    });
    await synchroniser(1, envoyer);
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(await compter(1)).toBe(2);
  });
});
