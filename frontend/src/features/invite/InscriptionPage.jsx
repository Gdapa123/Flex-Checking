import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { erreursParChamp, formaterTelephone, schemaInscription } from '../../lib/schemas';
import useTitre from '../../lib/useTitre';
import ThemeScope from '../../theme/ThemeScope';
import Champ from '../../components/ui/Champ';
import Icon from '../../components/ui/Icon';
import Segmente from '../../components/ui/Segmente';
import Spinner from '../../components/ui/Spinner';
import Squelette from '../../components/ui/Squelette';
import { ToastProvider } from '../../components/ui/Toasts';
import EtatErreur from '../../components/ui/EtatErreur';
import EtatCarte from './EtatCarte';
import LienInvalide from './LienInvalide';
import Presentation from './Presentation';
import { CLE_CONFIRMATION, EnteteInvite, useEvenementPublic } from './commun';

const VIDE = {
  civilite: '',
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  entreprise: '',
  fonction: '',
  consentementDonnees: false,
};
const ORDRE = ['civilite', 'nom', 'prenom', 'email', 'telephone', 'entreprise', 'fonction', 'consentementDonnees'];

// Tous les champs sont obligatoires. `demi` = demi-largeur sur mobile (deux champs par ligne) ;
// Email et Téléphone prennent toute la largeur.
const CHAMPS = [
  { k: 'nom', demi: true, ac: 'family-name', ph: 'Ex. KOUASSI' },
  { k: 'prenom', demi: true, ac: 'given-name', ph: 'Ex. Aya' },
  { k: 'email', type: 'email', im: 'email', ac: 'email', ph: 'nom@entreprise.ci' },
  { k: 'telephone', type: 'tel', im: 'tel', ac: 'tel-national', ph: '07 12 34 56 78', prefixe: '+225' },
  { k: 'entreprise', demi: true, ac: 'organization', ph: 'Ex. Orange CI' },
  { k: 'fonction', demi: true, ac: 'organization-title', ph: 'Ex. Directrice RH' },
];
const NOMS_CHAMPS = {
  nom: 'Nom',
  prenom: 'Prénom',
  email: 'Email',
  telephone: 'Téléphone',
  entreprise: 'Entreprise',
  fonction: 'Fonction',
};

/** I1 · Inscription (et I2 erreurs de saisie, I4 à I8 états). */
export default function InscriptionPage() {
  const { slug } = useParams();
  const { data: ev, isLoading, error, refetch } = useEvenementPublic(slug);
  useTitre(ev ? `Inscription · ${ev.nomAffiche}` : 'Inscription');

  if (error?.status === 404) return <LienInvalide />;
  if (!ev && error && !isLoading)
    return <EtatErreur pleinePage titre="Page indisponible" erreur={error} onReessayer={() => refetch()} />;
  if (isLoading || !ev) return <Chargement />;
  return (
    <ThemeScope tokens={ev.tokens} className="min-h-[100dvh] bg-fond">
      <ToastProvider position="centre">
        <Formulaire ev={ev} slug={slug} />
      </ToastProvider>
    </ThemeScope>
  );
}

function Chargement() {
  return (
    <div className="min-h-[100dvh] bg-fond" aria-busy="true">
      <div className="h-[280px] bg-subtil" />
      <div className="mx-auto -mt-10 flex max-w-[560px] flex-col gap-4 rounded-carte bg-surface p-6 shadow-carte">
        <Squelette className="h-6 w-1/2" />
        <Squelette className="h-12" />
        <Squelette className="h-12" />
        <Squelette className="h-12" />
      </div>
    </div>
  );
}

function Formulaire({ ev, slug }) {
  const naviguer = useNavigate();
  const [v, setV] = useState(VIDE);
  const [touche, setTouche] = useState({});
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreursServeur, setErreursServeur] = useState({});
  const [etat, setEtat] = useState(ev.etat !== 'OUVERT' ? ev.etat : null);
  // Écran de présentation des étapes avant le formulaire. L'étape est dans l'URL (entrée d'historique) :
  // le bouton retour du téléphone revient à la présentation au lieu de quitter le site, et un rechargement la conserve.
  const [parametres] = useSearchParams();
  const commence = parametres.get('etape') === 'formulaire';
  const commencer = () => {
    naviguer('?etape=formulaire');
    window.scrollTo(0, 0);
  };

  const erreurs = useMemo(
    () => ({ ...erreursParChamp(schemaInscription.safeParse(v)), ...erreursServeur }),
    [v, erreursServeur],
  );
  const visible = (k) => !!erreurs[k] && (touche[k] || soumis);
  // Champ laissé vide : message court ; les erreurs de format gardent leur explication.
  const message = (k) => (String(v[k] ?? '').trim() === '' ? 'Champ obligatoire' : erreurs[k]);
  const nbManquants = ORDRE.filter((k) => erreurs[k]).length;

  const maj = (k, val) => {
    setV((x) => ({ ...x, [k]: val }));
    if (erreursServeur[k]) setErreursServeur(({ [k]: _, ...reste }) => reste);
  };

  const soumettre = async () => {
    if (envoi) return;
    setSoumis(true);
    setTouche({ nom: 1, prenom: 1, email: 1, telephone: 1 });
    const r = schemaInscription.safeParse(v);
    if (!r.success) {
      premierChamp(erreursParChamp(r));
      return;
    }
    setEnvoi(true);
    try {
      const rep = await api.post(`/public/evenements/${slug}/inscription/`, { ...v, telephone: v.telephone });
      const conf = { invite: rep.invite, email: v.email.trim().toLowerCase() };
      try {
        sessionStorage.setItem(CLE_CONFIRMATION(slug), JSON.stringify(conf));
      } catch {
        /* stockage indisponible : l'état de navigation suffit */
      }
      naviguer(`/i/${slug}/confirmation`, { state: conf });
    } catch (e) {
      setEnvoi(false);
      if (e.status === 409 && e.code) {
        setEtat(e.code);
        window.scrollTo({ top: 0 });
      } else if (e.status === 400 && e.data && !e.data.code) {
        const srv = {};
        Object.entries(e.data).forEach(([k, msgs]) => (srv[k] = Array.isArray(msgs) ? msgs[0] : String(msgs)));
        setErreursServeur(srv);
        premierChamp(srv);
      } else {
        setErreursServeur({
          general:
            e.status === 429
              ? 'Trop de tentatives. Réessayez dans quelques minutes.'
              : e.data?.detail
                ? e.data.detail
                : e.status === 503
                  ? 'Service momentanément saturé, réessayez dans une minute.'
                  : e.status >= 500
                    ? 'Une erreur est survenue de notre côté. Réessayez dans un instant.'
                    : 'L’envoi a échoué. Vérifiez votre connexion puis réessayez.',
        });
      }
    }
  };

  if (etat) {
    return (
      <>
        <EnteteInvite ev={ev} />
        <EtatCarte
          ev={ev}
          etat={etat}
          email={v.email}
          onAutreAdresse={() => {
            setEtat(null);
            maj('email', '');
            setSoumis(false);
          }}
        />
      </>
    );
  }

  /** Amène au premier champ à compléter (dans l'ordre du formulaire), sans saut brusque. */
  function premierChamp(errs) {
    const k = ORDRE.find((c) => errs[c]);
    if (!k) return;
    const el =
      k === 'civilite'
        ? document.querySelector('[role=radio]')
        : document.getElementById(k === 'consentementDonnees' ? 'champ-consentement' : `champ-${k}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  }

  if (!commence) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <EnteteInvite ev={ev} />
        <Presentation ev={ev} onCommencer={commencer} />
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        soumettre();
      }}
      className="flex min-h-[100dvh] flex-col"
    >
      <EnteteInvite ev={ev} />
      <main className="relative mx-auto -mt-8 flex w-full max-w-[560px] flex-1 flex-col gap-3 px-3 pb-2 sm:-mt-10 sm:gap-4 sm:pb-8">
        {erreursServeur.general && (
          <div
            role="alert"
            className="flex gap-3 rounded-[12px] border border-erreur-bord bg-erreur-doux p-4 text-[15px] text-erreur-texte"
          >
            <Icon nom="alertCircle" className="mt-px text-[22px] text-erreur" />
            {erreursServeur.general}
          </div>
        )}

        <section className="flex animate-in-up flex-col gap-4 rounded-carte border border-bordure-carte bg-surface px-4 py-4 shadow-carte sm:gap-6 sm:px-5 sm:py-6">
          <div className="flex items-baseline justify-between gap-1 sm:flex-col sm:items-start">
            <h2 className="m-0 text-[17px] font-semibold tracking-[-0.01em] sm:text-[20px]">Vos informations</h2>
            <p className="m-0 text-[12.5px] text-texte-2 sm:text-[15px]">
              <span className="sm:hidden">Champs obligatoires</span>
              <span className="hidden sm:inline">Tous les champs sont obligatoires.</span>
            </p>
          </div>

          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className="flex items-center gap-x-4 gap-y-2 sm:flex-col sm:items-start">
              <span id="civ-label" className="text-[13px] font-medium sm:text-[15px]">
                Civilité
              </span>
              <div
                className={`w-[148px] flex-none rounded-moyen border sm:w-[176px] ${soumis && erreurs.civilite ? 'border-erreur' : 'border-transparent'}`}
              >
                <Segmente
                  labelledBy="civ-label"
                  grille
                  taille="sm"
                  valeur={v.civilite || null}
                  onChange={(c) => maj('civilite', c)}
                  options={[
                    { value: 'MME', label: 'Mme' },
                    { value: 'M', label: 'M.' },
                  ]}
                />
              </div>
            </div>
            {soumis && erreurs.civilite && (
              <p className="m-0 flex items-center gap-1.5 text-[14px] text-erreur">
                <Icon nom="alertCircle" className="text-[16px]" />
                Choisissez une civilité.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-5">
            {CHAMPS.map((f) => {
              const err = visible(f.k) ? message(f.k) : '';
              const valide = !err && touche[f.k] && !erreurs[f.k] && String(v[f.k]).trim().length > 0;
              return (
                <Champ
                  key={f.k}
                  id={`champ-${f.k}`}
                  className={f.demi ? '' : 'col-span-2 sm:col-span-1'}
                  label={NOMS_CHAMPS[f.k]}
                  type={f.type || 'text'}
                  inputMode={f.im || 'text'}
                  autoComplete={f.ac}
                  placeholder={f.ph}
                  prefixe={f.prefixe}
                  value={v[f.k]}
                  required
                  erreur={err}
                  valide={valide}
                  compact
                  onChange={(e) => maj(f.k, f.k === 'telephone' ? formaterTelephone(e.target.value) : e.target.value)}
                  onBlur={() => setTouche((t) => ({ ...t, [f.k]: 1 }))}
                />
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="champ-consentement"
              className="flex cursor-pointer items-start gap-3 text-[13px] leading-[1.45] text-texte-2 sm:text-[14px] sm:leading-[1.5]"
            >
              <input
                id="champ-consentement"
                type="checkbox"
                checked={v.consentementDonnees}
                onChange={(e) => maj('consentementDonnees', e.target.checked)}
                aria-invalid={soumis && !!erreurs.consentementDonnees}
                aria-describedby={soumis && erreurs.consentementDonnees ? 'consentement-erreur' : undefined}
                className="mt-0.5 h-5 w-5 flex-none cursor-pointer accent-p sm:h-[22px] sm:w-[22px]"
              />
              <span className="font-medium text-texte">
                J’accepte la{' '}
                <a
                  href="/confidentialite"
                  target="_blank"
                  rel="noopener"
                  className="font-semibold text-p underline underline-offset-2"
                >
                  politique de confidentialité
                </a>{' '}
                et les conditions d’utilisation du service
                <span className="mt-0.5 block font-normal text-texte-2">
                  Vos données sont traitées de façon confidentielle et sécurisée, conformément à la loi ivoirienne n°
                  2013-450 sur la protection des données personnelles.
                </span>
              </span>
            </label>
            {soumis && erreurs.consentementDonnees && (
              <p id="consentement-erreur" className="m-0 flex items-start gap-1.5 text-[14px] text-erreur">
                <Icon nom="alertCircle" className="mt-px text-[16px]" />
                {erreurs.consentementDonnees}
              </p>
            )}
          </div>
        </section>
        <p className="m-0 hidden px-2 text-center text-[14px] leading-[1.5] text-texte-2 sm:block">
          Votre invitation, avec votre QR code et votre code à 4 chiffres, vous sera envoyée par email.
        </p>
      </main>

      <div className="sticky bottom-0 z-10 -mt-7 bg-gradient-to-b from-transparent via-fond via-45% to-fond px-4 pb-3 pt-5 sm:pb-4 sm:pt-6">
        <div className="mx-auto flex max-w-[560px] flex-col gap-2">
          <div role="status" aria-live="polite" className="flex justify-center">
            {soumis && nbManquants > 0 && (
              <span className="inline-flex animate-in-up items-center gap-1.5 rounded-full border border-erreur-bord bg-surface px-3 py-1 text-[13px] font-medium text-erreur-texte shadow-carte">
                <Icon nom="alertCircle" className="text-[15px] text-erreur" />
                {nbManquants > 1 ? `${nbManquants} informations à compléter` : '1 information à compléter'}
              </span>
            )}
          </div>
          <button
            type="submit"
            aria-busy={envoi}
            className={`btn-principal flex h-[52px] w-full sm:h-14 cursor-pointer items-center justify-center gap-2.5 rounded-bouton border-0 pl-5 pr-2 text-[16px] font-semibold active:scale-[.98] ${envoi ? 'opacity-[.85]' : ''}`}
          >
            {envoi && <Spinner />}
            <span className="flex-1 text-left">{envoi ? 'Envoi en cours…' : 'Confirmer mon inscription'}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-moyen bg-blanc-18 text-[18px]">
              <Icon nom="arrowR" />
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
