import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import { jourHeure } from '../../lib/format';
import { useSecours } from '../../lib/tempsReel';
import useUrlState from '../../lib/useUrlState';
import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import Dialogue from '../../components/ui/Dialogue';
import Icon from '../../components/ui/Icon';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import { PageSuper } from './SuperApp';

const STATUTS = [
  ['a_traiter', 'À traiter'],
  ['resolues', 'Résolues'],
  ['toutes', 'Toutes'],
];
const SOURCES = [
  ['NAVIGATEUR', 'Navigateur', 'monitor'],
  ['SERVEUR', 'Serveur', 'grid'],
  ['TACHE', 'Tâche d’arrière-plan', 'refresh'],
  ['EMAIL', 'Envoi d’email', 'mail'],
];
const ICONE_SOURCE = Object.fromEntries(SOURCES.map(([v, , i]) => [v, i]));
const SELECT = 'h-10 rounded-petit border border-mde-champ bg-surface px-2.5 text-[14px] font-medium text-mde-texte';

/** Nombre d'erreurs à traiter (pastille de la navigation). */
export function useErreursATraiter() {
  const secours = useSecours(60_000);
  const { data } = useQuery({
    queryKey: ['erreurs-techniques', 'resume'],
    queryFn: () => api.get('/erreurs-techniques/', { statut: 'a_traiter', page: 1 }),
    refetchInterval: secours,
    staleTime: 10_000,
  });
  return data?.aTraiter ?? 0;
}

/** Erreurs techniques : navigateur, serveur, tâches et emails (jamais affichées aux utilisateurs). */
export default function Erreurs() {
  const toast = useToast();
  const qc = useQueryClient();
  const [f, maj] = useUrlState({ statut: 'a_traiter', source: '', page: '1' });
  const [ouverte, setOuverte] = useState(null);
  const [confirmer, setConfirmer] = useState(false);
  const secours = useSecours(30_000);
  const { data, isLoading } = useQuery({
    queryKey: ['erreurs-techniques', f],
    queryFn: () => api.get('/erreurs-techniques/', f),
    placeholderData: keepPreviousData,
    refetchInterval: secours,
  });
  const recharger = () => qc.invalidateQueries({ queryKey: ['erreurs-techniques'] });

  const basculer = async (e) => {
    try {
      await api.patch(`/erreurs-techniques/${e.id}/`, { resolue: !e.resolue });
      toast(e.resolue ? 'Erreur rouverte.' : 'Erreur marquée comme résolue.');
      recharger();
    } catch (err) {
      toast(messageErreur(err), 'erreur');
    }
  };
  const action = async (nom) => {
    setConfirmer(false);
    try {
      const r = await api.post('/erreurs-techniques/actions/', { action: nom });
      toast(
        nom === 'resoudre_tout'
          ? `${r.nombre} erreur${r.nombre > 1 ? 's' : ''} marquée${r.nombre > 1 ? 's' : ''} comme résolue${r.nombre > 1 ? 's' : ''}.`
          : `${r.nombre} erreur${r.nombre > 1 ? 's' : ''} résolue${r.nombre > 1 ? 's' : ''} supprimée${r.nombre > 1 ? 's' : ''}.`,
      );
      recharger();
    } catch (err) {
      toast(messageErreur(err), 'erreur');
    }
  };

  const page = Number(f.page);
  return (
    <PageSuper titre="Erreurs techniques">
      <Carte mde as="section" className="overflow-hidden" aria-labelledby="t-erreurs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mde-bordure px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 id="t-erreurs" className="m-0 text-[17px] font-semibold">
              {data ? `${data.aTraiter} erreur${data.aTraiter > 1 ? 's' : ''} à traiter` : 'Erreurs techniques'}
            </h2>
            <p className="m-0 text-[14px] text-mde-texte-2">
              Les utilisateurs ne voient qu’un message simple. Les erreurs identiques sont regroupées ; conservation 30
              jours.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Statut" className="flex rounded-petit border border-mde-champ p-0.5">
              {STATUTS.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={f.statut === v}
                  onClick={() => maj({ statut: v, page: 1 })}
                  className={`h-9 cursor-pointer rounded-[6px] border-0 px-3 text-[14px] font-semibold ${f.statut === v ? 'bg-mde-texte text-surface' : 'bg-transparent text-mde-texte-2 hover:text-mde-texte'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <select
              aria-label="Filtrer par origine"
              value={f.source}
              onChange={(e) => maj({ source: e.target.value, page: 1 })}
              className={SELECT}
            >
              <option value="">Toutes les origines</option>
              {SOURCES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {f.statut === 'a_traiter' && data?.total > 0 && (
              <Bouton variante="mde-secondaire" onClick={() => action('resoudre_tout')}>
                Tout marquer résolu
              </Bouton>
            )}
            {f.statut === 'resolues' && data?.total > 0 && (
              <Bouton variante="mde-secondaire" onClick={() => setConfirmer(true)}>
                Supprimer les résolues
              </Bouton>
            )}
          </div>
        </div>

        <ul className="m-0 list-none p-0">
          {isLoading &&
            [1, 2, 3].map((k) => (
              <li key={k} className="border-t border-mde-bordure-ligne px-5 py-4 first:border-t-0">
                <Squelette />
              </li>
            ))}
          {data?.resultats.map((e) => {
            const deplie = ouverte === e.id;
            return (
              <li key={e.id} className="border-t border-mde-bordure-ligne first:border-t-0">
                <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <span
                    title={e.sourceLibelle}
                    className={`flex h-10 w-10 flex-none items-center justify-center rounded-moyen text-[19px] ${e.resolue ? 'bg-mde-survol text-mde-texte-2' : 'bg-erreur-doux text-erreur'}`}
                  >
                    <Icon nom={ICONE_SOURCE[e.source] || 'alert'} />
                  </span>
                  <button
                    type="button"
                    aria-expanded={deplie}
                    onClick={() => setOuverte(deplie ? null : e.id)}
                    className="flex min-w-[220px] flex-1 cursor-pointer flex-col gap-1 border-0 bg-transparent p-0 text-left text-mde-texte"
                  >
                    <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">
                      <span className="font-mono text-[14px] text-erreur">{e.type}</span> · {e.message}
                    </span>
                    <span className="text-[13.5px] text-mde-texte-2">
                      {e.sourceLibelle}
                      {e.lieu ? ` · ${e.lieu}` : ''} · dernière fois {jourHeure(e.derniere)}
                    </span>
                  </button>
                  <span
                    className="inline-flex h-[26px] flex-none items-center rounded-full bg-mde-survol px-2.5 text-[13px] font-semibold tabular-nums"
                    title="Nombre d’occurrences"
                  >
                    × {e.occurrences}
                  </span>
                  <button
                    type="button"
                    onClick={() => basculer(e)}
                    className="flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-bouton border border-mde-champ bg-surface px-3 text-[14px] font-semibold text-mde-texte hover:bg-mde-survol"
                  >
                    <Icon nom={e.resolue ? 'undo' : 'check'} className="text-[16px]" />
                    {e.resolue ? 'Rouvrir' : 'Résolue'}
                  </button>
                </div>
                {deplie && (
                  <div className="flex flex-col gap-3 border-t border-dashed border-mde-bordure-ligne bg-mde-entete px-5 py-4 text-[14px]">
                    <dl className="m-0 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
                      <dt className="text-mde-texte-2">Première occurrence</dt>
                      <dd className="m-0">{jourHeure(e.premiere)}</dd>
                      {e.navigateur && (
                        <>
                          <dt className="text-mde-texte-2">Navigateur</dt>
                          <dd className="m-0 [overflow-wrap:anywhere]">{e.navigateur}</dd>
                        </>
                      )}
                      {e.resolueLe && (
                        <>
                          <dt className="text-mde-texte-2">Résolue le</dt>
                          <dd className="m-0">{jourHeure(e.resolueLe)}</dd>
                        </>
                      )}
                    </dl>
                    {e.details ? (
                      <pre className="m-0 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-petit border border-mde-bordure bg-surface p-3 font-mono text-[12.5px] leading-[1.5] text-mde-texte [overflow-wrap:anywhere]">
                        {e.details}
                      </pre>
                    ) : (
                      <p className="m-0 text-mde-texte-2">Aucun détail technique.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {data?.total === 0 && (
          <p className="m-0 flex flex-col items-center gap-2 px-5 py-12 text-center text-mde-texte-2">
            <Icon nom="checkCircle" className="text-[28px] text-succes" />
            {f.statut === 'a_traiter' ? 'Aucune erreur à traiter.' : 'Aucune erreur pour ces filtres.'}
          </p>
        )}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-mde-bordure px-5 py-3 text-[14px] text-mde-texte-2">
            <span>
              Page {data.page} sur {data.pages} · {data.total} erreurs
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Page précédente"
                disabled={page <= 1}
                onClick={() => maj({ page: page - 1 })}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-bouton border border-mde-bordure bg-surface text-[18px] disabled:opacity-40"
              >
                <Icon nom="chevL" />
              </button>
              <button
                type="button"
                aria-label="Page suivante"
                disabled={page >= data.pages}
                onClick={() => maj({ page: page + 1 })}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-bouton border border-mde-bordure bg-surface text-[18px] disabled:opacity-40"
              >
                <Icon nom="chevR" />
              </button>
            </div>
          </div>
        )}
      </Carte>

      <Dialogue
        ouvert={confirmer}
        titre="Supprimer les erreurs résolues ?"
        tonalite="erreur"
        icone="trash"
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="mde-secondaire" onClick={() => setConfirmer(false)} data-autofocus>
              Annuler
            </Bouton>
            <Bouton variante="destructif" onClick={() => action('supprimer_resolues')}>
              Supprimer
            </Bouton>
          </>
        }
      >
        Elles disparaissent définitivement du journal. Une erreur qui se reproduit sera de nouveau enregistrée.
      </Dialogue>
    </PageSuper>
  );
}
