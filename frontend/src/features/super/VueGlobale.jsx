import { Link } from 'react-router-dom';
import { dateCourte, heureTexte, nombre, prenomSeul } from '../../lib/format';
import Carte from '../../components/ui/Carte';
import Squelette from '../../components/ui/Squelette';
import { PageSuper } from './SuperApp';
import { BADGE_STATUT, useAdmins, useEvenements } from './donnees';
import ErreurChargement, { BandeauErreur } from './ErreurChargement';

/** SA2 · Vue globale de toutes les cérémonies et de tous les programmes. */
export default function VueGlobale() {
  const { data: evenements, error, refetch } = useEvenements();
  const { data: admins } = useAdmins();
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const avenir = (evenements || []).filter((e) => e.date >= aujourdHui);
  const duJour = avenir.filter((e) => e.statut === 'AUJOURDHUI');
  const kpis = [
    {
      label: 'Cérémonies à venir',
      valeur: nombre(avenir.length),
      sub: duJour.length ? `dont ${duJour.length} aujourd’hui` : 'aucun aujourd’hui',
    },
    {
      label: 'Inscrits cumulés',
      valeur: nombre(avenir.reduce((a, e) => a + e.nbInscrits, 0)),
      sub: `sur ${nombre(avenir.reduce((a, e) => a + e.capacite, 0))} places`,
    },
    {
      label: 'Présents aujourd’hui',
      valeur: nombre(duJour.reduce((a, e) => a + e.nbPresents, 0)),
      sub: duJour.map((e) => e.nomAffiche).join(', ') || 'Aucune cérémonie aujourd’hui',
    },
    {
      label: 'Comptes admins',
      valeur: admins ? nombre(admins.length) : '–',
      sub: admins ? `${admins.filter((a) => a.doitChangerMotDePasse).length} mot(s) de passe temporaire(s)` : '',
    },
  ];
  return (
    <PageSuper titre="Vue globale">
      {error && !evenements && <ErreurChargement erreur={error} onReessayer={refetch} />}
      {error && evenements && <BandeauErreur erreur={error} onReessayer={refetch} />}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        {kpis.map((k) => (
          <Carte mde key={k.label} className="flex animate-in-up flex-col gap-2 p-5">
            <span className="text-[15px] font-medium text-mde-texte-2">{k.label}</span>
            <span className="text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums">
              {evenements ? k.valeur : '–'}
            </span>
            <span className="text-[14px] text-mde-texte-2">{k.sub}</span>
          </Carte>
        ))}
      </div>
      <Carte mde as="section" className="overflow-hidden" aria-labelledby="t-evts">
        <div className="flex items-center justify-between border-b border-mde-bordure px-5 py-4">
          <h2 id="t-evts" className="m-0 text-[17px] font-semibold">
            Toutes les cérémonies
          </h2>
          <span className="text-[14px] text-mde-texte-2">
            {evenements ? `${nombre(evenements.length)} cérémonie${evenements.length > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-mde-entete text-left text-[13px] text-mde-texte-2">
                <th className="px-5 py-3 font-semibold">Cérémonie</th>
                <th className="p-3 font-semibold">Date</th>
                <th className="w-[220px] p-3 font-semibold">Inscrits / capacité</th>
                <th className="p-3 text-right font-semibold">Présents</th>
                <th className="p-3 font-semibold">Statut</th>
                <th className="p-3 font-semibold">Admins</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!evenements &&
                !error &&
                [1, 2, 3].map((k) => (
                  <tr key={k}>
                    <td colSpan={7} className="px-5 py-3.5">
                      <Squelette />
                    </td>
                  </tr>
                ))}
              {evenements?.map((e) => {
                const [label, cls, point] = BADGE_STATUT[e.statut];
                return (
                  <tr key={e.id} className="border-t border-mde-bordure-ligne">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-1.5 rounded-[3px]" style={{ background: e.tokens.p }} />
                        <div className="flex flex-col">
                          <span className="font-semibold">{e.nomAffiche}</span>
                          <span className="text-[13px] text-mde-texte-2">Programme {e.programmeNom}</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5">
                      {dateCourte(e.date)} · {heureTexte(e.heureDebut)}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-mde-bordure-ligne">
                          <span
                            className="block h-full bg-mde-bordeaux"
                            style={{ width: `${Math.min(100, (e.nbInscrits / e.capacite) * 100)}%` }}
                          />
                        </span>
                        <span className="w-[88px] text-right text-[14px] tabular-nums">
                          {nombre(e.nbInscrits)} / {nombre(e.capacite)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">
                      {e.nbPresents ? nombre(e.nbPresents) : '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold ${cls}`}
                      >
                        <span className={`h-[7px] w-[7px] rounded-full ${point}`} />
                        {label}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-[14px] text-mde-texte-2">
                      {e.adminsDetails.map((a) => prenomSeul(a.nom)).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/admin/evenements/${e.id}`}
                          aria-label={`Tableau de bord de ${e.nomAffiche}`}
                          className="inline-flex h-11 items-center whitespace-nowrap rounded-bouton border border-mde-champ bg-surface px-3 text-[13px] font-semibold text-mde-texte no-underline hover:bg-mde-survol hover:text-mde-texte"
                        >
                          Tableau de bord
                        </Link>
                        <Link
                          to={`/super/evenements/${e.id}`}
                          aria-label={`Configurer ${e.nomAffiche}`}
                          className="inline-flex h-11 items-center rounded-bouton border border-mde-champ bg-surface px-3 text-[13px] font-semibold text-mde-texte no-underline hover:bg-mde-survol hover:text-mde-texte"
                        >
                          Configurer
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Carte>
    </PageSuper>
  );
}
