import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { dateCourte } from '../../lib/format';
import ThemeScope from '../../theme/ThemeScope';
import useTitre from '../../lib/useTitre';
import { lireMaj, useEtatTempsReel, useSecours } from '../../lib/tempsReel';
import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';
import Spinner from '../../components/ui/Spinner';
import { ToastProvider } from '../../components/ui/Toasts';
import { useDeconnexion, useMoi } from '../auth/useMoi';
import TableauDeBord from './TableauDeBord';
import GestionInvites from '../invites/GestionInvites';
import ApercuEmails from './ApercuEmails';

/** Mise en page admin : barre latérale, en-tête en dégradé du programme, contenu qui chevauche. */
export default function EspaceEvenement() {
  const { id } = useParams();
  const secours = useSecours(30_000);
  const { data: ev, error } = useQuery({
    queryKey: ['evenement', id],
    queryFn: () => api.get(`/evenements/${id}/`),
    refetchInterval: secours,
  });
  if (error?.status === 404) return <Navigate to="/admin" replace />;
  if (!ev)
    return (
      <div className="flex min-h-screen items-center justify-center text-texte-2" role="status" aria-label="Chargement">
        <Spinner taille={28} />
      </div>
    );
  return (
    <ThemeScope tokens={ev.tokens} className="flex min-h-screen bg-fond">
      <ToastProvider>
        <BarreLaterale ev={ev} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Routes>
            <Route
              index
              element={
                <Page ev={ev} titre="Tableau de bord">
                  <TableauDeBord ev={ev} />
                </Page>
              }
            />
            <Route
              path="invites"
              element={
                <Page ev={ev} titre="Gestion des invités">
                  <GestionInvites evenement={ev} />
                </Page>
              }
            />
            <Route
              path="emails"
              element={
                <Page ev={ev} titre="Emails">
                  <ApercuEmails ev={ev} />
                </Page>
              }
            />
          </Routes>
        </div>
      </ToastProvider>
    </ThemeScope>
  );
}

function BarreLaterale({ ev }) {
  const { data: moi } = useMoi();
  const deconnexion = useDeconnexion();
  const naviguer = useNavigate();
  const base = `/admin/evenements/${ev.id}`;
  const liens = [
    { to: base, label: 'Tableau de bord', icone: 'grid', fin: true },
    { to: `${base}/invites`, label: 'Invités', icone: 'users' },
    { to: '/scan', label: 'Scan', icone: 'scan', externe: true },
    { to: `${base}/emails`, label: 'Emails', icone: 'mail' },
  ];
  return (
    <aside className="hidden w-[248px] flex-none flex-col gap-6 border-r border-bordure bg-surface px-4 py-5 min-[961px]:flex">
      <Link to="/admin" aria-label="Toutes les cérémonies">
        <Logo hauteur={40} />
      </Link>
      <nav aria-label="Navigation admin" className="flex flex-col gap-1">
        {liens.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.fin}
            className={({ isActive }) =>
              `flex h-11 items-center gap-3 rounded-moyen px-3 text-[15px] no-underline transition-colors hover:bg-fond hover:text-texte ${
                isActive && !l.externe ? 'bg-ps font-semibold text-p' : 'font-medium text-texte'
              }`
            }
          >
            <Icon nom={l.icone} className="text-[20px]" />
            <span className="flex-1">{l.label}</span>
            {l.externe && <Icon nom="external" className="text-[14px] text-texte-2" />}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-bordure-ligne pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-subtil text-[14px] font-semibold">
          {moi?.initiales}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-semibold">{moi?.nom}</span>
          <span className="text-[13px] text-texte-2">
            {moi?.role === 'SUPER_ADMIN' ? 'Super admin' : 'Administrateur'}
          </span>
        </div>
        <button
          type="button"
          aria-label="Se déconnecter"
          onClick={async () => {
            await deconnexion();
            naviguer('/connexion');
          }}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-moyen border-0 bg-transparent text-[20px] text-texte-2 hover:bg-fond"
        >
          <Icon nom="logout" />
        </button>
      </div>
    </aside>
  );
}

function IndicateurTempsReel() {
  const [, setT] = useState(0);
  const location = useLocation();
  useEffect(() => {
    const i = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const etat = useEtatTempsReel();
  const derniere = lireMaj();
  const s = Math.max(1, Math.round((Date.now() - derniere) / 1000));
  const enDirect = etat === 'connecte';
  const depuis = s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
  return (
    <span
      key={location.pathname}
      title={
        enDirect
          ? 'Les changements s’affichent instantanément.'
          : 'Connexion temps réel interrompue : actualisation périodique.'
      }
      className="inline-flex h-9 items-center gap-2 rounded-full border border-blanc-24 bg-noir-20 px-3 text-[14px] font-medium"
    >
      <span className={`h-2 w-2 rounded-full ${enDirect ? 'animate-blink bg-live' : 'bg-current opacity-50'}`} />
      {enDirect ? 'En direct' : 'Reconnexion…'} · mis à jour il y a {depuis}
    </span>
  );
}

function Page({ ev, titre, children }) {
  useTitre(`${titre} · ${ev.nomAffiche}`);
  const base = `/admin/evenements/${ev.id}`;
  return (
    <main className="flex min-w-0 flex-1 flex-col" aria-labelledby="titre-page">
      <header className="entete-degrade hachures flex flex-wrap items-end justify-between gap-4 px-4 pb-[76px] pt-6 sm:px-8">
        <div className="relative flex min-w-0 flex-col gap-2">
          <Link
            to="/admin"
            className="flex min-h-7 items-center gap-1.5 text-[14px] font-medium text-op no-underline hover:text-op"
          >
            <Icon nom="chevL" className="text-[16px]" />
            Toutes les cérémonies
          </Link>
          <h1
            id="titre-page"
            className="m-0 text-[clamp(28px,4vw,36px)] font-extrabold leading-[1.05] tracking-[-0.035em]"
          >
            {titre}
          </h1>
          <span className="flex flex-wrap items-center gap-2.5 text-[15px]">
            <span className="h-1 w-8 rounded-sm bg-s" />
            <span>
              {ev.nomAffiche} · {dateCourte(ev.date)} · {ev.lieu}
            </span>
          </span>
        </div>
        <div className="relative flex flex-wrap items-center gap-3">
          <IndicateurTempsReel />
          <Link
            to="/scan"
            className="flex h-11 items-center gap-2 rounded-[12px] bg-surface px-4 text-[15px] font-semibold text-texte no-underline shadow-blanc hover:bg-fond hover:text-texte"
          >
            <Icon nom="scan" className="text-[18px]" />
            Ouvrir le scan
          </Link>
        </div>
        <nav aria-label="Sections" className="relative flex w-full gap-1 min-[961px]:hidden">
          {[
            [base, 'Tableau de bord'],
            [`${base}/invites`, 'Invités'],
            [`${base}/emails`, 'Emails'],
          ].map(([to, l]) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `rounded-moyen px-3 py-2 text-[14px] font-semibold no-underline ${isActive ? 'bg-surface text-texte' : 'text-op hover:text-op'}`
              }
            >
              {l}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="relative -mt-12 flex min-w-0 flex-col gap-5 px-4 pb-10 sm:px-8 [&>*]:min-w-0">{children}</div>
    </main>
  );
}
