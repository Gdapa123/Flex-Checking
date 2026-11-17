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

  it('ne déconnecte pas si le rafraîchissement est limité (429) ou le serveur indisponible (502)', async () => {
    document.cookie = 'fc_csrftoken=jeton';
    await new Promise((ok) => setTimeout(ok, 0)); // rafraîchissement partagé du test précédent libéré
    for (const statut of [429, 502]) {
      const expiree = vi.fn();
      window.addEventListener('fc:session-expiree', expiree);
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(reponse(401, { code: 'NON_CONNECTE' }))
        .mockResolvedValueOnce(reponse(statut, {}));
      vi.stubGlobal('fetch', fetch);
      // erreur réseau : le scan met le passage en file hors ligne au lieu de renvoyer à la connexion
      await expect(api.get('/evenements/')).rejects.toBeInstanceOf(TypeError);
      window.removeEventListener('fc:session-expiree', expiree);
      expect(expiree).not.toHaveBeenCalled();
      await new Promise((ok) => setTimeout(ok, 0)); // libère le rafraîchissement partagé
    }
  });
});

describe('jeton CSRF', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('une coupure pendant sa récupération ne bloque pas les écritures suivantes', async () => {
    document.cookie = 'fc_csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('réseau'))
      .mockResolvedValueOnce(reponse(200, {}))
      .mockResolvedValueOnce(reponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetch);
    await expect(api.post('/x/', {})).rejects.toBeInstanceOf(TypeError);
    await expect(api.post('/x/', {})).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/auth/csrf/', '/api/auth/csrf/', '/api/x/']);
  });

  it('le délai de l’appelant interrompt un rafraîchissement qui ne répond pas (poste de scan)', async () => {
    document.cookie = 'fc_csrftoken=jeton';
    await new Promise((ok) => setTimeout(ok, 0));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reponse(401, { code: 'NON_CONNECTE' }))
      .mockImplementationOnce(() => new Promise(() => {})); // Wi-Fi muet
    vi.stubGlobal('fetch', fetch);
    const delai = new AbortController();
    const r = api.post('/evenements/1/emargement/', {}, { signal: delai.signal });
    setTimeout(() => delai.abort(), 20);
    await expect(r).rejects.toMatchObject({ name: 'AbortError' });
  });
});
