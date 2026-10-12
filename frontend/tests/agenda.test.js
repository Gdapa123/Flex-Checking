import { afterEach, describe, expect, it, vi } from 'vitest';
import { adresse, liensAgenda, liensItineraire } from '../src/lib/agenda';

const ev = {
  slug: 'pmd-2026-b0b3bb',
  nomAffiche: 'Graduation PMD 2026',
  lieu: 'Sofitel Abidjan Hôtel Ivoire · Cocody, Abidjan',
  lienCarte: 'https://maps.google.com/?q=Sofitel',
  agenda: {
    debut: '2026-11-27T17:45:00Z',
    fin: '2026-11-27T21:30:00Z',
    description: 'Accueil dès 17:45.\nItinéraire : https://x/i/pmd/pratique#itineraire',
  },
};

const parCle = (liste) => Object.fromEntries(liste.map((o) => [o.cle, o]));

describe('agenda et itinéraire', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('adresse lisible par les cartes', () => {
    expect(adresse(ev)).toBe('Sofitel Abidjan Hôtel Ivoire, Cocody, Abidjan');
  });

  it('Google Agenda : titre, dates UTC compactes, lieu et description', () => {
    const url = new URL(parCle(liensAgenda(ev)).google.href);
    expect(url.origin).toBe('https://calendar.google.com');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Graduation PMD 2026');
    expect(url.searchParams.get('dates')).toBe('20261127T174500Z/20261127T213000Z');
    expect(url.searchParams.get('location')).toBe(adresse(ev));
    expect(url.searchParams.get('details')).toContain('Itinéraire');
  });

  it('Outlook et Microsoft 365 : formulaire de création pré-rempli', () => {
    const { outlook, office, apple } = parCle(liensAgenda(ev));
    for (const [o, domaine] of [
      [outlook, 'outlook.live.com'],
      [office, 'outlook.office.com'],
    ]) {
      const url = new URL(o.href);
      expect(url.host).toBe(domaine);
      expect(url.searchParams.get('rru')).toBe('addevent');
      expect(url.searchParams.get('startdt')).toBe(ev.agenda.debut);
      expect(url.searchParams.get('subject')).toBe(ev.nomAffiche);
    }
    expect(apple.href).toBe('/api/public/evenements/pmd-2026-b0b3bb/agenda.ics');
    expect(apple.telechargement).toBe(true);
  });

  it('itinéraires en mode navigation vers le lieu, plan de l’organisateur si fourni', () => {
    const liens = parCle(liensItineraire(ev));
    const dest = encodeURIComponent(adresse(ev));
    expect(liens.google.href).toBe(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
    expect(liens.waze.href).toContain('navigate=yes');
    expect(liens.apple.href).toBe(`https://maps.apple.com/?daddr=${dest}`);
    expect(liens.carte.href).toBe(ev.lienCarte);
    expect(parCle(liensItineraire({ ...ev, lienCarte: '' })).carte).toBeUndefined();
  });

  it('propose Apple en premier sur iPhone', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' });
    expect(liensAgenda(ev)[0].cle).toBe('apple');
    expect(liensItineraire(ev)[0].cle).toBe('apple');
  });
});

describe('données sans horaires d’agenda (cache d’une version antérieure)', () => {
  it('reconstruit les horaires depuis la date et les heures', () => {
    const ancien = { ...ev, agenda: undefined, date: '2026-11-27', heureAccueil: '17:45', heureDebut: '18:30' };
    const url = new URL(parCle(liensAgenda(ancien)).google.href);
    expect(url.searchParams.get('dates')).toBe('20261127T174500Z/20261127T213000Z');
  });
});
