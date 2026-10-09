import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { dateBandeau, heureTexte } from '../../lib/format';
import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';

export function useEvenementPublic(slug) {
  return useQuery({
    queryKey: ['public', slug],
    queryFn: () => api.get(`/public/evenements/${slug}/`),
    retry: (n, e) => n < 2 && e?.status !== 404,
    staleTime: 60_000,
  });
}

export const CLE_CONFIRMATION = (slug) => `fc-confirmation-${slug}`;

export function lienItineraire(ev) {
  return ev.lienCarte || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.lieu)}`;
}

export function lienAgenda(slug) {
  return `/api/public/evenements/${slug}/agenda.ics`;
}

/** En-tête en dégradé du programme (I1 à I7). */
export function EnteteInvite({ ev, variante = 'formulaire', children }) {
  const logoBlanc = ev.tokens?.op === '#FFFFFF';
  return (
    <header className="entete-degrade hachures px-5 pb-16 pt-[22px]">
      <div className="relative mx-auto flex max-w-[560px] flex-col gap-[22px]">
        <div className="flex items-center justify-between gap-3">
          <Logo variante={logoBlanc ? 'blanc' : 'rouge'} hauteur={38} />
          <span className="inline-flex h-[30px] items-center gap-2 rounded-full border border-blanc-24 bg-noir-20 px-3 text-[13px] font-semibold">
            <span className="h-2 w-2 rounded-full bg-s" />
            Invitation personnelle
          </span>
        </div>
        {variante === 'formulaire' ? (
          <>
            <div className="flex flex-col gap-2.5">
              <p className="m-0 text-[14px] font-medium">MDE Business School présente</p>
              <h1 className="m-0 text-[clamp(34px,10vw,44px)] font-extrabold leading-none tracking-[-0.04em] [text-wrap:balance]">
                {ev.nomAffiche}
              </h1>
              <span className="h-1 w-14 rounded-sm bg-s" />
            </div>
            <dl className="m-0 grid grid-cols-3 overflow-hidden rounded-bouton border border-blanc-26 bg-noir-16">
              <div className="flex min-w-0 flex-col gap-0.5 border-r border-blanc-26 px-3 py-2.5">
                <dt className="text-[12px]">Date</dt>
                <dd className="m-0 text-[15px] font-bold tabular-nums">{dateBandeau(ev.date)}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 border-r border-blanc-26 px-3 py-2.5">
                <dt className="text-[12px]">Heure</dt>
                <dd className="m-0 text-[15px] font-bold tabular-nums">{heureTexte(ev.heureDebut)}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
                <dt className="text-[12px]">Lieu</dt>
                <dd className="m-0 truncate text-[15px] font-bold" title={ev.lieu}>
                  {ev.lieu}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          children
        )}
      </div>
    </header>
  );
}

export function IconeTuile({ nom, className = 'bg-subtil text-texte' }) {
  return (
    <div className={`flex h-14 w-14 items-center justify-center rounded-[12px] text-[26px] ${className}`}>
      <Icon nom={nom} />
    </div>
  );
}
