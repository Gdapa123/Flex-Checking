import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { monogramme } from '../src/features/admin/ChoixCeremonie';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn() } }));
// jsdom ne fournit pas ResizeObserver (utilisé par les graphiques Recharts)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const { api } = await import('../src/lib/api');
const { default: TableauDeBord } = await import('../src/features/admin/TableauDeBord');

const tranches = (valeurs) =>
  valeurs.map((n, i) => {
    const m = 17 * 60 + 45 + i * 15;
    const h = (x) => `${Math.floor(x / 60)}h${String(x % 60).padStart(2, '0')}`;
    return { debut: h(m), fin: h(m + 15), arrivees: n };
  });

const stats = (valeurs) => ({
  inscrits: 40,
  presents: valeurs.reduce((a, b) => a + b, 0),
  nonPresents: 0,
  taux: 0,
  capacite: 220,
  presents15min: 0,
  heureDebut: '18h30',
  tranches: tranches(valeurs),
  trancheEnCours: null,
  pic: null,
  modes: [],
  postes: [],
  inscriptions: [],
  remplissage: 18,
  emails: { invitationsEnvoyees: 0, invitationsEchec: 0, magazinesEnvoyes: 0, magazineActif: false },
  comparaison: [],
});

const ev = {
  id: 1,
  statut: 'INSCRIPTIONS_OUVERTES',
  date: '2026-12-01',
  heureAccueil: '17:45:00',
  heureDebut: '18:30:00',
  annee: 2026,
  lienInscription: 'https://exemple/i/pmd',
  etatInscriptions: 'OUVERT',
};

function afficher(valeurs, evenement = ev) {
  api.get.mockResolvedValue(stats(valeurs));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TableauDeBord ev={evenement} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('abréviation des programmes', () => {
  it('PAMP, PASD, PMD, AMP', () => {
    expect(monogramme('Public-AMP')).toBe('PAMP');
    expect(monogramme('Public-ASD')).toBe('PASD');
    expect(monogramme('PMD')).toBe('PMD');
    expect(monogramme('AMP')).toBe('AMP');
  });
});

describe('arrivées à l’accueil', () => {
  it('sans arrivée : explique quand le graphique se remplira', async () => {
    afficher([0, 0, 0, 0]);
    expect(await screen.findByText('Aucune arrivée pour le moment')).toBeInTheDocument();
    expect(screen.getByText(/se remplira en direct le mardi 1 décembre 2026/)).toBeInTheDocument();
    expect(screen.getByText(/se remplira en direct/).textContent).toContain('(dès 17h45)');
  });

  it('cérémonie terminée sans arrivée', async () => {
    afficher([0, 0], { ...ev, statut: 'TERMINEE' });
    expect(await screen.findByText('Aucune arrivée enregistrée')).toBeInTheDocument();
  });

  it('présences enregistrées un autre jour : pas de message « aucun invité émargé »', async () => {
    api.get.mockResolvedValue({ ...stats([0, 0]), presents: 3 });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TableauDeBord ev={{ ...ev, statut: 'TERMINEE' }} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Aucune arrivée le jour de la cérémonie')).toBeInTheDocument();
    expect(screen.getByText(/3 présences ont été enregistrées un autre jour/)).toBeInTheDocument();
  });

  it('avec des arrivées : total et description accessible des tranches', async () => {
    afficher([2, 5, 0, 3]);
    const graphique = await screen.findByRole('img', { name: /Arrivées par tranche de 15 minutes/ });
    expect(graphique.getAttribute('aria-label')).toContain('18h00 – 18h15 : 5');
    expect(graphique.getAttribute('aria-label')).toContain('Total : 10');
    expect(screen.queryByText('Aucune arrivée pour le moment')).not.toBeInTheDocument();
  });
});
