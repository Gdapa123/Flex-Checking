import { useRef } from 'react';
import useFocusTrap from './useFocusTrap';
import useVerrouDefilement from './useVerrouDefilement';

/** Panneau latéral droit (dialog modal) : fiche invité, ajout d'invité. */
export default function PanneauLateral({ ouvert, label, onFermer, children, style, className = '' }) {
  const ref = useRef(null);
  useFocusTrap(ref, ouvert, onFermer);
  useVerrouDefilement(ouvert);
  if (!ouvert) return null;
  return (
    <div style={style} className={className}>
      <div className="fixed inset-0 z-50 animate-fade-in bg-voile" onClick={onFermer} />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="fixed bottom-0 right-0 top-0 z-[51] flex w-[min(460px,100vw)] animate-in-r flex-col border-l border-bordure bg-surface text-texte shadow-panneau outline-none"
      >
        {children}
      </aside>
    </div>
  );
}
