import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';
import { ToastProvider } from '../../components/ui/Toasts';
import useTitre from '../../lib/useTitre';
import { useDeconnexion, useMoi } from '../auth/useMoi';
import VueGlobale from './VueGlobale';
import Programmes from './Programmes';
import Evenements from './Evenements';
import TousInvites from './TousInvites';
import Comptes from './Comptes';
import Parametres from './Parametres';
import Journal from './Journal';

const NAV = [
  ['', 'Vue globale', 'globe'],
  ['programmes', 'Programmes', 'palette'],
  ['evenements', 'Événements', 'calendar'],
  ['invites', 'Invités', 'users'],
  ['admins', 'Comptes admins', 'shield'],
  ['parametres', 'Paramètres', 'sliders'],
  ['journal', 'Exports et journal', 'file'],
];

export default function SuperApp() {
  return (
    <div className="univers-mde flex min-h-screen border-t-[6px] border-mde-bordeaux bg-mde-surface text-mde-texte">
      <ToastProvider univers="mde">
        <BarreLaterale />
        <div className="flex min-w-0 flex-1 flex-col">
          <Routes>
            <Route index element={<VueGlobale />} />
            <Route path="programmes/:id?" element={<Programmes />} />
            <Route path="evenements/:id?" element={<Evenements />} />
            <Route path="invites" element={<TousInvites />} />
            <Route path="admins" element={<Comptes />} />
            <Route path="parametres" element={<Parametres />} />
            <Route path="journal" element={<Journal />} />
          </Routes>
        </div>
      </ToastProvider>
    </div>
  );
}

function BarreLaterale() {
  const { data: moi } = useMoi();
  const deconnexion = useDeconnexion();
  const naviguer = useNavigate();
  return (
    <aside className="hidden w-[248px] flex-none flex-col gap-6 border-r border-mde-bordure bg-surface px-4 py-5 min-[961px]:flex">
      <div className="flex flex-col gap-2.5">
        <Logo hauteur={40} />
        <span className="inline-flex h-[26px] items-center gap-1.5 self-start rounded-full bg-mde-jaune px-2.5 text-[12px] font-semibold text-mde-texte">
          <Icon nom="shield" className="text-[13px]" />
          Super admin
        </span>
      </div>
      <nav aria-label="Navigation super admin" className="flex flex-col gap-1">
        {NAV.map(([to, label, icone]) => (
          <NavLink
            key={to}
            to={`/super${to ? `/${to}` : ''}`}
            end={!to}
            className={({ isActive }) =>
              `flex h-11 items-center gap-3 rounded-moyen px-3 text-[15px] text-mde-texte no-underline transition-colors hover:bg-mde-survol hover:text-mde-texte ${isActive ? 'bg-mde-creme font-semibold' : 'font-medium'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon nom={icone} className={`text-[20px] ${isActive ? 'text-mde-bordeaux' : 'text-mde-texte-2'}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-mde-bordure pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mde-creme text-[14px] font-semibold">
          {moi?.initiales}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-semibold">{moi?.nom}</span>
          <span className="text-[13px] text-mde-texte-2">Direction des événements</span>
        </div>
        <button
          type="button"
          aria-label="Se déconnecter"
          onClick={async () => {
            await deconnexion();
            naviguer('/super/connexion');
          }}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-moyen border-0 bg-transparent text-[20px] text-mde-texte-2 hover:bg-mde-survol"
        >
          <Icon nom="logout" />
        </button>
      </div>
    </aside>
  );
}

/** En-tête MDE + contenu qui chevauche (commun à tous les écrans du super admin). */
export function PageSuper({ titre, action, onAction, children }) {
  useTitre(`${titre} · Super admin`);
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="entete-mde hachures flex flex-wrap items-end justify-between gap-4 px-4 pb-[76px] pt-7 sm:px-8">
        <div className="relative flex flex-col gap-2">
          <span className="text-[14px] font-medium">Flex’Checking · configuration globale</span>
          <h1 className="m-0 text-[clamp(28px,4vw,36px)] font-extrabold leading-[1.05] tracking-[-0.035em]">{titre}</h1>
          <span className="h-1 w-10 rounded-sm bg-mde-jaune" />
        </div>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="relative flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border-0 bg-mde-jaune px-4 text-[15px] font-semibold text-mde-texte shadow-blanc transition-colors hover:bg-mde-jaune-clair"
          >
            <Icon nom="plus" className="text-[18px]" />
            {action}
          </button>
        )}
        <nav aria-label="Sections" className="relative flex w-full flex-wrap gap-1 min-[961px]:hidden">
          {NAV.map(([to, label]) => (
            <NavLink
              key={to}
              to={`/super${to ? `/${to}` : ''}`}
              end={!to}
              className={({ isActive }) =>
                `rounded-moyen px-2.5 py-1.5 text-[13px] font-semibold no-underline ${isActive ? 'bg-mde-surface text-mde-texte' : 'text-mde-surface hover:text-mde-surface'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="relative -mt-12 flex min-w-0 flex-col gap-5 px-4 pb-10 sm:px-8 [&>*]:min-w-0">{children}</div>
    </main>
  );
}
