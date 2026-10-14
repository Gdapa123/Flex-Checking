import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { dateLongue, heure, jour, nombre } from '../../lib/format';
import { useSecours } from '../../lib/tempsReel';
import Carte from '../../components/ui/Carte';
import Icon from '../../components/ui/Icon';
import Squelette from '../../components/ui/Squelette';

export const virgule = (v) => Number(v).toFixed(1).replace('.', ',');

export function libelleNps(nps) {
  if (nps === null || nps === undefined) return '';
  if (nps >= 50) return 'Excellent';
  if (nps >= 20) return 'Très bon';
  if (nps >= 0) return 'Correct';
  return 'À améliorer';
}

export const signeNps = (nps) => (nps === null || nps === undefined ? '–' : nps > 0 ? `+${nps}` : String(nps));

function sousTitre(r) {
  switch (r.etat) {
    case 'A_VENIR':
      return `Envoi automatique aux présents le ${dateLongue(r.envoiPrevu, false)} à ${heure(r.envoiPrevu)}, lien ouvert 24 h.`;
    case 'EN_COURS':
      return `Sondage ouvert jusqu’au ${dateLongue(r.fermeLe, false)} à ${heure(r.fermeLe)} · résultats en direct.`;
    case 'TERMINE':
      return r.envoyes
        ? `Sondage clos le ${dateLongue(r.fermeLe, false)} à ${heure(r.fermeLe)}.`
        : 'Aucun présent : le sondage n’a pas été envoyé.';
    default:
      return 'Sondage désactivé pour ce programme (réglage du super admin).';
  }
}

/** A3 · Résultats du sondage de satisfaction (email n°3) de la cérémonie. */
export default function CarteSatisfaction({ ev }) {
  const secours = useSecours(30_000);
  const {
    data: r,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sondage', ev.id],
    queryFn: () => api.get(`/evenements/${ev.id}/sondage/`),
    refetchInterval: secours,
  });
  const [tout, setTout] = useState(false);

  return (
    <Carte as="section" className="flex min-w-0 flex-col gap-5 px-6 py-5" aria-labelledby="t-satisfaction">
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-champ bg-p text-[20px] text-op">
          <Icon nom="star" className="fill-current" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="t-satisfaction" className="m-0 text-[17px] font-semibold">
            Satisfaction des participants
          </h2>
          <p className="m-0 text-[14px] leading-snug text-texte-2">
            {r ? sousTitre(r) : error ? 'Résultats indisponibles pour le moment.' : <Squelette className="h-4 w-64" />}
          </p>
          {error && !r && (
            <button
              type="button"
              onClick={() => refetch()}
              className="cursor-pointer self-start border-0 bg-transparent p-0 text-[14px] font-semibold text-texte underline underline-offset-[3px]"
            >
              Réessayer
            </button>
          )}
        </div>
      </div>

      {r && r.envoyes > 0 && (
        <>
          <dl className="m-0 grid grid-cols-2 gap-2.5 min-[700px]:grid-cols-4">
            <Kpi
              libelle="Réponses"
              valeur={nombre(r.reponses)}
              detail={`sur ${nombre(r.envoyes)} · ${r.tauxReponse} %`}
            />
            <Kpi
              libelle="Satisfaction"
              valeur={r.noteGlobale === null ? '–' : virgule(r.noteGlobale)}
              detail="moyenne sur 5"
              etoiles={r.noteGlobale}
            />
            <Kpi
              libelle="Accueil"
              valeur={r.noteAccueil === null ? '–' : virgule(r.noteAccueil)}
              detail="moyenne sur 5"
              etoiles={r.noteAccueil}
            />
            <Kpi
              libelle="NPS"
              valeur={signeNps(r.nps)}
              detail={r.nps === null ? 'recommandation' : libelleNps(r.nps)}
            />
          </dl>

          {r.reponses > 0 ? (
            <div className="grid gap-6 min-[900px]:grid-cols-2">
              <Repartition r={r} />
              <Recommandation r={r} />
            </div>
          ) : (
            <p className="m-0 flex items-center gap-2 rounded-moyen bg-subtil px-4 py-3 text-[15px] text-texte-3">
              <Icon nom="clock" className="text-[18px] text-texte-2" />
              En attente des premières réponses.
            </p>
          )}

          {r.commentaires.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h3 className="m-0 flex items-center gap-2 text-[15px] font-semibold">
                <Icon nom="message" className="text-[17px] text-texte-2" />
                Commentaires
                <span className="text-[13px] font-normal text-texte-2">(anonymes)</span>
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {(tout ? r.commentaires : r.commentaires.slice(0, 4)).map((c) => (
                  <li key={c.le + c.texte} className="flex flex-col gap-1 rounded-moyen bg-subtil px-4 py-3">
                    <p className="m-0 whitespace-pre-line break-words text-[15px] leading-[1.5] text-texte">
                      « {c.texte} »
                    </p>
                    <span className="flex items-center gap-2 text-[13px] text-texte-2">
                      <Etoiles note={c.noteGlobale} taille="text-[12px]" />
                      {jour(c.le)}
                    </span>
                  </li>
                ))}
              </ul>
              {r.commentaires.length > 4 && (
                <button
                  type="button"
                  onClick={() => setTout((v) => !v)}
                  className="cursor-pointer self-start border-0 bg-transparent p-0 text-[14px] font-semibold text-texte underline underline-offset-[3px]"
                >
                  {tout ? 'Réduire' : `Voir les ${r.commentaires.length} derniers commentaires`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Carte>
  );
}

function Kpi({ libelle, valeur, detail, etoiles }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-champ bg-subtil px-4 py-3">
      <dt className="text-[13px] font-medium text-texte-3">{libelle}</dt>
      <dd className="m-0 flex flex-col gap-1">
        <span className="text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums">{valeur}</span>
        {etoiles !== undefined && etoiles !== null && <Etoiles note={etoiles} />}
        <span className="text-[13px] text-texte-2">{detail}</span>
      </dd>
    </div>
  );
}

export function Etoiles({ note, taille = 'text-[14px]' }) {
  return (
    <span className={`inline-flex gap-0.5 ${taille}`} role="img" aria-label={`${virgule(note)} sur 5`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Icon key={v} nom="star" className={v <= Math.round(note) ? 'fill-current text-p' : 'text-champ'} />
      ))}
    </span>
  );
}

function Repartition({ r }) {
  const max = Math.max(1, ...r.repartitionGlobale.map((x) => x.nb));
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="m-0 text-[15px] font-semibold">Note de la cérémonie</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {[...r.repartitionGlobale].reverse().map((x) => (
          <li key={x.valeur} className="flex items-center gap-3 text-[14px]">
            <span className="flex w-10 flex-none items-center gap-1 tabular-nums text-texte-3">
              {x.valeur}
              <Icon nom="star" className="fill-current text-[12px] text-p" />
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-[4px] bg-subtil">
              <span className="block h-full rounded-[4px] bg-p" style={{ width: `${(x.nb / max) * 100}%` }} />
            </span>
            <span className="w-8 text-right font-semibold tabular-nums">{nombre(x.nb)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Recommandation({ r }) {
  const parts = [
    ['Promoteurs', '9-10', r.promoteurs, 'bg-succes'],
    ['Passifs', '7-8', r.passifs, 'bg-neutre'],
    ['Détracteurs', '0-6', r.detracteurs, 'bg-erreur'],
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="m-0 text-[15px] font-semibold">Recommanderaient MDE Business School</h3>
      <div className="flex h-3 overflow-hidden rounded-[6px] bg-subtil" aria-hidden="true">
        {parts.map(([l, , n, c]) => (
          <span key={l} className={`h-full ${c}`} style={{ width: `${(n / r.reponses) * 100}%` }} />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {parts.map(([l, notes, n, c]) => (
          <li key={l} className="flex items-center gap-2.5 text-[14px]">
            <span className={`h-2.5 w-2.5 flex-none rounded-full ${c}`} />
            <span className="flex-1">
              {l} <span className="text-texte-2">· notes {notes}</span>
            </span>
            <span className="font-semibold tabular-nums">
              {nombre(n)} · {Math.round((n / r.reponses) * 100)} %
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[13px] leading-snug text-texte-2">
        NPS = part des promoteurs moins part des détracteurs ({signeNps(r.nps)}).
      </p>
    </div>
  );
}
