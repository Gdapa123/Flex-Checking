import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { heureTexte, nombre, prenomSeul, STATUTS_EVENEMENT } from '../../lib/format';
import useTitre from '../../lib/useTitre';
import { useSecours } from '../../lib/tempsReel';
import { useDeconnexion, useMoi } from '../auth/useMoi';
import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';
import Squelette from '../../components/ui/Squelette';
import EtatErreur from '../../components/ui/EtatErreur';
import LienEvitement from '../../components/ui/LienEvitement';

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const morceauxDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    jour: d.getUTCDate(),
    mois: MOIS[d.getUTCMonth()],
    semaine: JOURS[d.getUTCDay()],
    annee: d.getUTCFullYear(),
  };
};
const pourcentage = (n, sur) => (sur ? Math.min(100, Math.round((n / sur) * 100)) : 0);
/** « PMD » → PMD ; « Public-AMP » → PAMP, « Public-ASD » → PASD (initiales des premiers mots, puis le dernier en entier). */
export const monogramme = (programme) => {
  const mots = (programme || '?').split(/[-\s]+/).filter(Boolean);
  const m =
    mots.length > 1
      ? mots
          .slice(0, -1)
          .map((x) => x[0])
          .join('') + mots.at(-1)
      : mots[0];
  return m.slice(0, 4).toUpperCase();
};

/** A2 · Choix de la cérémonie : la cérémonie du jour en avant, l'agenda à venir, les éditions passées. */
export default function ChoixCeremonie() {
  useTitre('Vos cérémonies');
  const { data: moi } = useMoi();
  const deconnexion = useDeconnexion();
  const naviguer = useNavigate();
  const secours = useSecours(30_000);
  const {
    data: evenements,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['evenements'],
    queryFn: () => api.get('/evenements/'),
    // compteurs à jour même sans temps réel ; relance régulière tant que le chargement échoue
    refetchInterval: (q) => (q.state.error ? 20_000 : secours),
  });
  const tous = evenements || [];
  const aujourdhui = tous.filter((e) => e.statut === 'AUJOURDHUI');
  const aVenir = tous
    .filter((e) => e.statut !== 'AUJOURDHUI' && e.statut !== 'TERMINEE')
    .sort((a, b) => a.date.localeCompare(b.date));
  const passees = tous.filter((e) => e.statut === 'TERMINEE').sort((a, b) => b.date.localeCompare(a.date));
  const ouvertes = aVenir.filter((e) => e.statut === 'INSCRIPTIONS_OUVERTES').length;
  const resume = [
    [aujourdhui.length, 'en cours aujourd’hui'],
    [ouvertes, ouvertes > 1 ? 'inscriptions ouvertes' : 'inscription ouverte'],
    [passees.length, passees.length > 1 ? 'éditions passées' : 'édition passée'],
  ];

  return (
    <div className="univers-mde min-h-screen bg-mde-surface text-mde-texte">
      <LienEvitement />
      <header className="entete-mde hachures px-4 pb-28 pt-6 sm:px-8">
        <div className="relative mx-auto flex max-w-[1120px] flex-col gap-10">
          <div className="flex items-center justify-between gap-4">
            <Logo variante="blanc" hauteur={36} />
            <div className="flex items-center gap-1">
              {moi?.role === 'SUPER_ADMIN' && (
                <Link
                  to="/super"
                  className="flex h-11 items-center gap-2 rounded-bouton px-3 text-[14px] font-semibold text-mde-surface no-underline hover:bg-blanc-18 hover:text-mde-surface"
                >
                  <Icon nom="shield" className="text-[16px]" />
                  Espace super admin
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  await deconnexion();
                  naviguer('/connexion');
                }}
                aria-label="Se déconnecter"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-bouton border-0 bg-transparent text-[19px] text-mde-surface hover:bg-blanc-18"
              >
                <Icon nom="logout" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[15px] font-medium opacity-85">Bonjour {prenomSeul(moi?.nom)}</span>
            <h1 className="m-0 text-[clamp(32px,5vw,44px)] font-extrabold leading-none tracking-[-0.035em]">
              Vos cérémonies
            </h1>
            <span className="h-1 w-12 rounded-sm bg-mde-jaune" />
            {evenements && (
              <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0 text-[14px] font-medium">
                {resume
                  .filter(([n]) => n > 0)
                  .map(([n, l]) => (
                    <li
                      key={l}
                      className="flex h-8 items-center gap-1.5 rounded-full border border-blanc-24 bg-noir-16 px-3"
                    >
                      <strong className="font-bold tabular-nums">{n}</strong> {l}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      <main id="contenu" tabIndex={-1} className="relative -mt-16 px-4 pb-14 outline-none sm:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-10">
          {error &&
            (evenements ? (
              <EtatErreur compact erreur={error} onReessayer={() => refetch()} />
            ) : (
              <EtatErreur titre="Impossible de charger les cérémonies" erreur={error} onReessayer={() => refetch()} />
            ))}
          {isLoading && <Squelette className="h-[260px] !rounded-carte" />}
          {evenements?.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-carte border border-mde-bordure-carte bg-surface p-10 text-center shadow-carte-mde">
              <Icon nom="calendar" className="text-[32px] text-mde-texte-2" />
              <p className="m-0 text-[17px] font-semibold">Aucune cérémonie ne vous est affectée</p>
              <p className="m-0 text-[15px] text-mde-texte-2">
                Demandez à la direction des événements de vous affecter à une cérémonie.
              </p>
            </div>
          )}

          {aujourdhui.map((e) => (
            <CeremonieDuJour key={e.id} e={e} />
          ))}

          {aVenir.length > 0 && (
            <section aria-labelledby="t-avenir" className="flex flex-col gap-4">
              <TitreSection id="t-avenir" titre="À venir" n={aVenir.length} surEntete={!aujourdhui.length} />
              <ul className="m-0 flex list-none flex-col overflow-hidden rounded-carte border border-mde-bordure-carte bg-surface p-0 shadow-carte-mde">
                {aVenir.map((e) => (
                  <LigneAgenda key={e.id} e={e} />
                ))}
              </ul>
            </section>
          )}

          {passees.length > 0 && (
            <details className="group" open={!aujourdhui.length && !aVenir.length}>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-mde-texte-2 hover:text-mde-texte [&::-webkit-details-marker]:hidden">
                <Icon nom="chevR" className="text-[16px] transition-transform group-open:rotate-90" />
                Éditions passées ({passees.length})
              </summary>
              <ul
                className="m-0 mt-4 grid list-none gap-2 p-0"
                style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}
              >
                {passees.map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/admin/evenements/${e.id}`}
                      className="flex items-center gap-3 rounded-moyen border border-mde-bordure-carte bg-surface px-3.5 py-3 text-mde-texte no-underline transition-colors hover:border-mde-champ hover:text-mde-texte"
                    >
                      <span className="h-8 w-1 flex-none rounded-full" style={{ background: e.tokens.p }} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-semibold">{e.nomAffiche}</span>
                        <span className="text-[13px] text-mde-texte-2">
                          {nombre(e.nbPresents)} présents sur {nombre(e.nbInscrits)} ·{' '}
                          {pourcentage(e.nbPresents, e.nbInscrits)} %
                        </span>
                      </span>
                      <Icon nom="chevR" className="text-[16px] text-mde-texte-2" />
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}

function TitreSection({ id, titre, n, surEntete }) {
  return (
    <h2
      id={id}
      className={`m-0 flex items-baseline gap-2 text-[20px] font-bold tracking-[-0.02em] ${surEntete ? 'text-mde-surface' : ''}`}
    >
      {titre}
      <span className={`text-[15px] font-medium ${surEntete ? 'opacity-80' : 'text-mde-texte-2'}`}>{n}</span>
    </h2>
  );
}

/** Cérémonie du jour : grande carte aux couleurs du programme, accès directs au tableau de bord et au scan. */
function CeremonieDuJour({ e }) {
  const t = e.tokens;
  const taux = pourcentage(e.nbPresents, e.nbInscrits);
  return (
    <section
      aria-label={`${e.nomAffiche}, en cours aujourd’hui`}
      className="hachures relative overflow-hidden rounded-carte shadow-carte-mde"
      style={{ background: `linear-gradient(135deg, ${t.p} 0%, ${t.ph} 100%)`, color: t.op }}
    >
      <div className="relative flex flex-wrap items-end justify-between gap-8 p-6 sm:p-8">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-noir-16 px-3 py-1 text-[13px] font-semibold">
            <span className="h-2 w-2 animate-blink rounded-full" style={{ background: t.s }} />
            En cours aujourd’hui
          </span>
          <h2 className="m-0 text-[clamp(28px,4.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.035em]">
            {e.nomAffiche}
          </h2>
          <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] opacity-90">
            <span className="flex items-center gap-1.5">
              <Icon nom="clock" className="text-[16px]" />
              Accueil {heureTexte(e.heureAccueil)} · lancement {heureTexte(e.heureDebut)}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <Icon nom="mapPin" className="text-[16px]" />
              <span className="truncate">{e.lieu}</span>
            </span>
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              to={`/admin/evenements/${e.id}`}
              className="flex h-11 items-center gap-2 rounded-bouton bg-surface px-4 text-[15px] font-semibold no-underline hover:opacity-95"
              style={{ color: t.p }}
            >
              <Icon nom="grid" className="text-[18px]" />
              Tableau de bord
            </Link>
            <Link
              to={`/scan?evenement=${e.id}`}
              className="flex h-11 items-center gap-2 rounded-bouton border px-4 text-[15px] font-semibold no-underline hover:bg-noir-16"
              style={{ color: t.op, borderColor: 'currentColor' }}
            >
              <Icon nom="scan" className="text-[18px]" />
              Ouvrir le scan
            </Link>
          </div>
        </div>
        <dl className="m-0 grid min-w-[240px] flex-[0_1_300px] grid-cols-2 gap-px overflow-hidden rounded-moyen bg-blanc-24">
          {[
            ['Présents', nombre(e.nbPresents)],
            ['Inscrits', nombre(e.nbInscrits)],
            ['Taux de présence', `${taux} %`],
            ['Capacité', nombre(e.capacite)],
          ].map(([l, v]) => (
            <div key={l} className="flex flex-col gap-0.5 bg-noir-16 px-4 py-3">
              <dt className="text-[13px] opacity-85">{l}</dt>
              <dd className="m-0 text-[24px] font-bold leading-tight tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Ligne d'agenda : bloc date, monogramme du programme, statut, remplissage. */
function LigneAgenda({ e }) {
  const d = morceauxDate(e.date);
  const t = e.tokens;
  const remplissage = pourcentage(e.nbInscrits, e.capacite);
  return (
    <li className="border-t border-mde-bordure-ligne first:border-t-0">
      <Link
        to={`/admin/evenements/${e.id}`}
        className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 text-mde-texte no-underline transition-colors hover:bg-mde-survol hover:text-mde-texte sm:px-6"
      >
        <span className="flex w-[64px] flex-none flex-col items-center rounded-moyen border border-mde-bordure-carte py-1.5 leading-none">
          <span className="text-[12px] font-medium uppercase text-mde-texte-2">{d.semaine}</span>
          <span className="text-[26px] font-extrabold tabular-nums tracking-[-0.03em]">{d.jour}</span>
          <span className="text-[12px] font-semibold" style={{ color: t.p }}>
            {d.mois} {String(d.annee).slice(2)}
          </span>
        </span>
        <span
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-full font-extrabold tracking-[-0.03em] max-sm:hidden ${monogramme(e.programmeNom).length > 3 ? 'text-[11px]' : 'text-[13px]'}`}
          style={{ background: t.p, color: t.op }}
          aria-hidden="true"
        >
          {monogramme(e.programmeNom)}
        </span>
        <span className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-[17px] font-bold tracking-[-0.01em]">{e.nomAffiche}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-mde-texte-2">
            <span>{heureTexte(e.heureDebut)}</span>
            <span
              className="inline-flex h-6 items-center rounded-full px-2 text-[12.5px] font-semibold"
              style={{ background: t.ps, color: t.ph }}
            >
              {STATUTS_EVENEMENT[e.statut]}
            </span>
          </span>
        </span>
        <span className="flex w-[180px] flex-none flex-col gap-1.5 max-sm:w-full">
          <span className="flex justify-between text-[13px]">
            <span className="text-mde-texte-2">Inscrits</span>
            <span className="font-semibold tabular-nums">
              {nombre(e.nbInscrits)} / {nombre(e.capacite)}
            </span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-[3px] bg-mde-survol">
            <span className="block h-full rounded-[3px]" style={{ width: `${remplissage}%`, background: t.p }} />
          </span>
        </span>
        <Icon nom="chevR" className="hidden text-[18px] text-mde-texte-2 sm:block" />
      </Link>
    </li>
  );
}
