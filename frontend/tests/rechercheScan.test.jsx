import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResultatPleinEcran, VueRecherche } from '../src/features/scan/composants';

const resultats = [
  {
    id: 1,
    nomComplet: 'Mme Bintou AHOUA',
    fonction: 'Directrice',
    entreprise: 'SGCI',
    email: 'b@x.ci',
    statut: 'INSCRIT',
  },
  { id: 2, nomComplet: 'M. Yao KONAN', fonction: 'Analyste', entreprise: 'SIB', email: 'y@x.ci', statut: 'INSCRIT' },
];
const props = { q: 'Konan', onQ: () => {}, total: 2, resultats, onRetour: () => {}, borne: false, enCours: false };

describe('recherche du scan', () => {
  it('pendant la recherche, la liste précédente est inactive (pas d’émargement de la mauvaise personne)', () => {
    const onEmarger = vi.fn();
    render(<VueRecherche {...props} chargement onEmarger={onEmarger} />);
    const boutons = screen.getAllByRole('button', { name: 'Émarger' });
    expect(boutons.every((b) => b.disabled)).toBe(true);
  });

  it('résultats prêts : boutons actifs, fonction affichée', () => {
    render(<VueRecherche {...props} chargement={false} onEmarger={() => {}} />);
    expect(screen.getAllByRole('button', { name: 'Émarger' }).every((b) => !b.disabled)).toBe(true);
    expect(screen.getByText(/Analyste · SIB/)).toBeTruthy();
  });

  it('signale une liste tronquée', () => {
    render(<VueRecherche {...props} total={140} chargement={false} onEmarger={() => {}} />);
    expect(screen.getByText(/2 premiers affichés/)).toBeTruthy();
  });

  it('confirmation : fonction · entreprise sous le nom', () => {
    render(
      <ResultatPleinEcran
        resultat={{
          type: 'PRESENT',
          titre: 'Présence enregistrée',
          nom: 'M. Yao KONAN',
          fonction: 'Analyste · SIB',
          meta: '9h50',
        }}
        appareil="TELEPHONE"
        progression={0}
        pause={false}
        duree={3}
        onBasculer={() => {}}
      />,
    );
    expect(screen.getByText('Analyste · SIB')).toBeTruthy();
  });
});
