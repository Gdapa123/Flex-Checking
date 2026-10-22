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

  it('affiche la durée de conservation et le contact réglés par le super admin', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ contact: 'dpo@mde.ci', dureeConservationMois: 18 }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    afficher();
    expect(screen.getByRole('heading', { name: 'Politique de confidentialité' })).toBeTruthy();
    expect(await screen.findByText(/conservées 18 mois après la date de la cérémonie/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'dpo@mde.ci' }).getAttribute('href')).toBe('mailto:dpo@mde.ci');
    expect(screen.getByText(/loi ivoirienne n° 2013-450/)).toBeTruthy();
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
