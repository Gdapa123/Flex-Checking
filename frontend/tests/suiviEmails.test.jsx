import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const toast = vi.fn();
vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, messageErreur: (e) => e.message }));
vi.mock('../src/components/ui/Toasts', () => ({ useToast: () => toast }));

const { api } = await import('../src/lib/api');
const { default: SuiviEmails } = await import('../src/features/admin/SuiviEmails');

const echec = (i) => ({
  inviteId: i,
  nomComplet: `M. Invité ${i}`,
  email: `invite${i}@exemple.ci`,
  erreur: 'SMTPRecipientsRefused: 550',
  tentatives: 4,
  le: '2026-10-10T10:00:00Z',
});
const suivi = (echecs = 0, magazineActif = true, sondageActif = true) => ({
  INVITATION: {
    envoyes: 37,
    attente: 1,
    echecs,
    listeEchecs: Array.from({ length: echecs }, (_, i) => echec(i + 1)),
  },
  MAGAZINE: { envoyes: 12, attente: 0, echecs: 0, listeEchecs: [], actif: magazineActif },
  SONDAGE: { envoyes: 0, attente: 0, echecs: 0, listeEchecs: [], actif: sondageActif },
});

function afficher(donnees) {
  api.get.mockResolvedValue(donnees);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SuiviEmails ev={{ id: 2 }} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('suivi des emails', () => {
  it('affiche les compteurs et l’absence d’échec', async () => {
    afficher(suivi());
    expect(await screen.findByText('37')).toBeInTheDocument();
    expect(screen.getAllByText('Aucun échec d’envoi.')).toHaveLength(3);
    expect(api.get).toHaveBeenCalledWith('/evenements/2/suivi-emails/');
  });

  it('liste les échecs (5 visibles) et renvoie après confirmation', async () => {
    afficher(suivi(7));
    expect(await screen.findByText('7 invités n’ont pas reçu cet email')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(screen.getByText('Afficher 2 de plus'));
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByRole('link', { name: 'M. Invité 1' })).toHaveAttribute(
      'href',
      '/admin/evenements/2/invites?fiche=1',
    );
    api.post.mockResolvedValue({ traites: 7 });
    fireEvent.click(screen.getByRole('button', { name: /Renvoyer les 7 emails/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Renvoyer' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/evenements/2/suivi-emails/renvoyer-echecs/', { type: 'INVITATION' }),
    );
    await waitFor(() => expect(toast).toHaveBeenCalledWith('7 emails remis en file d’envoi.'));
  });

  it('envoie un email de test au compte connecté', async () => {
    afficher(suivi());
    api.post.mockResolvedValue({ destinataire: 'admin@mde.ci' });
    fireEvent.click((await screen.findAllByRole('button', { name: /M’envoyer un test/ }))[0]);
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Email de test envoyé à admin@mde.ci.'));
    expect(api.post).toHaveBeenCalledWith('/evenements/2/suivi-emails/test/', { type: 'INVITATION' });
  });

  it('magazine et sondage désactivés : message, ni test ni aperçu', async () => {
    afficher(suivi(0, false, false));
    expect(await screen.findByText(/Le magazine est désactivé/)).toBeInTheDocument();
    expect(screen.getByText(/Le sondage de satisfaction est désactivé/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /M’envoyer un test/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Voir l’aperçu/ })).toHaveLength(1);
  });

  it('email n°3 : le sondage a sa carte', async () => {
    afficher(suivi());
    expect(await screen.findByRole('region', { name: 'Email n°3 · Sondage de satisfaction' })).toBeInTheDocument();
  });
});
