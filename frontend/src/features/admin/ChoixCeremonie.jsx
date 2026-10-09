import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { dateCourte, heureTexte, prenomSeul, STATUTS_EVENEMENT } from '../../lib/format';
import useTitre from '../../lib/useTitre';
import { useDeconnexion, useMoi } from '../auth/useMoi';
import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';
import Squelette from '../../components/ui/Squelette';

/** A2 · Choix de la cérémonie. */
export default function ChoixCeremonie() {
  useTitre('Choisissez une cérémonie');
  const { data: moi } = useMoi();
  const deconnexion = useDeconnexion();
  const naviguer = useNavigate();
  const {
    data: evenements,
    isLoading,
    error,
  } = useQuery({ queryKey: ['evenements'], queryFn: () => api.get('/evenements/') });
  const liste = (evenements || []).slice().sort((a, b) => {
    const ordre = (e) => (e.statut === 'AUJOURDHUI' ? 0 : e.statut === 'TERMINEE' ? 2 : 1);
    return ordre(a) - ordre(b) || (ordre(a) === 2 ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  });
  return (
    <div className="min-h-screen border-t-[6px] border-texte px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Logo hauteur={40} />
          <div className="flex items-center gap-2">
            {moi?.role === 'SUPER_ADMIN' && (
              <Link to="/super" className="text-[14px] font-semibold">
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
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-moyen border-0 bg-transparent text-[20px] text-texte-2 hover:bg-subtil"
            >
              <Icon nom="logout" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px] text-texte-2">Bonjour {prenomSeul(moi?.nom)}</span>
            <h1 className="m-0 text-[34px] font-bold tracking-[-0.028em]">Choisissez une cérémonie</h1>
          </div>
          {evenements && (
            <span className="text-[15px] text-texte-2">
              {evenements.length}{' '}
              {evenements.length > 1 ? 'cérémonies vous sont affectées' : 'cérémonie vous est affectée'}
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="m-0 text-erreur">
            Impossible de charger les cérémonies. Rechargez la page.
          </p>
        )}
        {evenements?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-carte border border-bordure-carte bg-surface p-10 text-center shadow-carte">
            <Icon nom="calendar" className="text-[32px] text-texte-2" />
            <p className="m-0 text-[17px] font-semibold">Aucune cérémonie ne vous est affectée</p>
            <p className="m-0 text-[15px] text-texte-2">
              Demandez à la direction des événements de vous affecter à une cérémonie.
            </p>
          </div>
        )}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
          {isLoading && [1, 2, 3].map((k) => <Squelette key={k} className="h-[200px] !rounded-carte" />)}
          {liste.map((e) => {
            const aujourdhui = e.statut === 'AUJOURDHUI';
            return (
              <Link
                key={e.id}
                to={`/admin/evenements/${e.id}`}
                className="flex animate-in-up flex-col overflow-hidden rounded-carte border border-bordure bg-surface text-texte no-underline shadow-carte transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:text-texte hover:shadow-flottant"
                style={{ borderTop: `6px solid ${e.tokens.p}` }}
              >
                <div
                  className="flex flex-col gap-3 px-5 pb-4 pt-5"
                  style={{ background: `linear-gradient(180deg, ${e.tokens.hd}, var(--surface))` }}
                >
                  <span
                    className={`inline-flex h-[26px] items-center gap-1.5 self-start rounded-full px-2.5 text-[13px] font-semibold ${aujourdhui ? 'bg-succes-doux text-succes' : 'bg-subtil text-texte'}`}
                  >
                    <span className={`h-[7px] w-[7px] rounded-full ${aujourdhui ? 'bg-succes' : 'bg-texte'}`} />
                    {aujourdhui ? 'Aujourd’hui · en cours' : STATUTS_EVENEMENT[e.statut]}
                  </span>
                  <span className="text-[20px] font-bold tracking-[-0.02em]">{e.nomAffiche}</span>
                  <span className="text-[14px] text-texte-2">
                    {dateCourte(e.date)} · {heureTexte(e.heureDebut)}
                  </span>
                </div>
                <div className="flex flex-col gap-2 border-t border-bordure-ligne px-5 pb-5 pt-4">
                  <div className="flex justify-between text-[14px]">
                    <span className="text-texte-2">Inscrits</span>
                    <span className="font-semibold tabular-nums">
                      {e.nbInscrits} / {e.capacite}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-[3px] bg-subtil">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, Math.round((e.nbInscrits / e.capacite) * 100))}%`,
                        background: e.tokens.p,
                      }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
