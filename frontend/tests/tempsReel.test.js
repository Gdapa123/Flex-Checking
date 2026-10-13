import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/api', () => ({ rafraichirSession: vi.fn() }));

import { rafraichirSession } from '../src/lib/api';
import { demarrerTempsReel, lireEtatTempsReel } from '../src/lib/tempsReel';

class FauxSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    FauxSocket.instances.push(this);
  }
  recevoir(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  close(code = 1000) {
    this.onclose?.({ code });
  }
}

const dernier = () => FauxSocket.instances.at(-1);

describe('temps réel', () => {
  let qc;
  let arreter;
  beforeEach(() => {
    vi.useFakeTimers();
    FauxSocket.instances = [];
    vi.stubGlobal('WebSocket', FauxSocket);
    qc = { invalidateQueries: vi.fn() };
  });
  afterEach(() => {
    arreter?.();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('recharge les requêtes des sujets annoncés, regroupées', () => {
    arreter = demarrerTempsReel(qc);
    expect(dernier().url).toMatch(/\/api\/ws\/$/);
    dernier().recevoir({ type: 'pret' });
    dernier().recevoir({ type: 'maj', sujets: ['statistiques'] });
    dernier().recevoir({ type: 'maj', sujets: ['statistiques', 'recents'] });
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    const cles = qc.invalidateQueries.mock.calls.map(([f]) => f.queryKey[0]);
    expect(cles.sort()).toEqual(['recents', 'statistiques']);
  });

  it('se reconnecte après une coupure et recharge tout', () => {
    arreter = demarrerTempsReel(qc);
    dernier().recevoir({ type: 'pret' });
    dernier().close(1006);
    vi.advanceTimersByTime(1000);
    expect(FauxSocket.instances).toHaveLength(2);
    dernier().recevoir({ type: 'pret' });
    expect(qc.invalidateQueries).toHaveBeenCalledWith();
  });

  it('rafraîchit la session quand le jeton expire (4001)', async () => {
    rafraichirSession.mockResolvedValue(true);
    arreter = demarrerTempsReel(qc);
    dernier().close(4001);
    await vi.runAllTimersAsync();
    expect(rafraichirSession).toHaveBeenCalled();
    expect(FauxSocket.instances).toHaveLength(2);
  });

  it('signale la fin de session si le compte est désactivé (4003)', () => {
    const ecoute = vi.fn();
    window.addEventListener('fc:session-expiree', ecoute);
    arreter = demarrerTempsReel(qc);
    dernier().close(4003);
    vi.advanceTimersByTime(60_000);
    expect(ecoute).toHaveBeenCalled();
    expect(FauxSocket.instances).toHaveLength(1);
    window.removeEventListener('fc:session-expiree', ecoute);
  });

  it('serveur sans temps réel (code 4004) : état « indisponible », essais espacés et silencieux', () => {
    arreter = demarrerTempsReel(qc);
    expect(lireEtatTempsReel()).toBe('connexion');
    dernier().close(4004);
    expect(lireEtatTempsReel()).toBe('indisponible');
    vi.advanceTimersByTime(60_000);
    expect(FauxSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(5 * 60_000);
    expect(FauxSocket.instances).toHaveLength(2);
    expect(lireEtatTempsReel()).toBe('indisponible');
    dernier().recevoir({ type: 'pret' });
    expect(lireEtatTempsReel()).toBe('connecte');
  });

  it('coupure réseau avant toute connexion : « Reconnexion… », jamais « indisponible »', () => {
    arreter = demarrerTempsReel(qc);
    for (let i = 0; i < 4; i++) {
      dernier().close(1006);
      expect(lireEtatTempsReel()).toBe('deconnecte');
      vi.advanceTimersByTime(40_000);
    }
  });

  it('temps réel indisponible : ni le retour du réseau ni le retour sur l’onglet ne relancent de connexion', () => {
    arreter = demarrerTempsReel(qc);
    dernier().close(4004);
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(1000);
    expect(FauxSocket.instances).toHaveLength(1);
  });
});
