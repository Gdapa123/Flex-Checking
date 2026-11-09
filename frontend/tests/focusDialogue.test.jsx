import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import PanneauLateral from '../src/components/ui/PanneauLateral';
import Dialogue from '../src/components/ui/Dialogue';

// Reproduit l'usage courant : onFermer en fonction fléchée recréée à chaque rendu.
function Formulaire({ Conteneur, onFermer }) {
  const [v, setV] = useState({ nom: '', email: '' });
  return (
    <Conteneur ouvert label="Test" titre="Test" onFermer={() => onFermer()}>
      <input aria-label="Nom" value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} />
      <input aria-label="Email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
    </Conteneur>
  );
}

describe.each([
  ['PanneauLateral', PanneauLateral],
  ['Dialogue', Dialogue],
])('%s : focus pendant la saisie', (_nom, Conteneur) => {
  it('garde le curseur dans le champ en cours de saisie', () => {
    render(<Formulaire Conteneur={Conteneur} onFermer={() => {}} />);
    const email = screen.getByLabelText('Email');
    email.focus();
    fireEvent.change(email, { target: { value: 'a' } });
    fireEvent.change(email, { target: { value: 'ab' } });
    expect(email).toHaveValue('ab');
    expect(document.activeElement).toBe(email);
  });

  it('Échap appelle la dernière fonction de fermeture', () => {
    const onFermer = vi.fn();
    render(<Formulaire Conteneur={Conteneur} onFermer={onFermer} />);
    const email = screen.getByLabelText('Email');
    fireEvent.change(email, { target: { value: 'x' } });
    fireEvent.keyDown(email, { key: 'Escape' });
    expect(onFermer).toHaveBeenCalledTimes(1);
  });
});
