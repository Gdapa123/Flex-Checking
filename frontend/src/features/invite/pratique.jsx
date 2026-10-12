import Icon from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toasts';
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

/** Sections « Ajouter à mon agenda » et « Itinéraire » (page /pratique et écran de confirmation). */
export function InfosPratiques({ ev }) {
  return (
    <>
      <Section id="agenda" icone="calendarPlus" titre="Ajouter à mon agenda" texte="Date, heure et lieu déjà remplis.">
        <ChoixAgenda ev={ev} />
      </Section>
      <Section
        id="itineraire"
        icone="navigation"
        titre="Itinéraire"
        texte="Ouvrez le trajet dans votre application de navigation."
      >
        <ChoixItineraire ev={ev} />
      </Section>
    </>
  );
}

export function Section({ id, icone, titre, texte, children }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="flex scroll-mt-4 animate-in-up flex-col gap-4 rounded-carte border border-bordure-carte bg-surface p-4 shadow-carte sm:p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-moyen bg-ps text-[20px] text-p">
          <Icon nom={icone} />
        </span>
        <div className="flex flex-col">
          <h2 id={`${id}-titre`} tabIndex={-1} className="m-0 text-[18px] font-bold tracking-[-0.01em] outline-none">
            {titre}
          </h2>
          <p className="m-0 text-[14px] text-texte-2">{texte}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
