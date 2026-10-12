import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfirmationPage from '../src/features/invite/ConfirmationPage';

const EV = {
  slug: 'pmd-2026',
  nomAffiche: 'Graduation PMD 2026',
  tokens: {
    p: '#1A5E36',
    s: '#FFF200',
    ph: '#16502E',
    ps: '#E4ECE7',
    ss: '#FFFDD9',
    op: '#FFFFFF',
    os: '#141414',
    hd: '#DFE8E3',
  },
  date: '2026-11-27',
  heureDebut: '18:30',
  heureAccueil: '17:45',
  lieu: 'Sofitel Abidjan',
  lienCarte: '',
  agenda: { debut: '2026-11-27T17:45:00Z', fin: '2026-11-27T21:30:00Z', description: '' },
  etat: 'OUVERT',
};

describe('page de confirmation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('s’affiche même si scrollTo renvoie une promesse (navigateurs récents)', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => Promise.resolve());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(EV), { headers: { 'Content-Type': 'application/json' } }),
    );
    sessionStorage.setItem(
      'fc-confirmation-pmd-2026',
      JSON.stringify({ email: 'a@b.ci', invite: { civiliteAffichee: 'Mme', prenom: 'Aya', nom: 'Kouassi' } }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/i/pmd-2026/confirmation']}>
            <Routes>
              <Route path="/i/:slug/confirmation" element={<ConfirmationPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );
    expect(await screen.findByRole('heading', { name: 'Inscription réussie' })).toBeTruthy();
  });
});
