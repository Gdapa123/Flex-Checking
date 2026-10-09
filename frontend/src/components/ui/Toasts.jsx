import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from './Icon';

const Ctx = createContext({ toast: () => {} });

/**
 * Toasts (aria-live). `position` : coin bas droit (admin, super admin) ou bas centré (invité).
 * `univers` : programme | mde.
 */
export function ToastProvider({ children, position = 'droite', univers = 'programme' }) {
  const [liste, setListe] = useState([]);
  const n = useRef(0);
  const fermer = useCallback((id) => setListe((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (msg, type = 'ok', duree = 4200) => {
      const id = ++n.current;
      setListe((l) => [...l, { id, msg, type }].slice(-3));
      setTimeout(() => fermer(id), duree);
    },
    [fermer],
  );
  const valeur = useMemo(() => ({ toast }), [toast]);
  const fond = univers === 'mde' ? 'bg-mde-texte' : 'bg-texte';
  const pos =
    position === 'centre'
      ? 'left-4 right-4 bottom-6 items-center'
      : 'right-4 bottom-4 sm:right-6 sm:bottom-6 items-end left-4 sm:left-auto';
  return (
    <Ctx.Provider value={valeur}>
      {children}
      <div aria-live="polite" role="status" className={`pointer-events-none fixed z-[60] flex flex-col gap-2 ${pos}`}>
        {liste.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex min-w-0 max-w-[420px] animate-in-up items-start gap-3 rounded-[12px] px-3.5 py-3 text-[15px] leading-[1.45] text-blanc shadow-toast sm:min-w-[280px] ${fond}`}
          >
            <span
              className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[13px] ${
                t.type === 'erreur' ? 'bg-erreur' : t.type === 'info' ? 'bg-texte-2' : 'bg-succes'
              }`}
            >
              <Icon nom={t.type === 'erreur' ? 'alertCircle' : t.type === 'info' ? 'info' : 'check'} />
            </span>
            <span className="flex-1">{t.msg}</span>
            {position !== 'centre' && (
              <button
                type="button"
                onClick={() => fermer(t.id)}
                aria-label="Fermer"
                className="-mr-1 -mt-[3px] flex h-7 w-7 cursor-pointer items-center justify-center border-0 bg-transparent text-[16px] text-g-texte-2"
              >
                <Icon nom="x" />
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx).toast;
