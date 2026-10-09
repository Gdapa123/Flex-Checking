import { useId, useRef } from 'react';
import Icon from './Icon';
import useFocusTrap from './useFocusTrap';

/** Dialogue de confirmation (alertdialog) — gabarit « Désactiver le programme ? » du design. */
export default function Dialogue({
  ouvert,
  titre,
  children,
  onFermer,
  actions,
  icone = 'alert',
  univers = 'mde',
  tonalite = 'avert',
}) {
  const ref = useRef(null);
  const id = useId();
  useFocusTrap(ref, ouvert, onFermer);
  if (!ouvert) return null;
  const mde = univers === 'mde';
  return (
    <div
      className={`fixed inset-0 z-50 flex animate-fade-in items-center justify-center p-4 ${mde ? 'bg-voile-mde' : 'bg-voile-fort'} ${mde ? 'univers-mde' : ''}`}
      onClick={onFermer}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full max-w-[440px] animate-scale-in flex-col gap-4 rounded-carte border bg-surface p-6 shadow-dialogue outline-none ${mde ? 'border-mde-bordure-carte text-mde-texte' : 'border-bordure-carte text-texte'}`}
      >
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-moyen text-[22px] ${
            tonalite === 'erreur'
              ? 'bg-erreur-doux text-erreur'
              : tonalite === 'info'
                ? 'bg-mde-survol text-mde-texte'
                : 'bg-avert-fond text-avert'
          }`}
        >
          <Icon nom={icone} />
        </div>
        <h2 id={`${id}-t`} className="m-0 text-[20px] font-bold tracking-[-0.015em]">
          {titre}
        </h2>
        <div id={`${id}-d`} className={`text-[15px] leading-[1.55] ${mde ? 'text-mde-texte-2' : 'text-texte-2'}`}>
          {children}
        </div>
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}
