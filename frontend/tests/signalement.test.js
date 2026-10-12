import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('signalement des erreurs du navigateur', () => {
  let signalerErreur;
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true })),
    );
    window.history.pushState({}, '', '/i/pmd-2026/confirmation?q=aya@sib.ci#x');
    ({ signalerErreur } = await import('../src/lib/signalement'));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('envoie type, message et chemin sans paramètres, sans cookie', () => {
    signalerErreur(new TypeError('x is undefined'));
    const [url, opts] = fetch.mock.calls[0];
    const corps = JSON.parse(opts.body);
    expect(url).toBe('/api/erreurs/');
    expect(opts.credentials).toBe('omit');
    expect(corps).toMatchObject({ type: 'TypeError', message: 'x is undefined', lieu: '/i/pmd-2026/confirmation' });
  });

  it('n’envoie qu’une fois la même erreur et au plus 20 par page', () => {
    signalerErreur(new Error('même'));
    signalerErreur(new Error('même'));
    for (let i = 0; i < 30; i++) signalerErreur(new Error(`n°${i}`));
    expect(fetch).toHaveBeenCalledTimes(20);
  });
});
