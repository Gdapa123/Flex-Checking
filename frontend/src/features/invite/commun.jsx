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
    <header className="entete-degrade hachures px-5 pb-11 pt-3.5 sm:pb-16 sm:pt-[22px]">
      <div className="relative mx-auto flex max-w-[560px] flex-col gap-3.5 sm:gap-[22px]">
        <Logo variante={logoBlanc ? 'blanc' : 'rouge'} hauteur={32} />
        {variante === 'formulaire' ? (
          <>
            <div className="flex flex-col gap-1.5 sm:gap-2.5">
              <p className="m-0 text-[13.5px] font-medium sm:text-[15px]">MDE vous invite à la cérémonie de</p>
              <h1 className="m-0 text-[clamp(25px,7.4vw,30px)] font-extrabold leading-[1.05] tracking-[-0.035em] [text-wrap:balance] sm:text-[44px] sm:leading-none sm:tracking-[-0.04em]">
                {ev.nomAffiche}
              </h1>
              <span className="h-1 w-14 rounded-sm bg-s" />
            </div>
            {/* Mobile : bloc compact avec icônes (date · heure, puis lieu) */}
            <div className="flex flex-col gap-1 rounded-bouton border border-blanc-26 bg-noir-16 px-3 py-2 text-[13.5px] font-semibold sm:hidden">
              <span className="flex items-center gap-2">
                <Icon nom="calendar" className="text-[15px] opacity-80" />
                <span className="tabular-nums">
                  {dateBandeau(ev.date)} · {heureTexte(ev.heureDebut)}
                </span>
              </span>
              <span className="flex items-start gap-2">
                <Icon nom="mapPin" className="mt-[3px] text-[15px] opacity-80" />
                <span className="leading-snug">{ev.lieu}</span>
              </span>
            </div>
            {/* Tablette et ordinateur : date et heure côte à côte, le lieu sur toute la largeur */}
            <dl className="m-0 hidden sm:grid grid-cols-2 overflow-hidden rounded-bouton border border-blanc-26 bg-noir-16">
              <div className="flex min-w-0 flex-col gap-0.5 border-r border-blanc-26 px-3 py-1.5 sm:py-2.5">
                <dt className="text-[11px] sm:text-[12px]">Date</dt>
                <dd className="m-0 text-[14px] font-bold sm:text-[15px] tabular-nums">{dateBandeau(ev.date)}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 px-3 py-1.5 sm:py-2.5">
                <dt className="text-[11px] sm:text-[12px]">Heure</dt>
                <dd className="m-0 text-[14px] font-bold sm:text-[15px] tabular-nums">{heureTexte(ev.heureDebut)}</dd>
              </div>
              <div className="col-span-2 flex min-w-0 flex-col gap-0.5 border-t border-blanc-26 px-3 py-1.5 sm:py-2.5">
                <dt className="text-[11px] sm:text-[12px]">Lieu</dt>
                <dd className="m-0 text-[13px] font-bold leading-snug sm:text-[15px] sm:[text-wrap:balance]">
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
