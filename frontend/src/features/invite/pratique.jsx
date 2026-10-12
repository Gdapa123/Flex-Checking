import { useId, useRef } from 'react';
import Icon from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toasts';
import useFocusTrap from '../../components/ui/useFocusTrap';
import { adresse, liensAgenda, liensItineraire } from '../../lib/agenda';

/** Liste d'options (agenda ou application d'itinéraire), chacune ouvrant le bon lien. */
function ListeOptions({ options, onChoix, children }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {options.map((o) => (
        <li key={o.cle}>
          <a
            href={o.href}
            {...(o.telechargement ? { download: true } : { target: '_blank', rel: 'noopener noreferrer' })}
            onClick={onChoix}
            className="flex min-h-[60px] items-center gap-3 rounded-bouton border border-bordure-carte bg-surface px-3.5 py-2.5 text-texte no-underline transition-colors hover:bg-fond hover:text-texte active:scale-[.99]"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-moyen bg-ps text-[20px] text-p">
              <Icon nom={o.icone} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[16px] font-semibold">{o.nom}</span>
              <span className="text-[13.5px] text-texte-2">{o.detail}</span>
            </span>
            <Icon nom={o.telechargement ? 'download' : 'external'} className="text-[17px] text-texte-3" />
          </a>
        </li>
      ))}
      {children}
    </ul>
  );
}

export function ChoixAgenda({ ev, onChoix }) {
  return <ListeOptions options={liensAgenda(ev)} onChoix={onChoix} />;
}

export function ChoixItineraire({ ev, onChoix }) {
  const toast = useToast();
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(adresse(ev));
      toast('Adresse copiée.');
    } catch {
      toast('Copie impossible : sélectionnez l’adresse manuellement.', 'erreur');
    }
    onChoix?.();
  };
  return (
    <ListeOptions options={liensItineraire(ev)} onChoix={onChoix}>
      <li>
        <button
          type="button"
          onClick={copier}
          className="flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-bouton border border-bordure-carte bg-surface px-3.5 py-2.5 text-left text-texte transition-colors hover:bg-fond active:scale-[.99]"
        >
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-moyen bg-subtil text-[20px] text-texte-2">
            <Icon nom="copy" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[16px] font-semibold">Copier l’adresse</span>
            <span className="truncate text-[13.5px] text-texte-2">{adresse(ev)}</span>
          </span>
        </button>
      </li>
    </ListeOptions>
  );
}

/** Feuille de choix : en bas de l'écran sur téléphone, centrée sur ordinateur. */
export function FeuilleChoix({ ouvert, titre, sousTitre, onFermer, children }) {
  const ref = useRef(null);
  const id = useId();
  useFocusTrap(ref, ouvert, onFermer);
  if (!ouvert) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-voile-fort sm:items-center sm:p-4"
      onClick={onFermer}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-[480px] animate-in-up flex-col gap-4 overflow-y-auto rounded-t-carte border border-bordure-carte bg-fond p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-dialogue outline-none sm:rounded-carte sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id={`${id}-t`} className="m-0 text-[19px] font-bold tracking-[-0.01em]">
              {titre}
            </h2>
            {sousTitre && <p className="m-0 text-[14px] text-texte-2">{sousTitre}</p>}
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-moyen border-0 bg-transparent text-[20px] text-texte-2 hover:bg-surface"
          >
            <Icon nom="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
