import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import useTitre from '../../lib/useTitre';
import ThemeScope from '../../theme/ThemeScope';
import Icon from '../../components/ui/Icon';
import { ToastProvider } from '../../components/ui/Toasts';
import LienInvalide from './LienInvalide';
import { EnteteInvite, useEvenementPublic } from './commun';
import { ChoixAgenda, ChoixItineraire } from './pratique';

/** Infos pratiques (lien des boutons « Ajouter à l'agenda » et « Itinéraire » de l'email d'invitation). */
export default function PratiquePage() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const { data: ev, error } = useEvenementPublic(slug);
  useTitre(ev ? `Infos pratiques · ${ev.nomAffiche}` : 'Infos pratiques');

  useEffect(() => {
    if (!ev || !hash) return;
    const cible = document.getElementById(hash.slice(1));
    cible?.scrollIntoView({ block: 'start' });
    cible?.querySelector('h2')?.focus({ preventScroll: true });
  }, [ev, hash]);

  if (error?.status === 404) return <LienInvalide />;
  if (!ev) return <div className="min-h-[100dvh] bg-fond" aria-busy="true" />;
  return (
    <ThemeScope tokens={ev.tokens} className="min-h-[100dvh] bg-fond">
      <ToastProvider position="centre">
        <EnteteInvite ev={ev} />
        <main className="relative mx-auto -mt-8 flex max-w-[560px] flex-col gap-4 px-3 pb-10 sm:-mt-10">
          <Section
            id="agenda"
            icone="calendarPlus"
            titre="Ajouter à mon agenda"
            texte="Date, heure et lieu déjà remplis."
          >
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
          <p className="m-0 flex items-start gap-2 px-2 text-[14px] leading-[1.5] text-texte-2">
            <Icon nom="qr" className="mt-0.5 text-[16px]" />
            Le jour de la cérémonie, présentez à l’accueil le QR code reçu par email (ou votre code à 4 chiffres).
          </p>
        </main>
      </ToastProvider>
    </ThemeScope>
  );
}

function Section({ id, icone, titre, texte, children }) {
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
