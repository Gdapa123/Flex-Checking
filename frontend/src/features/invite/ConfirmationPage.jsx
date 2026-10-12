import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { dateLongue, heureTexte, INSCRIT_E } from '../../lib/format';
import useTitre from '../../lib/useTitre';
import ThemeScope from '../../theme/ThemeScope';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { ToastProvider, useToast } from '../../components/ui/Toasts';
import LienInvalide from './LienInvalide';
import { CLE_CONFIRMATION, EnteteInvite, useEvenementPublic } from './commun';
import { ChoixAgenda, ChoixItineraire, FeuilleChoix } from './pratique';

function lireConfirmation(slug, etat) {
  if (etat?.invite) return etat;
  try {
    return JSON.parse(sessionStorage.getItem(CLE_CONFIRMATION(slug)) || 'null');
  } catch {
    return null;
  }
}

/** I3 · Confirmation d'inscription. */
export default function ConfirmationPage() {
  const { slug } = useParams();
  const { state } = useLocation();
  const { data: ev, error } = useEvenementPublic(slug);
  const conf = lireConfirmation(slug, state);
  useTitre('Inscription réussie');
  if (error?.status === 404) return <LienInvalide />;
  if (!conf) return <Navigate to={`/i/${slug}`} replace />;
  if (!ev) return <div className="min-h-[100dvh] bg-fond" aria-busy="true" />;
  return (
    <ThemeScope tokens={ev.tokens} className="min-h-[100dvh] bg-fond">
      <ToastProvider position="centre">
        <Contenu ev={ev} conf={conf} slug={slug} />
      </ToastProvider>
    </ThemeScope>
  );
}

function Contenu({ ev, conf, slug }) {
  const toast = useToast();
  const [renvoye, setRenvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [feuille, setFeuille] = useState(null); // 'agenda' | 'itineraire'
  const fermer = useCallback(() => setFeuille(null), []);
  const { invite } = conf;
  useEffect(() => window.scrollTo(0, 0), []);
  const nomComplet = `${invite.civiliteAffichee} ${invite.prenom} ${invite.nom.toUpperCase()}`;

  const renvoyer = async () => {
    if (envoi) return;
    setEnvoi(true);
    try {
      const r = await api.post(`/public/evenements/${slug}/renvoi-qr/`, { email: conf.email });
      setRenvoye(true);
      toast(r.detail);
    } catch (e) {
      toast(
        e.status === 429
          ? 'Trop de demandes de renvoi. Réessayez dans une heure.'
          : 'Envoi impossible pour le moment. Réessayez.',
        'erreur',
      );
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <EnteteInvite ev={ev} variante="confirmation">
        <div className="flex flex-col items-center gap-3 pb-2 pt-1 text-center">
          <div className="flex h-[68px] w-[68px] animate-pop items-center justify-center rounded-full bg-blanc text-[34px] text-succes shadow-pastille">
            <Icon nom="check" />
          </div>
          <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.035em]">Inscription réussie</h1>
          <p className="m-0 max-w-[340px] text-[16px] leading-[1.5] [text-wrap:pretty]">
            Consultez votre boîte mail : votre invitation vient de vous être envoyée.
          </p>
        </div>
      </EnteteInvite>
      <main className="relative mx-auto -mt-10 flex max-w-[560px] flex-col gap-4 px-3 pb-10">
        <section className="flex animate-in-up flex-col gap-4 rounded-carte border border-bordure-carte bg-surface p-5 shadow-carte [animation-delay:.05s]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[18px] font-semibold">{nomComplet}</p>
            <Badge type="INSCRIT" className="!text-[14px] !font-medium">
              {INSCRIT_E}
            </Badge>
          </div>
          <div className="h-px bg-bordure-ligne" />
          <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[16px]">
            <li className="flex items-center gap-3">
              <Icon nom="calendar" className="text-[20px] text-texte-2" />
              {dateLongue(ev.date)}
            </li>
            <li className="flex items-center gap-3">
              <Icon nom="clock" className="text-[20px] text-texte-2" />
              {heureTexte(ev.heureDebut)} · accueil dès {heureTexte(ev.heureAccueil)}
            </li>
            <li className="flex items-center gap-3">
              <Icon nom="mapPin" className="text-[20px] text-texte-2" />
              {ev.lieu}
            </li>
          </ul>
        </section>
        <section className="flex animate-in-up items-start gap-4 rounded-carte border border-bordure-carte bg-surface p-5 shadow-carte [animation-delay:.1s]">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-moyen bg-ps text-[22px] text-p">
            <Icon nom="qr" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="m-0 text-[16px] font-semibold">Votre invitation</p>
            <p className="m-0 text-[15px] leading-[1.5] text-texte-2">
              Envoyée par email avec votre QR code et votre code à 4 chiffres. Présentez-la à l’accueil le jour de la
              cérémonie.
            </p>
          </div>
        </section>
        <div
          className="grid animate-in-up gap-3 [animation-delay:.15s]"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))' }}
        >
          <button
            type="button"
            onClick={() => setFeuille('agenda')}
            className="btn-principal flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-bouton border-0 text-[16px] font-semibold active:scale-[.98]"
          >
            <Icon nom="calendarPlus" className="text-[20px]" />
            Ajouter à l’agenda
          </button>
          <button
            type="button"
            onClick={() => setFeuille('itineraire')}
            className="flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-bouton border border-champ bg-surface text-[16px] font-semibold text-texte shadow-champ transition-colors hover:bg-fond active:scale-[.98]"
          >
            <Icon nom="navigation" className="text-[20px]" />
            Enregistrer l’itinéraire
          </button>
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={renvoyer}
            disabled={renvoye}
            className="flex min-h-[44px] cursor-pointer items-center gap-2 border-0 bg-transparent text-[16px] text-texte disabled:cursor-default"
          >
            Email non reçu ?
            <span className="font-semibold text-p underline underline-offset-[3px]">
              {renvoye ? 'Invitation renvoyée' : envoi ? 'Envoi…' : 'renvoyez-le'}
            </span>
          </button>
        </div>
      </main>
      <FeuilleChoix
        ouvert={feuille === 'agenda'}
        titre="Ajouter à mon agenda"
        sousTitre="Choisissez votre agenda : l’événement s’y ajoute avec un rappel 2 h avant."
        onFermer={fermer}
      >
        <ChoixAgenda ev={ev} onChoix={fermer} />
      </FeuilleChoix>
      <FeuilleChoix
        ouvert={feuille === 'itineraire'}
        titre="Itinéraire"
        sousTitre="Ouvrez le trajet dans votre application de navigation."
        onFermer={fermer}
      >
        <ChoixItineraire ev={ev} onChoix={fermer} />
      </FeuilleChoix>
    </>
  );
}
