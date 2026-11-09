import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const toast = vi.fn();
vi.mock('../src/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  messageErreur: (e) => e.message,
}));
vi.mock('../src/components/ui/Toasts', () => ({ useToast: () => toast }));

const { api } = await import('../src/lib/api');
const { default: SuiviEmails } = await import('../src/features/admin/SuiviEmails');

const ligne = (id, autres = {}) => ({
  inviteId: id,
  nomComplet: `M. Invité ${id}`,
  email: `invite${id}@sib.ci`,
  telephone: '+225 07 12 34 56 78',
  statut: 'INSCRIT',
  suggestion: null,
  action: 'RENVOYER',
  problemes: [
    { code: 'SERVEUR_INJOIGNABLE', type: 'INVITATION', libelle: 'Serveur d’envoi injoignable', cote: 'envoi' },
  ],
  ...autres,
});
const aucun = { total: 0, causesEnvoi: 0, invites: [] };
const suivi = (echecs = 0, magazineActif = true, sondageActif = true, aContacter = aucun) => ({
  aContacter,
  INVITATION: {
    envoyes: 37,
    attente: 1,
    echecs,
  },
  MAGAZINE: { envoyes: 12, attente: 0, echecs: 0, actif: magazineActif },
  SONDAGE: { envoyes: 0, attente: 0, echecs: 0, actif: sondageActif },
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
  it('rien à faire : message rassurant, compteurs affichés', async () => {
    afficher(suivi());
    expect(await screen.findByText('Aucun invité à contacter')).toBeInTheDocument();
    expect(screen.getByText('37')).toBeInTheDocument();
    expect(screen.queryByText(/n’ont pas reçu cet email/)).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/evenements/2/suivi-emails/');
  });

  it('invités à contacter : cause, téléphone, lien vers la fiche, avertissement serveur', async () => {
    afficher(
      suivi(0, true, true, {
        total: 2,
        causesEnvoi: 1,
        invites: [
          ligne(1, {
            action: 'CORRIGER',
            problemes: [
              { code: 'ADRESSE_INEXISTANTE', type: 'INVITATION', libelle: 'Adresse inexistante', cote: 'adresse' },
            ],
          }),
          ligne(2),
        ],
      }),
    );
    expect(await screen.findByText('Invités à contacter')).toBeInTheDocument();
    expect(screen.getByText('Adresse inexistante')).toBeInTheDocument();
    expect(screen.getByText(/Pour 1 invité, le problème vient de l’envoi/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'M. Invité 1' })).toHaveAttribute(
      'href',
      '/admin/evenements/2/invites?fiche=1',
    );
    expect(screen.getByRole('link', { name: /Corriger l’adresse/ })).toHaveAttribute(
      'href',
      '/admin/evenements/2/invites?fiche=1',
    );
    expect(screen.getAllByRole('link', { name: /\+225 07 12 34 56 78/ })[0]).toHaveAttribute(
      'href',
      'tel:+2250712345678',
    );
  });

  it('renvoie l’email d’un invité', async () => {
    afficher(suivi(0, true, true, { total: 1, causesEnvoi: 1, invites: [ligne(2)] }));
    api.post.mockResolvedValue({});
    fireEvent.click(await screen.findByRole('button', { name: 'Renvoyer' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/invites/2/renvoi-email/', { type: 'INVITATION' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Invitation renvoyée à M. Invité 2.'));
  });

  it('adresse mal tapée : correction suggérée puis renvoi en un clic', async () => {
    afficher(
      suivi(0, true, true, {
        total: 1,
        causesEnvoi: 0,
        invites: [
          ligne(3, {
            email: 'aya@gmial.com',
            suggestion: 'aya@gmail.com',
            action: 'CORRIGER',
            problemes: [
              {
                code: 'ADRESSE_DOUTEUSE',
                type: 'INVITATION',
                libelle: 'Adresse probablement mal tapée',
                cote: 'adresse',
              },
            ],
          }),
        ],
      }),
    );
    expect(await screen.findByText('aya@gmail.com')).toBeInTheDocument();
    api.patch.mockResolvedValue({});
    api.post.mockResolvedValue({});
    fireEvent.click(screen.getByRole('button', { name: /Corriger et renvoyer/ }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/invites/3/', { email: 'aya@gmail.com' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/invites/3/renvoi-email/', { type: 'INVITATION' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Adresse corrigée en aya@gmail.com, invitation renvoyée.'));
  });

  it('« Corriger et renvoyer » renvoie le magazine quand c’est lui qui a échoué', async () => {
    afficher(
      suivi(0, true, true, {
        total: 1,
        causesEnvoi: 0,
        invites: [
          ligne(4, {
            email: 'kofi@hotmial.com',
            suggestion: 'kofi@hotmail.com',
            statut: 'PRESENT',
            action: 'CORRIGER',
            problemes: [
              { code: 'ADRESSE_INEXISTANTE', type: 'MAGAZINE', libelle: 'Adresse inexistante', cote: 'adresse' },
              {
                code: 'ADRESSE_DOUTEUSE',
                type: 'INVITATION',
                libelle: 'Adresse probablement mal tapée',
                cote: 'adresse',
              },
            ],
          }),
        ],
      }),
    );
    expect(await screen.findByText('kofi@hotmail.com')).toBeInTheDocument();
    api.patch.mockResolvedValue({});
    api.post.mockResolvedValue({});
    fireEvent.click(screen.getByRole('button', { name: /Corriger et renvoyer/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/invites/4/renvoi-email/', { type: 'MAGAZINE' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Adresse corrigée en kofi@hotmail.com, magazine renvoyé.'));
  });

  it('renvoi groupé des échecs d’un email après confirmation', async () => {
    afficher(suivi(7));
    expect(await screen.findByText('7 invités n’ont pas reçu cet email')).toBeInTheDocument();
    api.post.mockResolvedValue({ traites: 7 });
    fireEvent.click(screen.getByRole('button', { name: /Renvoyer les 7 emails/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Renvoyer' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/evenements/2/suivi-emails/renvoyer-echecs/', { type: 'INVITATION' }),
    );
    await waitFor(() => expect(toast).toHaveBeenCalledWith('7 emails remis en file d’envoi.'));
  });

  it('email de test discret : dans le volet « Aperçu et email de test »', async () => {
    afficher(suivi());
    expect(await screen.findByText('Aucun invité à contacter')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /M’envoyer un test/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Aperçu et email de test/ })[0]);
    api.post.mockResolvedValue({ destinataire: 'admin@mde.ci' });
    fireEvent.click(await screen.findByRole('button', { name: /M’envoyer un test/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Email de test envoyé à admin@mde.ci.'));
    expect(api.post).toHaveBeenCalledWith('/evenements/2/suivi-emails/test/', { type: 'INVITATION' });
  });

  it('magazine et sondage désactivés : message, ni test ni aperçu', async () => {
    afficher(suivi(0, false, false));
    expect(await screen.findByText(/Le magazine est désactivé/)).toBeInTheDocument();
    expect(screen.getByText(/Le sondage de satisfaction est désactivé/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Aperçu et email de test/ })).toHaveLength(1);
  });

  it('email n°3 : le sondage a sa carte', async () => {
    afficher(suivi());
    expect(await screen.findByRole('region', { name: 'Email n°3 · Sondage de satisfaction' })).toBeInTheDocument();
  });

  it('envoi seulement en file : pas de bouton « Renvoyer » (nouvel essai automatique, pas de doublon)', async () => {
    afficher(
      suivi(0, true, true, {
        total: 1,
        causesEnvoi: 1,
        invites: [
          ligne(5, {
            problemes: [
              { code: 'BLOQUE', type: 'INVITATION', libelle: 'En attente depuis plus de 15 min', cote: 'envoi' },
            ],
          }),
        ],
      }),
    );
    expect(await screen.findByText('Nouvel essai automatique')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Renvoyer$/ })).not.toBeInTheDocument();
  });

  it('adresse corrigée mais renvoi refusé : l’écran est rechargé quand même', async () => {
    afficher(
      suivi(0, true, true, {
        total: 1,
        causesEnvoi: 0,
        invites: [
          ligne(6, {
            email: 'awa@gmial.com',
            suggestion: 'awa@gmail.com',
            action: 'CORRIGER',
            problemes: [
              {
                code: 'ADRESSE_DOUTEUSE',
                type: 'INVITATION',
                libelle: 'Adresse probablement mal tapée',
                cote: 'adresse',
              },
            ],
          }),
        ],
      }),
    );
    expect(await screen.findByText('awa@gmail.com')).toBeInTheDocument();
    api.get.mockClear();
    api.patch.mockResolvedValue({});
    api.post.mockRejectedValue(new Error('Trop de renvois'));
    fireEvent.click(screen.getByRole('button', { name: /Corriger et renvoyer/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Trop de renvois', 'erreur'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/evenements/2/suivi-emails/'));
  });
});
