import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfidentialitePage from '../src/features/invite/ConfidentialitePage';
import { schemaDonneesPersonnelles } from '../src/lib/schemas';

function afficher() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ConfidentialitePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('politique de confidentialité', () => {
  afterEach(() => vi.restoreAllMocks());

  it('affiche le texte de MDE, sans promettre de lien de désinscription', () => {
    afficher();
    expect(screen.getByRole('heading', { name: 'Politique de confidentialité' })).toBeTruthy();
    expect(screen.getByText(/loi ivoirienne n° 2013-450/)).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7);
    expect(screen.getByText(/refuser ces envois à tout moment en contactant MDE Business School/)).toBeTruthy();
    expect(screen.queryByText(/désinscription/)).toBeNull();
  });

  it('valide les réglages comme le serveur (1 à 60 mois, email facultatif)', () => {
    expect(schemaDonneesPersonnelles.safeParse({ dureeConservationMois: '12', contactDonnees: '' }).success).toBe(true);
    expect(schemaDonneesPersonnelles.safeParse({ dureeConservationMois: 0, contactDonnees: '' }).success).toBe(false);
    expect(schemaDonneesPersonnelles.safeParse({ dureeConservationMois: 61, contactDonnees: '' }).success).toBe(false);
    expect(
      schemaDonneesPersonnelles.safeParse({ dureeConservationMois: 12, contactDonnees: 'pas-un-email' }).success,
    ).toBe(false);
  });
});
