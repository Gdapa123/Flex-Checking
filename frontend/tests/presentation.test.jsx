import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Presentation from '../src/features/invite/Presentation';

const ev = (magazineActif, brochureActive) => ({ nomAffiche: 'Graduation PMD 2026', magazineActif, brochureActive });

function ouvrir(e) {
  render(<Presentation ev={e} />);
  fireEvent.click(screen.getByRole('button', { name: /Comment ça se passe/ }));
}

describe('guide « Comment ça se passe ? »', () => {
  it('annonce le magazine et la brochure reçus après le scan', () => {
    ouvrir(ev(true, true));
    expect(screen.getByText('3 étapes, de l’inscription au jour J')).toBeTruthy();
    expect(screen.getByText('Je reçois le magazine et la brochure')).toBeTruthy();
    expect(
      screen.getByText(
        /QR code scanné à l’accueil, je reçois par email le magazine de la promotion PMD 2026 et la brochure Executive Education/,
      ),
    ).toBeTruthy();
  });

  it('sans magazine : la brochure seule', () => {
    ouvrir(ev(false, true));
    expect(screen.getByText('Je reçois la brochure Executive Education')).toBeTruthy();
    expect(screen.queryByText(/magazine/)).toBeNull();
  });

  it('sans aucun lien : l’étape reste, l’email part quand même', () => {
    ouvrir(ev(false, false));
    expect(screen.getByText('Je reçois un email de bienvenue')).toBeTruthy();
  });
});
