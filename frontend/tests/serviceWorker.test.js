import { describe, expect, it, vi } from 'vitest';
import { enregistrerServiceWorker } from '../src/lib/serviceWorker';

describe('enregistrement du service worker', () => {
  it('ignore le refus du navigateur (Safari en navigation privée : SecurityError)', async () => {
    const refus = Promise.reject(new DOMException('Script https://x/sw.js load failed', 'SecurityError'));
    const nav = { serviceWorker: { register: vi.fn(() => refus) } };
    const rejetsNonGeres = vi.fn();
    window.addEventListener('unhandledrejection', rejetsNonGeres);
    enregistrerServiceWorker(nav);
    window.dispatchEvent(new Event('load'));
    await new Promise((r) => setTimeout(r, 0));
    expect(nav.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(rejetsNonGeres).not.toHaveBeenCalled();
  });

  it('ne fait rien sans prise en charge des service workers', () => {
    expect(() => enregistrerServiceWorker({})).not.toThrow();
  });
});
