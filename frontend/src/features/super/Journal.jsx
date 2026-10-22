import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import { jourHeure } from '../../lib/format';
import { useSecours } from '../../lib/tempsReel';
import { telecharger } from '../../lib/telechargement';
import useUrlState from '../../lib/useUrlState';
import Carte from '../../components/ui/Carte';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import { PageSuper } from './SuperApp';
import { useEvenements, useProgrammes } from './donnees';

const EXPORTS = [
  ['invites', 'Invités', 'Liste complète des inscrits', 'users'],
  ['presences', 'Présences', 'Heure et mode d’émargement', 'userCheck'],
  ['emails', 'Suivi des emails', 'Emails n°1 à n°3', 'mail'],
  ['journal', 'Journal d’activité', 'Selon les filtres ci-dessous', 'activity'],
];
const CATEGORIES = ['Émargement', 'Invité', 'Email', 'Configuration', 'Export', 'Compte', 'Données personnelles'];
const SELECT = 'h-11 rounded-petit border border-mde-champ bg-surface px-2.5 text-[14px] font-medium text-mde-texte';

/** SA8 · Exports et journal d'activité filtrable (auteur, action, période). */
export default function Journal() {
  const toast = useToast();
  const [f, maj] = useUrlState({ categorie: '', auteur: '', du: '', au: '', page: '1', evenement: '', programme: '' });
  const { data: evenements = [] } = useEvenements();
  const { data: programmes = [] } = useProgrammes();
  const [enCours, setEnCours] = useState('');
  const secours = useSecours(15000);
  const { data: comptes = [] } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get('/comptes/') });
  const filtresJournal = { categorie: f.categorie, auteur: f.auteur, du: f.du, au: f.au, page: f.page };
  const { data, isLoading } = useQuery({
    queryKey: ['journal', filtresJournal],
    queryFn: () => api.get('/journal/', filtresJournal),
    placeholderData: keepPreviousData,
    refetchInterval: secours,
  });

  const exporter = async (type, format) => {
    setEnCours(`${type}-${format}`);
    try {
      const r = await telecharger(`/exports/${type}/`, {
        params: {
          format,
          ...(type === 'journal'
            ? { categorie: f.categorie, auteur: f.auteur, du: f.du, au: f.au }
            : { evenement: f.evenement, programme: f.programme }),
        },
      });
      toast(
        `Export ${format === 'csv' ? 'CSV' : 'Excel'} téléchargé${r.asynchrone ? ' (préparé en arrière-plan)' : ''}.`,
      );
    } catch (e) {
      toast(messageErreur(e, 'L’export a échoué.'), 'erreur');
    } finally {
      setEnCours('');
    }
  };

  const page = Number(f.page);
  return (
    <PageSuper titre="Exports et journal d’activité">
      <Carte mde as="section" aria-labelledby="t-perimetre" className="flex flex-wrap items-center gap-3 px-5 py-4">
        <h2 id="t-perimetre" className="m-0 mr-auto text-[15px] font-semibold">
          Périmètre des exports invités, présences et emails
        </h2>
        <select
          aria-label="Limiter les exports à un programme"
          value={f.programme}
          onChange={(e) => maj({ programme: e.target.value, evenement: '' })}
          className={SELECT}
        >
          <option value="">Tous les programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
        <select
          aria-label="Limiter les exports à une cérémonie"
          value={f.evenement}
          onChange={(e) => maj({ evenement: e.target.value })}
          className={SELECT}
        >
          <option value="">Toutes les cérémonies</option>
          {evenements
            .filter((e) => !f.programme || String(e.programme) === f.programme)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.nomAffiche}
              </option>
            ))}
        </select>
      </Carte>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
        {EXPORTS.map(([type, label, sub, icone]) => (
          <Carte mde key={type} className="flex flex-col gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-moyen bg-mde-survol text-[20px]">
              <Icon nom={icone} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[16px] font-semibold">{label}</span>
              <span className="text-[14px] text-mde-texte-2">{sub}</span>
            </div>
            <div className="flex gap-2">
              {['csv', 'xlsx'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  disabled={!!enCours}
                  onClick={() => exporter(type, fmt)}
                  className="flex h-11 cursor-pointer items-center gap-1.5 rounded-bouton border border-mde-champ bg-surface px-3 text-[14px] font-semibold text-mde-texte hover:bg-mde-survol disabled:opacity-60"
                >
                  {enCours === `${type}-${fmt}` && <Spinner taille={14} />}
                  {fmt === 'csv' ? 'CSV' : 'Excel'}
                </button>
              ))}
            </div>
          </Carte>
        ))}
      </div>

      <Carte mde as="section" className="overflow-hidden" aria-labelledby="t-journal">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mde-bordure px-5 py-4">
          <h2 id="t-journal" className="m-0 text-[17px] font-semibold">
            Journal d’activité
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrer par type"
              value={f.categorie}
              onChange={(e) => maj({ categorie: e.target.value, page: 1 })}
              className={SELECT}
            >
              <option value="">Toutes les actions</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Filtrer par auteur"
              value={f.auteur}
              onChange={(e) => maj({ auteur: e.target.value, page: 1 })}
              className={SELECT}
            >
              <option value="">Tous les auteurs</option>
              <option value="systeme">Système</option>
              {comptes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[14px] text-mde-texte-2">
              Du
              <input
                type="date"
                value={f.du}
                onChange={(e) => maj({ du: e.target.value, page: 1 })}
                className={SELECT}
              />
            </label>
            <label className="flex items-center gap-1.5 text-[14px] text-mde-texte-2">
              au
              <input
                type="date"
                value={f.au}
                onChange={(e) => maj({ au: e.target.value, page: 1 })}
                className={SELECT}
              />
            </label>
          </div>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-mde-entete text-left text-[13px] text-mde-texte-2">
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="p-3 font-semibold">Utilisateur</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="py-3 pl-3 pr-5 font-semibold">Détail</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                [1, 2, 3, 4].map((k) => (
                  <tr key={k}>
                    <td colSpan={4} className="px-5 py-3">
                      <Squelette />
                    </td>
                  </tr>
                ))}
              {data?.resultats.map((l) => (
                <tr key={l.id} className="border-t border-mde-bordure-ligne">
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-mde-texte-2">{jourHeure(l.date)}</td>
                  <td className="whitespace-nowrap p-3">{l.auteurNom}</td>
                  <td className="p-3">
                    <span className="inline-flex h-[26px] items-center rounded-full bg-mde-survol px-2.5 text-[13px] font-semibold">
                      {l.categorie}
                    </span>
                  </td>
                  <td className="py-3 pl-3 pr-5">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.total === 0 && (
            <p className="m-0 px-5 py-10 text-center text-mde-texte-2">Aucune activité pour ces filtres.</p>
          )}
        </div>
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-mde-bordure px-5 py-3 text-[14px] text-mde-texte-2">
            <span>
              Page {data.page} sur {data.pages} · {data.total} entrées
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Page précédente"
                disabled={page <= 1}
                onClick={() => maj({ page: page - 1 })}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-bouton border border-mde-bordure bg-surface text-[18px] disabled:opacity-40"
              >
                <Icon nom="chevL" />
              </button>
              <button
                type="button"
                aria-label="Page suivante"
                disabled={page >= data.pages}
                onClick={() => maj({ page: page + 1 })}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-bouton border border-mde-bordure bg-surface text-[18px] disabled:opacity-40"
              >
                <Icon nom="chevR" />
              </button>
            </div>
          </div>
        )}
      </Carte>
    </PageSuper>
  );
}
