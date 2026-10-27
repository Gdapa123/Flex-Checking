import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, messageErreur: (e) => e.message }));

const { api } = await import('../src/lib/api');
const { default: SondagePage } = await import('../src/features/invite/SondagePage');
const { default: CarteSatisfaction } = await import('../src/features/admin/CarteSatisfaction');

const lien = (etat = 'OUVERT') => ({
  etat,
  prenom: 'Aya',
  civilite: 'Mme',
  expireLe: '2026-10-15T08:00:00+00:00',
  evenement: { nomAffiche: 'Graduation PMD 2026', programme: 'PMD', annee: 2026, date: '2026-10-13', tokens: {} },
});

function afficher(donnees, adresse = '/sondage/jeton-de-test') {
  api.get.mockResolvedValue(donnees);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[adresse]}>
        <Routes>
          <Route path="/sondage/:jeton" element={<SondagePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.post.mockReset();
  window.scrollTo = vi.fn();
});

describe('sondage public', () => {
  it('trois questions obligatoires, puis envoi et remerciement', async () => {
    afficher(lien());
    expect(await screen.findByText(/Bonjour Aya/)).toBeInTheDocument();
    expect(screen.getByText(/Ouvert jusqu’au jeudi 15 octobre 2026 à 8h00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer mon avis' }));
    expect(await screen.findByText('Répondez aux trois questions pour envoyer votre avis.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('radio', { name: /5 sur 5/ })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: /4 sur 5/ })[1]);
    fireEvent.click(screen.getByRole('radio', { name: '9 sur 10' }));
    fireEvent.change(screen.getByLabelText(/Un mot à ajouter/), { target: { value: '  Merci !  ' } });
    api.post.mockResolvedValue({ etat: 'REPONDU' });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer mon avis' }));
    expect(await screen.findByText('Merci Aya !')).toBeInTheDocument();
    const [url, corps] = api.post.mock.calls[0];
    expect(url).toBe('/public/sondages/jeton-de-test/');
    expect(corps).toMatchObject({ noteGlobale: 5, noteAccueil: 4, recommandation: 9, commentaire: 'Merci !' });
    expect(corps.appareil).toMatch(/^[\w-]{16,64}$/);
  });

  it('retour du formulaire de l’email incomplet : notes reprises, question manquante signalée', async () => {
    afficher(lien(), '/sondage/jeton-de-test?incomplet=1&globale=4&reco=12');
    await screen.findByText(/Bonjour Aya/);
    expect(screen.getByText('Répondez aux trois questions pour envoyer votre avis.')).toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: /4 sur 5/ })[0]).toHaveAttribute('aria-checked', 'true');
    expect(
      screen
        .getAllByRole('radio', { name: /sur 5/ })
        .slice(5)
        .some((r) => r.getAttribute('aria-checked') === 'true'),
    ).toBe(false);
    expect(
      screen.getAllByRole('radio', { name: /sur 10/ }).some((r) => r.getAttribute('aria-checked') === 'true'),
    ).toBe(false); // 12 hors bornes
  });

  it('lien expiré : fenêtre « le temps du sondage est passé », avec remerciements', async () => {
    afficher({ ...lien('EXPIRE'), prenom: '', civilite: '' }); // le serveur ne renvoie plus le prénom
    const dialogue = await screen.findByRole('dialog', { name: 'Le temps du sondage est passé' });
    expect(dialogue).toHaveTextContent('Merci, du fond du cœur');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Le sondage est clos')).toBeInTheDocument();
  });

  it('délai dépassé pendant la saisie : la fenêtre s’ouvre à l’envoi', async () => {
    afficher(lien());
    await screen.findByText(/Bonjour Aya/);
    fireEvent.click(screen.getAllByRole('radio', { name: /3 sur 5/ })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: /3 sur 5/ })[1]);
    fireEvent.click(screen.getByRole('radio', { name: '7 sur 10' }));
    api.post.mockRejectedValue(Object.assign(new Error('clos'), { status: 410, data: { code: 'SONDAGE_EXPIRE' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer mon avis' }));
    expect(await screen.findByRole('dialog', { name: 'Le temps du sondage est passé' })).toBeInTheDocument();
  });

  it('appareil déjà utilisé : remerciement sans nouvel envoi', async () => {
    afficher(lien());
    await screen.findByText(/Bonjour Aya/);
    fireEvent.click(screen.getAllByRole('radio', { name: /5 sur 5/ })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: /5 sur 5/ })[1]);
    fireEvent.click(screen.getByRole('radio', { name: '10 sur 10' }));
    api.post.mockRejectedValue(Object.assign(new Error('x'), { status: 409, data: { code: 'APPAREIL_DEJA_UTILISE' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer mon avis' }));
    expect(await screen.findByText(/Un avis a déjà été envoyé depuis cet appareil/)).toBeInTheDocument();
  });

  it('déjà répondu à l’ouverture', async () => {
    afficher(lien('REPONDU'));
    expect(await screen.findByText(/Votre avis a bien été reçu/)).toBeInTheDocument();
  });
});

describe('carte satisfaction (tableau de bord)', () => {
  it('indicateurs, répartition et commentaires', async () => {
    api.get.mockResolvedValue({
      actif: true,
      etat: 'EN_COURS',
      envoiPrevu: '2026-10-14T08:00:00+00:00',
      fermeLe: '2026-10-15T08:00:00+00:00',
      envoyes: 20,
      reponses: 10,
      tauxReponse: 50,
      noteGlobale: 4.3,
      noteAccueil: 4.1,
      recommandation: 8.6,
      nps: 40,
      promoteurs: 6,
      passifs: 2,
      detracteurs: 2,
      repartitionGlobale: [1, 2, 3, 4, 5].map((valeur) => ({ valeur, nb: valeur === 5 ? 6 : 1 })),
      repartitionAccueil: [],
      commentaires: [{ texte: 'Superbe soirée', noteGlobale: 5, le: '2026-10-14T09:00:00+00:00' }],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CarteSatisfaction ev={{ id: 3 }} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('4,3')).toBeInTheDocument();
    expect(screen.getByText('+40')).toBeInTheDocument();
    expect(screen.getByText('Très bon')).toBeInTheDocument();
    expect(screen.getByText('« Superbe soirée »')).toBeInTheDocument();
    expect(screen.getByText(/Sondage ouvert jusqu’au jeudi 15 octobre 2026 à 8h00/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/evenements/3/sondage/');
  });
});

describe('signalement d’erreurs', () => {
  it('le jeton du sondage n’est jamais envoyé', async () => {
    const { normaliserLieu } = await import('../src/lib/signalement');
    expect(normaliserLieu('/sondage/abc_DEF-123')).toBe('/sondage/:jeton');
    expect(normaliserLieu('/i/pmd-2026-a1b2c3')).toBe('/i/pmd-2026-a1b2c3');
  });
});
