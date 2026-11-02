import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/lib/api';

function reponse(status, data) {
  return new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('rafraîchissement de session', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renouvelle la session sur un 401 de /auth/moi/ puis rejoue la requête', async () => {
    document.cookie = 'fc_csrftoken=jeton';
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reponse(401, { code: 'NON_CONNECTE' }))
      .mockResolvedValueOnce(reponse(200, {}))
      .mockResolvedValueOnce(reponse(200, { id: 1, role: 'ADMIN' }));
    vi.stubGlobal('fetch', fetch);
    await expect(api.get('/auth/moi/')).resolves.toEqual({ id: 1, role: 'ADMIN' });
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/auth/moi/', '/api/auth/rafraichir/', '/api/auth/moi/']);
  });

  it('ne rafraîchit pas sur un échec de connexion', async () => {
    document.cookie = 'fc_csrftoken=jeton';
    const fetch = vi.fn().mockResolvedValueOnce(reponse(401, { code: 'IDENTIFIANTS_INVALIDES' }));
    vi.stubGlobal('fetch', fetch);
    await expect(api.post('/auth/connexion/', {})).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('renvoie le 401 si le rafraîchissement échoue', async () => {
    document.cookie = 'fc_csrftoken=jeton';
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reponse(401, { code: 'NON_CONNECTE' }))
      .mockResolvedValueOnce(reponse(401, { code: 'SESSION_EXPIREE' }));
    vi.stubGlobal('fetch', fetch);
    await expect(api.get('/auth/moi/')).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
