import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import { dateLongue, heure } from '../../lib/format';
import useTitre from '../../lib/useTitre';
import ThemeScope from '../../theme/ThemeScope';
import Icon from '../../components/ui/Icon';
import EtatErreur from '../../components/ui/EtatErreur';
import useFocusTrap from '../../components/ui/useFocusTrap';
import useVerrouDefilement from '../../components/ui/useVerrouDefilement';
import LienInvalide from './LienInvalide';
import { EnteteInvite } from './commun';
import { CONTROLE_MULTILIGNE_RE } from '../../lib/schemas';

const CLE_APPAREIL = 'fc-appareil';
const NOTES = ['Décevante', 'Moyenne', 'Bien', 'Très bien', 'Excellente'];
const MAX_COMMENTAIRE = 1000;

/** Identifiant tiré une fois par navigateur : second repère « un avis par appareil » (le cookie est le premier). */
function identifiantAppareil() {
  try {
    let id = localStorage.getItem(CLE_APPAREIL);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, '');
      localStorage.setItem(CLE_APPAREIL, id);
    }
    return id;
  } catch {
    return '';
  }
}

/** Sondage de satisfaction (lien personnel de l'email n°3, valable 24 h). */
export default function SondagePage() {
  const { jeton } = useParams();
  const { data, error, refetch } = useQuery({
    queryKey: ['sondage-public', jeton],
    queryFn: () => api.get(`/public/sondages/${jeton}/`),
    retry: (n, e) => n < 2 && e?.status !== 404,
    refetchOnWindowFocus: false,
  });
  const [etat, setEtat] = useState(null); // état local après l'envoi : REPONDU | APPAREIL | EXPIRE
  useTitre(data ? `Votre avis · ${data.evenement.nomAffiche}` : 'Votre avis');

  if (error?.status === 404)
    return (
      <LienInvalide
        titre="Ce lien de sondage n’est pas valide"
        texte="Le lien utilisé est incomplet ou incorrect. Ouvrez le bouton « Donner mon avis » de l’email reçu après la cérémonie."
      />
    );
  if (!data && error)
    return <EtatErreur pleinePage titre="Sondage indisponible" erreur={error} onReessayer={() => refetch()} />;
  if (!data) return <div className="min-h-[100dvh] bg-fond" aria-busy="true" />;

  const ev = data.evenement;
  const courant = etat || data.etat;
  return (
    <ThemeScope tokens={ev.tokens} className="min-h-[100dvh] bg-fond">
      <EnteteInvite ev={ev} variante="sondage">
        <div className="flex flex-col gap-1.5 sm:gap-2.5">
          <p className="m-0 text-[13.5px] font-medium sm:text-[15px]">Votre avis sur la cérémonie</p>
          <h1 className="m-0 text-[clamp(25px,7.4vw,30px)] font-extrabold leading-[1.05] tracking-[-0.035em] [text-wrap:balance] sm:text-[40px] sm:leading-none">
            {ev.nomAffiche}
          </h1>
          <span className="h-1 w-14 rounded-sm bg-s" />
        </div>
      </EnteteInvite>
      <main className="relative mx-auto -mt-8 flex max-w-[560px] flex-col gap-4 px-3 pb-10 sm:-mt-10">
        {courant === 'OUVERT' && (
          <Formulaire
            jeton={jeton}
            donnees={data}
            onTermine={(e) => {
              setEtat(e);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
        {(courant === 'REPONDU' || courant === 'APPAREIL') && (
          <Merci prenom={data.prenom} dejaAppareil={courant === 'APPAREIL'} dejaLien={!etat} />
        )}
        {courant === 'EXPIRE' && <SondageClos ev={ev} prenom={data.prenom} />}
      </main>
    </ThemeScope>
  );
}

/* ------------------------------------------------------------------ formulaire */
function Formulaire({ jeton, donnees, onTermine }) {
  const [globale, setGlobale] = useState(null);
  const [accueil, setAccueil] = useState(null);
  const [reco, setReco] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [tente, setTente] = useState(false);
  const complet = globale && accueil && reco !== null;

  const envoyer = async (e) => {
    e.preventDefault();
    setTente(true);
    if (!complet || envoi) return;
    setEnvoi(true);
    setErreur('');
    try {
      await api.post(`/public/sondages/${jeton}/`, {
        noteGlobale: globale,
        noteAccueil: accueil,
        recommandation: reco,
        commentaire: commentaire.replace(CONTROLE_MULTILIGNE_RE, '').trim(),
        appareil: identifiantAppareil(),
      });
      onTermine('REPONDU');
    } catch (err) {
      if (err?.data?.code === 'SONDAGE_EXPIRE') return onTermine('EXPIRE');
      if (err?.data?.code === 'DEJA_REPONDU') return onTermine('REPONDU');
      if (err?.data?.code === 'APPAREIL_DEJA_UTILISE') return onTermine('APPAREIL');
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form
      onSubmit={envoyer}
      noValidate
      className="flex animate-in-up flex-col gap-7 rounded-carte border border-bordure-carte bg-surface px-5 py-6 shadow-carte sm:px-7 sm:py-7"
    >
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[17px] font-semibold">Bonjour {donnees.prenom},</p>
        <p className="m-0 text-[15.5px] leading-[1.55] text-texte-3 [text-wrap:pretty]">
          Merci d’avoir été des nôtres. Trois questions, moins de deux minutes : vos réponses nous aident à préparer les
          prochaines cérémonies.
        </p>
      </div>

      <Etoiles
        id="q-globale"
        question="Dans l’ensemble, comment avez-vous trouvé la cérémonie ?"
        valeur={globale}
        onChange={setGlobale}
        erreur={tente && !globale}
      />
      <Etoiles
        id="q-accueil"
        question="Et l’accueil à votre arrivée ?"
        valeur={accueil}
        onChange={setAccueil}
        erreur={tente && !accueil}
      />
      <Recommandation valeur={reco} onChange={setReco} erreur={tente && reco === null} />

      <div className="flex flex-col gap-2">
        <label htmlFor="commentaire" className="text-[15.5px] font-semibold">
          Un mot à ajouter ? <span className="font-normal text-texte-2">(facultatif)</span>
        </label>
        <textarea
          id="commentaire"
          value={commentaire}
          maxLength={MAX_COMMENTAIRE}
          rows={4}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Ce que vous avez aimé, ce que nous pourrions améliorer…"
          aria-describedby="commentaire-compte"
          className="w-full resize-y rounded-champ border border-champ bg-surface px-3.5 py-3 text-[16px] leading-[1.5] text-texte outline-none placeholder:text-texte-2 focus:border-p"
        />
        <span id="commentaire-compte" className="self-end text-[13px] text-texte-2">
          {commentaire.length} / {MAX_COMMENTAIRE}
        </span>
      </div>

      {erreur && (
        <p role="alert" className="m-0 flex items-start gap-2 text-[15px] text-erreur">
          <Icon nom="alertCircle" className="mt-0.5 text-[18px]" />
          {erreur}
        </p>
      )}
      {tente && !complet && (
        <p id="erreur-questions" role="alert" className="m-0 flex items-start gap-2 text-[15px] text-erreur">
          <Icon nom="alertCircle" className="mt-0.5 text-[18px]" />
          Répondez aux trois questions pour envoyer votre avis.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={envoi}
          className="btn-principal flex h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-bouton border-0 text-[16px] font-semibold active:scale-[.98] disabled:opacity-60"
        >
          <Icon nom="send" className="text-[18px]" />
          {envoi ? 'Envoi…' : 'Envoyer mon avis'}
        </button>
        <p className="m-0 flex items-center justify-center gap-1.5 text-center text-[13.5px] text-texte-2">
          <Icon nom="clock" className="text-[14px]" />
          Ouvert jusqu’au {dateLongue(donnees.expireLe, false)} à {heure(donnees.expireLe)} · une réponse par personne
        </p>
      </div>
    </form>
  );
}

function Etoiles({ id, question, valeur, onChange, erreur }) {
  const affiche = valeur;
  const bouger = (e, v) => {
    const suivant = { ArrowRight: v + 1, ArrowUp: v + 1, ArrowLeft: v - 1, ArrowDown: v - 1 }[e.key];
    if (!suivant || suivant < 1 || suivant > 5) return;
    e.preventDefault();
    onChange(suivant);
    e.currentTarget.parentElement.children[suivant - 1].focus();
  };
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend id={id} className="mb-2.5 p-0 text-[15.5px] font-semibold leading-snug">
        {question}
      </legend>
      <div
        role="radiogroup"
        aria-labelledby={id}
        aria-invalid={erreur || undefined}
        aria-describedby={erreur ? 'erreur-questions' : undefined}
        className="flex gap-1.5"
      >
        {NOTES.map((libelle, i) => {
          const v = i + 1;
          const plein = affiche !== null && v <= affiche;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={valeur === v}
              aria-label={`${v} sur 5 · ${libelle}`}
              tabIndex={valeur === v || (valeur === null && v === 1) ? 0 : -1}
              onClick={() => onChange(v)}
              onKeyDown={(e) => bouger(e, valeur ?? 0)}
              className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-champ border-0 bg-transparent text-[34px] transition-transform active:scale-90 ${plein ? 'text-p' : 'text-champ'}`}
            >
              <Icon nom="star" className={plein ? 'fill-current' : ''} />
            </button>
          );
        })}
      </div>
      <span
        aria-hidden="true"
        className={`min-h-5 text-[14px] ${affiche ? 'font-semibold text-texte' : 'text-texte-2'}`}
      >
        {affiche ? NOTES[affiche - 1] : 'Touchez une étoile'}
      </span>
    </fieldset>
  );
}

function Recommandation({ valeur, onChange, erreur }) {
  const bouger = (e, v) => {
    const suivant = { ArrowRight: v + 1, ArrowUp: v + 1, ArrowLeft: v - 1, ArrowDown: v - 1 }[e.key];
    if (suivant === undefined || suivant < 0 || suivant > 10) return;
    e.preventDefault();
    onChange(suivant);
    e.currentTarget.parentElement.querySelectorAll('[role="radio"]')[suivant]?.focus();
  };
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend id="q-reco" className="mb-2.5 p-0 text-[15.5px] font-semibold leading-snug">
        Recommanderiez-vous MDE Business School à un proche ?
      </legend>
      {/* deux rangées sur mobile (0-5, 6-10) : cibles d'au moins 44 px */}
      <div
        role="radiogroup"
        aria-labelledby="q-reco"
        aria-describedby={erreur ? 'erreur-questions' : undefined}
        aria-invalid={erreur || undefined}
        className="grid grid-cols-6 gap-1.5 min-[420px]:grid-cols-11 min-[420px]:gap-1"
      >
        {Array.from({ length: 11 }, (_, v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={valeur === v}
            aria-label={`${v} sur 10`}
            tabIndex={valeur === v || (valeur === null && v === 0) ? 0 : -1}
            onClick={() => onChange(v)}
            onKeyDown={(e) => bouger(e, valeur ?? 0)}
            className={`flex h-11 min-w-0 cursor-pointer items-center justify-center rounded-[8px] border text-[15px] font-semibold tabular-nums transition-colors ${valeur === v ? 'border-p bg-p text-op shadow-[0_2px_8px_-2px_var(--p)]' : 'border-champ bg-surface text-texte hover:bg-fond'}`}
          >
            {v}
          </button>
        ))}
      </div>
      <div aria-hidden="true" className="flex justify-between text-[13px] text-texte-2">
        <span>0 · Pas du tout</span>
        <span>10 · Tout à fait</span>
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ remerciements */
function Merci({ prenom, dejaAppareil, dejaLien }) {
  return (
    <section
      aria-live="polite"
      className="flex animate-in-up flex-col items-center gap-4 rounded-carte border border-bordure-carte bg-surface px-6 py-9 text-center shadow-carte"
    >
      <span className="flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-succes-doux text-[30px] text-succes">
        <Icon nom="check" />
      </span>
      <h2 className="m-0 text-[24px] font-bold tracking-[-0.02em]">{prenom ? `Merci ${prenom} !` : 'Merci !'}</h2>
      <p className="m-0 max-w-[420px] text-[16px] leading-[1.55] text-texte-3 [text-wrap:pretty]">
        {dejaAppareil
          ? 'Un avis a déjà été envoyé depuis cet appareil pour cette cérémonie. Merci pour votre participation.'
          : dejaLien
            ? 'Votre avis a bien été reçu. Merci d’avoir pris le temps de nous répondre.'
            : 'Votre avis est bien enregistré. Il nous aidera à faire encore mieux lors des prochaines cérémonies.'}
      </p>
      <p className="m-0 flex items-center gap-1.5 text-[14px] text-texte-2">
        <Icon nom="heart" className="text-[15px] text-p" />
        L’équipe MDE Business School
      </p>
    </section>
  );
}

/** Lien de plus de 24 h : fenêtre « sondage clos » à l'ouverture, puis rappel sur la page. */
function SondageClos({ ev, prenom }) {
  const [ouvert, setOuvert] = useState(true);
  return (
    <>
      <section className="flex animate-in-up flex-col items-center gap-3 rounded-carte border border-bordure-carte bg-surface px-6 py-8 text-center shadow-carte">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-subtil text-[26px] text-texte-3">
          <Icon nom="hourglass" />
        </span>
        <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Le sondage est clos</h2>
        <p className="m-0 max-w-[400px] text-[15.5px] leading-[1.55] text-texte-3">
          Merci{prenom ? ` ${prenom}` : ''} pour votre présence à la {ev.nomAffiche}. À très bientôt !
        </p>
      </section>
      {ouvert && <PopupClos ev={ev} prenom={prenom} onFermer={() => setOuvert(false)} />}
    </>
  );
}

function PopupClos({ ev, prenom, onFermer }) {
  const ref = useRef(null);
  useFocusTrap(ref, true, onFermer);
  useVerrouDefilement(true);
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-voile-fort p-3 backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onFermer}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clos-titre"
        aria-describedby="clos-texte"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] animate-scale-in overflow-hidden rounded-carte bg-surface shadow-dialogue outline-none"
      >
        <div className="entete-degrade hachures relative flex flex-col items-center gap-3 px-6 pb-9 pt-8 text-center">
          <span className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full border border-blanc-26 bg-noir-16 text-[34px]">
            <Icon nom="hourglass" />
          </span>
          <p className="relative m-0 text-[13px] font-semibold uppercase tracking-[.08em] opacity-90">
            {ev.nomAffiche}
          </p>
        </div>
        <div className="-mt-4 flex flex-col gap-3 rounded-t-carte bg-surface px-6 pb-6 pt-6 text-center">
          <h2
            id="clos-titre"
            className="m-0 text-[23px] font-bold leading-tight tracking-[-0.02em] [text-wrap:balance]"
          >
            Le temps du sondage est passé
          </h2>
          <div
            id="clos-texte"
            className="flex flex-col gap-2 text-[15.5px] leading-[1.55] text-texte-3 [text-wrap:pretty]"
          >
            <p className="m-0">
              Le questionnaire était ouvert pendant 24 heures après la cérémonie et il est maintenant fermé.
            </p>
            <p className="m-0">
              Merci{prenom ? ` ${prenom}` : ''}, du fond du cœur, d’avoir partagé ce moment avec les diplômés. Nous
              espérons vous revoir très bientôt.
            </p>
          </div>
          <p className="m-0 flex items-center justify-center gap-1.5 text-[14px] font-medium text-texte-2">
            <Icon nom="heart" className="fill-current text-[15px] text-p" />
            L’équipe MDE Business School
          </p>
          <button
            type="button"
            data-autofocus
            onClick={onFermer}
            className="btn-principal mt-2 flex h-12 cursor-pointer items-center justify-center rounded-bouton border-0 text-[16px] font-semibold active:scale-[.98]"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
