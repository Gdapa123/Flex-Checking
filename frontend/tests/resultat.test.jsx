import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultatPleinEcran } from '../src/features/scan/composants';

describe('résultat de scan', () => {
  it('affiche titre, nom et compte à rebours', () => {
    render(
      <ResultatPleinEcran
        resultat={{ type: 'PRESENT', titre: 'Présence enregistrée', nom: 'Mme Aya KOUASSI', meta: '18h42 · QR caméra', note: 'Email n°2 envoyé' }}
        appareil="TELEPHONE"
        progression={0.2}
        pause={false}
        duree={3}
        onBasculer={() => {}}
      />,
    );
    expect(screen.getByText('Présence enregistrée')).toBeInTheDocument();
    expect(screen.getByText('Mme Aya KOUASSI')).toBeInTheDocument();
    expect(screen.getByText(/Retour à la caméra dans 3 s/)).toBeInTheDocument();
  });
});
