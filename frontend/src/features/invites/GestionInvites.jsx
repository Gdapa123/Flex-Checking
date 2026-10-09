import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { api, messageErreur } from '../../lib/api';
import { heure, jour, MODES } from '../../lib/format';
import { marquerMaj } from '../../lib/tempsReel';
import { suivreTache, telecharger } from '../../lib/telechargement';
import useUrlState from '../../lib/useUrlState';
import Icon from '../../components/ui/Icon';
import Segmente from '../../components/ui/Segmente';
import Spinner from '../../components/ui/Spinner';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import { BadgeStatut, EtatEmail } from './badges';
import PanneauAjout from './PanneauAjout';
import PanneauInvite from './PanneauInvite';

const DEFAUTS = {
  q: '',
  statut: '',
  mode: '',
  magazine: '',
  email1: '',
  tri: '-inscritLe',
  page: '1',
  taille: '25',
  fiche: '',
  evenement: '',
  programme: '',
};

/**
 * A4 · Gestion des invités (admin) et SA9 · Tous les invités (super admin, `univers="mde"`).
 * Recherche, filtres, tri et page synchronisés avec l'URL ; tri et pagination côté serveur ;
 * rafraîchissement automatique toutes les 5 s sans perdre la sélection ni la position.
 */
export default function GestionInvites({ evenement, univers = 'programme', evenements = [], programmes = [] }) {
  const mde = univers === 'mde';
  const toast = useToast();
  const qc = useQueryClient();
  const [f, majUrl] = useUrlState(DEFAUTS);
  const [recherche, setRecherche] = useState(f.q);
  const [selection, setSelection] = useState(() => new Set());
  const [ajout, setAjout] = useState(false);
  const [exportEnCours, setExportEnCours] = useState('');
  const [actionEnCours, setActionEnCours] = useState('');
  const base = evenement ? `/evenements/${evenement.id}/invites/` : '/invites/';

  // recherche différée (300 ms) avant d'écrire dans l'URL
  useEffect(() => setRecherche(f.q), [f.q]);
  useEffect(() => {
    if (recherche === f.q) return undefined;
    const t = setTimeout(() => majUrl({ q: recherche, page: 1 }, { remplacer: true }), 300);
    return () => clearTimeout(t);
  }, [recherche, f.q, majUrl]);

  const filtres = {
    q: f.q,
    statut: f.statut,
    mode: f.mode,
    magazine: f.magazine,
    email1: f.email1,
    evenement: f.evenement,
    programme: f.programme,
  };
  const params = { ...filtres, tri: f.tri, page: f.page, taille: f.taille };
  const { data, isLoading, isFetching, error, dataUpdatedAt } = useQuery({
    queryKey: ['invites', base, params],
    queryFn: () => api.get(base, params),
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
  });
  useEffect(() => {
    if (dataUpdatedAt) marquerMaj(dataUpdatedAt);
  }, [dataUpdatedAt]);
  useEffect(() => {
    if (error?.status === 404 && f.page !== '1') majUrl({ page: 1 }, { remplacer: true });
  }, [error, f.page, majUrl]);

  const lignes = useMemo(() => data?.resultats || [], [data]);
  const c = data?.compteurs || { tous: 0, inscrits: 0, presents: 0, aRenvoyer: 0 };
  const filtresActifs = !!(f.q || f.statut || f.mode || f.magazine || f.email1 || f.evenement || f.programme);
  const definirFiltre = (o) => majUrl({ ...o, page: 1 });
  const invalider = () => {
    qc.invalidateQueries({ queryKey: ['invites'] });
    qc.invalidateQueries({ queryKey: ['statistiques'] });
  };

  // ------------------------------------------------------------------ actions
  const basculerPresence = async (inv) => {
    try {
      if (inv.statut === 'INSCRIT') {
        const r = await api.post(`/invites/${inv.id}/presence/`);
        toast(`Présence validée · ${inv.nomComplet}.${r.magazineEnvoye ? ' Email n°2 envoyé.' : ''}`);
      } else {
        await api.post(`/invites/${inv.id}/presence/annulation/`, {
          motif: 'Annulation depuis le tableau des invités',
        });
        toast(`Présence annulée · ${inv.nomComplet} repasse au statut Inscrit.`, 'info');
      }
      invalider();
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
  };

  const actionGroupee = async (action) => {
    const ids = [...selection];
    setActionEnCours(action);
    try {
      const r = await api.post(`${base}actions-groupees/`, { action, ids }, { brut: false });
      const res = r.tacheId ? await suivreTache(r.tacheId) : r;
      if (action === 'VALIDER')
        toast(
          res.traites
            ? `${res.traites} ${res.traites > 1 ? 'présences validées' : 'présence validée'}. Emails n°2 envoyés.`
            : 'Les invités sélectionnés sont déjà présents.',
          res.traites ? 'ok' : 'info',
        );
      else toast(`Invitation renvoyée à ${res.traites} ${res.traites > 1 ? 'invités' : 'invité'}.`);
      setSelection(new Set());
      invalider();
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    } finally {
      setActionEnCours('');
    }
  };

  const exporter = async (format, selectionSeule = false) => {
    setExportEnCours(selectionSeule ? 'selection' : format);
    try {
      const r = selectionSeule
        ? await telecharger(`${base}actions-groupees/`, {
            methode: 'POST',
            corps: { action: 'EXPORTER', ids: [...selection], format },
          })
        : await telecharger(`${base}export/`, { params: { ...filtres, format } });
      const nb = selectionSeule ? selection.size : (r.nb ?? data?.total);
      toast(
        `Export ${format === 'csv' ? 'CSV' : 'Excel'} téléchargé · ${nb} ${nb > 1 ? 'invités' : 'invité'}${r.asynchrone ? ' (préparé en arrière-plan)' : ''}.`,
      );
    } catch (e) {
      toast(messageErreur(e, 'L’export a échoué.'), 'erreur');
    } finally {
      setExportEnCours('');
    }
  };

  // ------------------------------------------------------------------ tableau
  const selectionnable = !!evenement;
  const toutesCochees = lignes.length > 0 && lignes.every((l) => selection.has(l.id));
  const basculerTout = () =>
    setSelection((s) => {
      const n = new Set(s);
      lignes.forEach((l) => (toutesCochees ? n.delete(l.id) : n.add(l.id)));
      return n;
    });
  const basculer = (id) =>
    setSelection((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const colonnes = useMemo(() => {
    const cols = [
      {
        id: 'nom',
        header: 'Invité',
        tri: 'nom',
        cell: ({ row: { original: r } }) => (
          <div className="flex min-w-[200px] flex-col">
            <span className="font-semibold">{r.nomComplet}</span>
            <span className="text-[13px] text-texte-2">{r.email}</span>
          </div>
        ),
      },
      ...(!evenement
        ? [
            {
              id: 'evenement',
              header: 'Événement',
              tri: 'evenement',
              cell: ({ row: { original: r } }) => <span className="whitespace-nowrap">{r.evenementNom}</span>,
            },
          ]
        : []),
      {
        id: 'entreprise',
        header: 'Entreprise',
        tri: 'entreprise',
        cell: ({ row: { original: r } }) => (
          <div className="flex flex-col">
            <span>{r.entreprise || '—'}</span>
            <span className="text-[13px] text-texte-2">{r.fonction}</span>
          </div>
        ),
      },
      {
        id: 'statut',
        header: 'Statut',
        tri: 'statut',
        cell: ({ row: { original: r } }) => <BadgeStatut statut={r.statut} />,
      },
      {
        id: 'inscritLe',
        header: 'Inscrit le',
        tri: 'inscritLe',
        cell: ({ row: { original: r } }) => (
          <div className="flex flex-col whitespace-nowrap tabular-nums">
            <span>{jour(r.inscritLe)}</span>
            <span className="text-[13px] text-texte-2">{heure(r.inscritLe)}</span>
          </div>
        ),
      },
      {
        id: 'presentLe',
        header: 'Présence',
        tri: 'presentLe',
        cell: ({ row: { original: r } }) => (
          <div className="flex flex-col whitespace-nowrap">
            <span className="tabular-nums">{r.presentLe ? heure(r.presentLe) : '—'}</span>
            <span className="text-[13px] text-texte-2">{MODES[r.modeEmargement] || ''}</span>
          </div>
        ),
      },
      {
        id: 'email1',
        header: 'Email 1',
        tri: 'email1',
        cell: ({ row: { original: r } }) => <EtatEmail statut={r.email1} />,
      },
      {
        id: 'email2',
        header: 'Email 2',
        tri: 'email2',
        cell: ({ row: { original: r } }) => <EtatEmail statut={r.email2} magazine />,
      },
    ];
    return cols;
  }, [evenement]);

  const table = useReactTable({
    data: lignes,
    columns: colonnes,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: (r) => String(r.id),
  });

  const trier = (cle) => {
    const actuel = f.tri.replace('-', '');
    const desc = f.tri.startsWith('-');
    majUrl({ tri: actuel === cle ? (desc ? cle : `-${cle}`) : cle, page: 1 });
  };

  const actifKpi =
    f.email1 === 'ECHEC'
      ? 'renvoi'
      : f.statut === 'INSCRIT'
        ? 'inscrits'
        : f.statut === 'PRESENT'
          ? 'presents'
          : 'tous';
  const kpis = [
    { cle: 'tous', label: 'Tous les invités', valeur: c.tous, point: 'bg-champ', filtre: { statut: '', email1: '' } },
    {
      cle: 'inscrits',
      label: 'Inscrits non présents',
      valeur: c.inscrits,
      point: 'bg-texte-2',
      filtre: { statut: 'INSCRIT', email1: '' },
    },
    {
      cle: 'presents',
      label: 'Présents',
      valeur: c.presents,
      point: 'bg-succes',
      filtre: { statut: 'PRESENT', email1: '' },
    },
    {
      cle: 'renvoi',
      label: 'Invitations à renvoyer',
      valeur: c.aRenvoyer,
      point: 'bg-avert',
      filtre: { statut: '', email1: 'ECHEC' },
    },
  ];

  const page = Number(f.page);
  const pages = data?.pages || 1;
  const taille = Number(f.taille);
  const boutonsPage = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) boutonsPage.push(p);
    else if (boutonsPage[boutonsPage.length - 1] !== '…') boutonsPage.push('…');
  }
  const select = `h-11 rounded-moyen border bg-surface px-3 text-[14px] font-medium ${mde ? 'border-mde-champ text-mde-texte' : 'border-champ text-texte'}`;
  const ficheId = f.fiche ? Number(f.fiche) : null;

  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        {kpis.map((k) => {
          const on = actifKpi === k.cle;
          return (
            <button
              key={k.cle}
              type="button"
              aria-pressed={on}
              onClick={() => definirFiltre(k.filtre)}
              className={`box-border flex cursor-pointer flex-col gap-1.5 rounded-carte border px-[18px] py-4 text-left transition-[background,box-shadow] hover:border-champ ${
                on
                  ? mde
                    ? 'border-mde-bordeaux bg-mde-survol shadow-carte-mde ring-1 ring-mde-bordeaux'
                    : 'border-p bg-ps shadow-carte ring-1 ring-p'
                  : `bg-surface ${mde ? 'border-mde-bordure-carte shadow-carte-mde' : 'border-bordure shadow-carte'}`
              }`}
            >
              <span
                className={`flex items-center gap-2 text-[14px] font-medium ${mde ? 'text-mde-texte-2' : 'text-texte-2'}`}
              >
                <span className={`h-2 w-2 rounded-full ${k.point}`} />
                {k.label}
              </span>
              <span className="text-[32px] font-bold leading-[1.1] tracking-[-0.025em] tabular-nums">
                {data ? k.valeur : '–'}
              </span>
            </button>
          );
        })}
      </div>

      <section
        aria-label="Liste des invités"
        className={`flex min-w-0 flex-col rounded-carte border bg-surface ${mde ? 'border-mde-bordure-carte shadow-carte-mde' : 'border-bordure-carte shadow-carte'}`}
      >
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div
            data-fw="1"
            className={`flex h-11 max-w-[360px] flex-[1_1_240px] items-center gap-2.5 rounded-moyen border px-3 ${mde ? 'border-mde-champ' : 'border-champ'}`}
          >
            <Icon nom="search" className="text-[18px] text-texte-2" />
            <input
              aria-label="Rechercher un invité"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, email, téléphone, entreprise, code"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-texte outline-none"
            />
            {isFetching && !isLoading && <Spinner taille={14} className="text-texte-2" />}
          </div>
          <Segmente
            label="Statut"
            taille="sm"
            variante={mde ? 'mde' : 'programme'}
            valeur={f.statut}
            onChange={(v) => definirFiltre({ statut: v })}
            options={[
              { value: '', label: 'Tous' },
              { value: 'INSCRIT', label: 'Inscrits' },
              { value: 'PRESENT', label: 'Présents' },
            ]}
          />
          {!evenement && (
            <>
              <select
                aria-label="Événement"
                value={f.evenement}
                onChange={(e) => definirFiltre({ evenement: e.target.value })}
                className={select}
              >
                <option value="">Tous les événements</option>
                {evenements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nomAffiche}
                  </option>
                ))}
              </select>
              <select
                aria-label="Programme"
                value={f.programme}
                onChange={(e) => definirFiltre({ programme: e.target.value })}
                className={select}
              >
                <option value="">Tous les programmes</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </>
          )}
          <select
            aria-label="Mode d’émargement"
            value={f.mode}
            onChange={(e) => definirFiltre({ mode: e.target.value })}
            className={select}
          >
            <option value="">Tous les modes</option>
            {Object.entries(MODES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="Magazine"
            value={f.magazine}
            onChange={(e) => definirFiltre({ magazine: e.target.value })}
            className={select}
          >
            <option value="">Magazine : tous</option>
            <option value="ENVOYE">Email 2 envoyé</option>
            <option value="NON">Email 2 non envoyé</option>
          </select>
          {filtresActifs && (
            <button
              type="button"
              onClick={() =>
                definirFiltre({ q: '', statut: '', mode: '', magazine: '', email1: '', evenement: '', programme: '' })
              }
              className="flex h-11 cursor-pointer items-center gap-1.5 rounded-moyen border-0 bg-transparent px-3 text-[14px] font-semibold text-inherit underline underline-offset-[3px]"
            >
              <Icon nom="x" className="text-[16px]" />
              Réinitialiser
            </button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {['csv', 'xlsx'].map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => exporter(fmt)}
                disabled={!!exportEnCours}
                className={`flex h-11 cursor-pointer items-center gap-2 rounded-moyen border bg-surface px-3.5 text-[14px] font-semibold disabled:opacity-60 ${mde ? 'border-mde-champ text-mde-texte hover:bg-mde-survol' : 'border-champ text-texte hover:bg-fond'}`}
              >
                {exportEnCours === fmt ? <Spinner taille={14} /> : <Icon nom="download" className="text-[16px]" />}
                {fmt === 'csv' ? 'CSV' : 'Excel'}
              </button>
            ))}
            {evenement && (
              <button
                type="button"
                onClick={() => setAjout(true)}
                className="btn-principal flex h-11 cursor-pointer items-center gap-2 rounded-moyen border-0 px-4 text-[14px] font-semibold"
              >
                <Icon nom="plus" className="text-[18px]" />
                Ajouter un invité
              </button>
            )}
          </div>
        </div>

        {selectionnable && selection.size > 0 && (
          <div className="flex animate-fade-in flex-wrap items-center gap-x-3 gap-y-2 border-t border-bordure bg-ps px-4 py-2.5 [animation-duration:.15s]">
            <span className="mr-2 text-[15px] font-semibold">
              {selection.size} {selection.size > 1 ? 'invités sélectionnés' : 'invité sélectionné'}
            </span>
            <button
              type="button"
              onClick={() => actionGroupee('VALIDER')}
              disabled={!!actionEnCours}
              className="btn-principal flex h-10 cursor-pointer items-center gap-2 rounded-petit border-0 px-3.5 text-[14px] font-semibold disabled:opacity-60"
            >
              {actionEnCours === 'VALIDER' ? <Spinner taille={14} /> : <Icon nom="userCheck" className="text-[16px]" />}
              Valider la présence
            </button>
            <button
              type="button"
              onClick={() => actionGroupee('RENVOYER')}
              disabled={!!actionEnCours}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-petit border border-champ bg-surface px-3.5 text-[14px] font-semibold text-texte disabled:opacity-60"
            >
              {actionEnCours === 'RENVOYER' ? <Spinner taille={14} /> : <Icon nom="send" className="text-[16px]" />}
              Renvoyer l’invitation
            </button>
            <button
              type="button"
              onClick={() => exporter('xlsx', true)}
              disabled={!!exportEnCours}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-petit border border-champ bg-surface px-3.5 text-[14px] font-semibold text-texte disabled:opacity-60"
            >
              {exportEnCours === 'selection' ? (
                <Spinner taille={14} />
              ) : (
                <Icon nom="download" className="text-[16px]" />
              )}
              Exporter la sélection
            </button>
            <button
              type="button"
              onClick={() => setSelection(new Set())}
              className="ml-auto h-10 cursor-pointer border-0 bg-transparent px-3 text-[14px] font-semibold text-texte underline underline-offset-[3px]"
            >
              Désélectionner
            </button>
          </div>
        )}

        {/* Vue tableau (desktop) */}
        <div className="relative hidden overflow-x-auto border-t border-bordure lg:block">
          <table className="w-full min-w-[980px] border-collapse text-[15px]">
            <thead>
              <tr className={mde ? 'bg-mde-entete' : 'bg-fond'}>
                {selectionnable && (
                  <th className="w-12 pl-4 text-left">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner sur la page"
                      checked={toutesCochees}
                      onChange={basculerTout}
                      className="h-[18px] w-[18px] cursor-pointer accent-p"
                    />
                  </th>
                )}
                {table.getHeaderGroups()[0].headers.map((h) => {
                  const cle = h.column.columnDef.tri;
                  const actuel = f.tri.replace('-', '') === cle;
                  const desc = f.tri.startsWith('-');
                  return (
                    <th
                      key={h.id}
                      aria-sort={actuel ? (desc ? 'descending' : 'ascending') : 'none'}
                      className="whitespace-nowrap p-0 text-left text-[13px] font-semibold"
                    >
                      <button
                        type="button"
                        onClick={() => trier(cle)}
                        className={`flex h-11 cursor-pointer items-center gap-1 border-0 bg-transparent px-3 text-[13px] font-semibold ${actuel ? 'text-texte' : 'text-texte-2'}`}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <Icon
                          nom={actuel ? (desc ? 'arrowDown' : 'arrowUp') : 'sort'}
                          className={`text-[14px] ${actuel ? '' : 'opacity-45'}`}
                        />
                      </button>
                    </th>
                  );
                })}
                <th className="px-4 text-right text-[13px] font-semibold text-texte-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                [1, 2, 3, 4, 5, 6].map((k) => (
                  <tr key={k}>
                    <td colSpan={colonnes.length + 2} className="border-t border-bordure-ligne px-4 py-3.5">
                      <Squelette />
                    </td>
                  </tr>
                ))}
              {table.getRowModel().rows.map((row) => {
                const r = row.original;
                const coche = selection.has(r.id);
                return (
                  <tr
                    key={row.id}
                    onClick={() => majUrl({ fiche: r.id })}
                    className={`cursor-pointer transition-colors hover:bg-fond ${coche ? 'bg-ps' : 'bg-surface'}`}
                  >
                    {selectionnable && (
                      <td className="border-t border-bordure-ligne pl-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner ${r.nomComplet}`}
                          checked={coche}
                          onChange={() => basculer(r.id)}
                          className="h-[18px] w-[18px] cursor-pointer accent-p"
                        />
                      </td>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="border-t border-bordure-ligne p-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                    <td
                      className="border-t border-bordure-ligne py-2 pl-3 pr-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <BoutonPresence invite={r} onClick={() => basculerPresence(r)} court />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Vue cartes (tablette, mobile) */}
        <ul className="m-0 flex list-none flex-col border-t border-bordure p-0 lg:hidden">
          {isLoading &&
            [1, 2, 3].map((k) => (
              <li key={k} className="p-4">
                <Squelette className="h-16" />
              </li>
            ))}
          {lignes.map((r) => (
            <li
              key={r.id}
              className={`flex items-start gap-3 border-b border-bordure-ligne p-4 ${selection.has(r.id) ? 'bg-ps' : ''}`}
            >
              {selectionnable && (
                <input
                  type="checkbox"
                  aria-label={`Sélectionner ${r.nomComplet}`}
                  checked={selection.has(r.id)}
                  onChange={() => basculer(r.id)}
                  className="mt-1 h-[18px] w-[18px] cursor-pointer accent-p"
                />
              )}
              <button
                type="button"
                onClick={() => majUrl({ fiche: r.id })}
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1.5 border-0 bg-transparent p-0 text-left text-inherit"
              >
                <span className="font-semibold">{r.nomComplet}</span>
                <span className="text-[13px] text-texte-2">
                  {r.entreprise || 'Particulier'} · {r.email}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <BadgeStatut statut={r.statut} />
                  {r.presentLe && (
                    <span className="text-[13px] tabular-nums text-texte-2">
                      {heure(r.presentLe)} · {MODES[r.modeEmargement]}
                    </span>
                  )}
                  {!evenement && <span className="text-[13px] text-texte-2">{r.evenementNom}</span>}
                </span>
              </button>
              <BoutonPresence invite={r} onClick={() => basculerPresence(r)} court />
            </li>
          ))}
        </ul>

        {!isLoading && lignes.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[12px] bg-subtil text-[26px]">
              <Icon nom={filtresActifs ? 'search' : 'users'} />
            </div>
            <span className="text-[18px] font-semibold">
              {filtresActifs ? 'Aucun invité ne correspond à ces filtres' : 'Aucun invité pour le moment'}
            </span>
            <span className="text-[15px] text-texte-2">
              {filtresActifs
                ? 'Modifiez la recherche ou réinitialisez les filtres.'
                : 'Les inscriptions apparaîtront ici en temps réel.'}
            </span>
            {filtresActifs && (
              <button
                type="button"
                onClick={() =>
                  definirFiltre({ q: '', statut: '', mode: '', magazine: '', email1: '', evenement: '', programme: '' })
                }
                className="h-11 cursor-pointer rounded-moyen border border-champ bg-surface px-4 text-[15px] font-semibold text-texte"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
        {error && error.status !== 404 && (
          <p role="alert" className="m-0 border-t border-bordure px-4 py-3 text-[14px] text-erreur">
            Mise à jour impossible. Nouvelle tentative automatique…
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure px-4 py-3">
          <span className="flex items-center gap-3 text-[14px] tabular-nums text-texte-2">
            {data?.total
              ? `${(page - 1) * taille + 1}–${Math.min(data.total, page * taille)} sur ${data.total} invités`
              : '0 invité'}
            <label className="flex items-center gap-2">
              <span className="sr-only">Lignes par page</span>
              <select
                value={f.taille}
                onChange={(e) => majUrl({ taille: e.target.value, page: 1 })}
                className="h-9 rounded-petit border border-bordure bg-surface px-2 text-[14px] text-texte"
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} par page
                  </option>
                ))}
              </select>
            </label>
          </span>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Page précédente"
              disabled={page <= 1}
              onClick={() => majUrl({ page: page - 1 })}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-petit border border-bordure bg-surface text-[18px] text-texte disabled:opacity-40"
            >
              <Icon nom="chevL" />
            </button>
            {boutonsPage.map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} className="px-1 text-texte-2">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => majUrl({ page: p })}
                  className={`h-10 min-w-10 cursor-pointer rounded-petit border text-[14px] font-semibold tabular-nums ${
                    p === page
                      ? mde
                        ? 'border-mde-bordeaux bg-mde-bordeaux text-blanc'
                        : 'border-p bg-p text-op'
                      : 'border-bordure bg-surface text-texte'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label="Page suivante"
              disabled={page >= pages}
              onClick={() => majUrl({ page: page + 1 })}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-petit border border-bordure bg-surface text-[18px] text-texte disabled:opacity-40"
            >
              <Icon nom="chevR" />
            </button>
          </nav>
        </div>
      </section>

      {ficheId && (
        <PanneauInvite
          id={ficheId}
          onFermer={() => majUrl({ fiche: '' })}
          basculerPresence={basculerPresence}
          invalider={invalider}
          univers={univers}
        />
      )}
      {ajout && evenement && (
        <PanneauAjout
          evenement={evenement}
          onFermer={() => setAjout(false)}
          onAjoute={(inv, envoye) => {
            setAjout(false);
            majUrl({ q: '', statut: '', tri: '-inscritLe', page: 1 });
            invalider();
            toast(
              `${inv.nomComplet} ajouté${inv.civilite === 'MME' ? 'e' : ''}${envoye ? ' · invitation envoyée.' : '.'}`,
            );
          }}
        />
      )}
    </>
  );
}

export function BoutonPresence({ invite, onClick, court = false, grand = false }) {
  const inscrit = invite.statut === 'INSCRIT';
  const label = inscrit ? (court ? 'Valider' : 'Valider la présence') : court ? 'Annuler' : 'Annuler la présence';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-petit border bg-surface font-semibold transition-transform active:scale-[.96] ${
        grand ? 'h-11 rounded-moyen px-4 text-[15px]' : 'h-9 px-3 text-[13px]'
      } ${inscrit ? 'border-champ text-texte' : 'border-erreur-bord text-erreur'}`}
    >
      {grand && <Icon nom={inscrit ? 'userCheck' : 'undo'} className="text-[18px]" />}
      {label}
    </button>
  );
}
