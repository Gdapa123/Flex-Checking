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

  it('ignore les erreurs des scripts injectés (extensions, navigateurs intégrés aux applications)', async () => {
    const { installerSignalement, vientDeLApplication } = await import('../src/lib/signalement');
    const origine = window.location.origin;
    const injectee = new Error('Rejected');
    injectee.stack = 'Error: Rejected\n    at chrome-extension://abcdef/content.js:1:20';
    const interne = new Error('Échec');
    interne.stack = `Error: Échec\n    at envoyer (${origine}/assets/index-abc.js:1:200)`;
    expect(vientDeLApplication(injectee)).toBe(false);
    expect(vientDeLApplication(interne)).toBe(true);
    // sans information sur l'origine : signalée (échec de chargement d'un fichier, rejet d'une chaîne)
    expect(vientDeLApplication({ message: 'sans trace' })).toBe(true);
    expect(vientDeLApplication(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(vientDeLApplication('Rejected')).toBe(true);
    // script en ligne injecté par un navigateur intégré : attribué à l'URL de la page, pas à nos scripts
    expect(vientDeLApplication(null, `${origine}/i/pmd-2026/confirmation`)).toBe(false);
    const enLigne = new Error('Rejected');
    enLigne.stack = `Error: Rejected\n    at ${origine}/i/pmd-2026/confirmation:3:14`;
    expect(vientDeLApplication(enLigne)).toBe(false);
    expect(vientDeLApplication(null, 'webkit-masked-url://hidden/')).toBe(false);
    expect(vientDeLApplication(null, `${origine}/assets/index-abc.js`)).toBe(true);

    installerSignalement();
    const rejet = (reason) => {
      const e = new Event('unhandledrejection');
      e.reason = reason;
      window.dispatchEvent(e);
    };
    rejet(injectee);
    expect(fetch).not.toHaveBeenCalled();
    rejet(interne);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('n’envoie qu’une fois la même erreur et au plus 20 par page', () => {
    signalerErreur(new Error('même'));
    signalerErreur(new Error('même'));
    for (let i = 0; i < 30; i++) signalerErreur(new Error(`n°${i}`));
    expect(fetch).toHaveBeenCalledTimes(20);
  });
});
