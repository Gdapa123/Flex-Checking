import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireRole } from '../src/features/auth/RequireRole';

function monter(chemin = '/admin') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/connexion" element={<p>Page de connexion</p>} />
          <Route
            path="/*"
            element={
              <RequireRole roles={['ADMIN']} connexion="/connexion">
                <p>Espace protégé</p>
              </RequireRole>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const reponse = (status, corps = {}) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

describe('garde de route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('un 401 renvoie vers la connexion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reponse(401));
    monter();
    expect(await screen.findByText('Page de connexion')).toBeTruthy();
  });

  it('une saturation (503) ne déconnecte pas : écran « Réessayer »', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reponse(503, { detail: 'Service saturé' }));
    monter();
    expect(await screen.findByRole('heading', { name: 'Connexion au serveur impossible' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeTruthy();
  });

  it('hors ligne, le poste de scan garde le dernier compte connu', async () => {
    localStorage.setItem('fc-moi', JSON.stringify({ id: 3, nom: 'Mariam Koné', role: 'ADMIN' }));
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    monter('/scan');
    expect(await screen.findByText('Espace protégé')).toBeTruthy();
  });
});
