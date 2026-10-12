import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import useTitre from '../../lib/useTitre';
import ThemeScope from '../../theme/ThemeScope';
import Icon from '../../components/ui/Icon';
import { ToastProvider } from '../../components/ui/Toasts';
import EtatErreur from '../../components/ui/EtatErreur';
import LienInvalide from './LienInvalide';
import { EnteteInvite, useEvenementPublic } from './commun';
import { InfosPratiques } from './pratique';

/** Infos pratiques (lien des boutons « Ajouter à l'agenda » et « Itinéraire » de l'email d'invitation). */
export default function PratiquePage() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const { data: ev, error, refetch } = useEvenementPublic(slug);
  useTitre(ev ? `Infos pratiques · ${ev.nomAffiche}` : 'Infos pratiques');

  useEffect(() => {
    if (!ev || !hash) return;
    const cible = document.getElementById(hash.slice(1));
    cible?.scrollIntoView({ block: 'start' });
    cible?.querySelector('h2')?.focus({ preventScroll: true });
  }, [ev, hash]);

  if (error?.status === 404) return <LienInvalide />;
  if (!ev && error)
    return <EtatErreur pleinePage titre="Infos pratiques indisponibles" erreur={error} onReessayer={() => refetch()} />;
  if (!ev) return <div className="min-h-[100dvh] bg-fond" aria-busy="true" />;
  return (
    <ThemeScope tokens={ev.tokens} className="min-h-[100dvh] bg-fond">
      <ToastProvider position="centre">
        <EnteteInvite ev={ev} />
        <main className="relative mx-auto -mt-8 flex max-w-[560px] flex-col gap-4 px-3 pb-10 sm:-mt-10">
          <InfosPratiques ev={ev} />
          <p className="m-0 flex items-start gap-2 px-2 text-[14px] leading-[1.5] text-texte-2">
            <Icon nom="qr" className="mt-0.5 text-[16px]" />
            Le jour de la cérémonie, présentez à l’accueil le QR code reçu par email (ou votre code à 4 chiffres).
          </p>
        </main>
      </ToastProvider>
    </ThemeScope>
  );
}
