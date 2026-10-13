import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, messageErreur } from '../../lib/api';
import { nombre } from '../../lib/format';
import { useSecours } from '../../lib/tempsReel';
import { telecharger } from '../../lib/telechargement';
import useUrlState from '../../lib/useUrlState';
import Carte from '../../components/ui/Carte';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import ErreurChargement, { BandeauErreur } from './ErreurChargement';
import { PageSuper } from './SuperApp';

const BORDEAUX = 'var(--mde-bordeaux)';
const BORDEAUX_CLAIR = 'color-mix(in srgb, var(--mde-bordeaux) 30%, #fff)';
const TEINTES = ['var(--mde-bordeaux)', '#1A5E36', '#B54708', '#2F4B7C', '#6B4C9A', '#5F666C'];
const SOURCES = [
  ['NAVIGATEUR', 'Navigateur', '#2F4B7C'],
  ['SERVEUR', 'Serveur', '#B42318'],
  ['TACHE', 'Tâches', '#B54708'],
  ['EMAIL', 'Emails', '#6B4C9A'],
];
const INFOBULLE = {
  borderRadius: 10,
  border: '1px solid var(--mde-bordure)',
  fontFamily: 'Poppins',
  fontSize: 13,
  boxShadow: 'var(--ombre-carte-mde)',
};
const AXE = { fontSize: 12, fill: 'var(--mde-texte-2)' };
const jourMois = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Analyses du super admin : activité de toutes les cérémonies et indicateurs techniques, rapport PDF. */
export default function Analyses() {
  const toast = useToast();
  const [f, maj] = useUrlState({ onglet: 'activite' });
  const [export_, setExport] = useState(false);

  const exporter = async () => {
    setExport(true);
    try {
      await telecharger('/rapports/global/', { defaut: 'rapport-global.pdf' });
      toast('Rapport PDF téléchargé.');
    } catch (e) {
      toast(messageErreur(e, 'Le rapport n’a pas pu être généré. Réessayez.'), 'erreur');
    } finally {
      setExport(false);
    }
  };

  return (
    <PageSuper titre="Analyses">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Type d’analyse"
          className="flex rounded-moyen border border-mde-bordure bg-surface p-1 shadow-carte-mde"
        >
          {[
            ['activite', 'Activité', 'chart'],
            ['technique', 'Technique', 'activity'],
          ].map(([v, l, i]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={f.onglet === v}
              onClick={() => maj({ onglet: v })}
              className={`flex h-10 cursor-pointer items-center gap-2 rounded-bouton border-0 px-4 text-[15px] font-semibold ${f.onglet === v ? 'bg-mde-texte text-surface' : 'bg-transparent text-mde-texte-2 hover:text-mde-texte'}`}
            >
              <Icon nom={i} className="text-[17px]" />
              {l}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exporter}
          disabled={export_}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-bouton border border-mde-champ bg-surface px-4 text-[15px] font-semibold text-mde-texte shadow-carte-mde hover:bg-mde-survol disabled:opacity-70"
        >
          {export_ ? <Spinner taille={16} /> : <Icon nom="download" className="text-[18px]" />}
          Rapport PDF (activité et technique)
        </button>
      </div>
      {f.onglet === 'technique' ? <Technique /> : <Activite />}
    </PageSuper>
  );
}

function Kpis({ elements }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {elements.map((k) => (
        <Carte mde key={k.label} className="flex min-w-0 animate-in-up flex-col gap-2 p-4 sm:p-5">
          <span className="flex items-center gap-2 text-[15px] font-medium text-mde-texte-2">
            {k.etat !== undefined && (
              <span className={`h-2.5 w-2.5 rounded-full ${k.etat ? 'bg-succes' : 'bg-erreur'}`} aria-hidden="true" />
            )}
            {k.label}
          </span>
          <span className="text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums sm:text-[36px]">
            {k.valeur}
          </span>
          {k.sub && <span className="text-[14px] text-mde-texte-2">{k.sub}</span>}
        </Carte>
      ))}
    </div>
  );
}

function Bloc({ id, titre, sous, children, className = '' }) {
  return (
    <Carte mde as="section" className={`flex min-w-0 flex-col gap-4 px-6 py-5 ${className}`} aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="m-0 text-[17px] font-semibold">
          {titre}
        </h2>
        {sous && <span className="text-[14px] text-mde-texte-2">{sous}</span>}
      </div>
      {children}
    </Carte>
  );
}

function Chargement() {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
      {[1, 2, 3, 4].map((k) => (
        <Squelette key={k} className="h-[140px] !rounded-carte" />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ activité

function Activite() {
  const secours = useSecours(30_000);
  const {
    data: a,
    error,
    refetch,
  } = useQuery({
    queryKey: ['analytique'],
    queryFn: () => api.get('/analytique/'),
    // en échec, nouvel essai toutes les 30 s même si le temps réel est connecté (il ne relance rien)
    refetchInterval: (q) => (q.state.error ? 30_000 : secours),
  });
  if (error && !a) return <ErreurChargement erreur={error} onReessayer={refetch} titre="Analyses indisponibles" />;
  if (!a) return <Chargement />;
  const t = a.totaux;
  const aVenir = a.evenements.filter((e) => e.date >= new Date().toISOString().slice(0, 10));
  const programmes = [...new Set(a.annees.map((x) => x.programme))];
  const parAnnee = Object.values(
    a.annees.reduce((acc, x) => {
      acc[x.annee] = acc[x.annee] || { annee: String(x.annee) };
      acc[x.annee][x.programme] = x.taux;
      return acc;
    }, {}),
  );
  const couleurProgramme = Object.fromEntries(a.programmes.map((p) => [p.programme, p.couleur]));
  const totalModes = a.modes.reduce((s, m) => s + m.nb, 0);

  return (
    <>
      {error && <BandeauErreur erreur={error} onReessayer={refetch} />}
      <Kpis
        elements={[
          { label: 'Cérémonies', valeur: nombre(t.evenements), sub: `${aVenir.length} à venir` },
          { label: 'Inscrits', valeur: nombre(t.inscrits), sub: 'toutes cérémonies' },
          { label: 'Présents', valeur: nombre(t.presents), sub: `taux de présence ${t.taux} % (cérémonies terminées)` },
          {
            label: 'Emails envoyés',
            valeur: nombre(t.emailsEnvoyes),
            sub: `${nombre(t.emailsEchec)} en échec · ${nombre(t.magazinesEnvoyes)} magazines`,
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Bloc
          id="t-jours"
          titre="Inscriptions par jour"
          sous={`${nombre(a.inscriptionsParJour.reduce((s, j) => s + j.nb, 0))} sur 60 jours`}
        >
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.inscriptionsParJour} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--mde-bordure-ligne)" />
                <XAxis dataKey="date" tickFormatter={jourMois} tickLine={false} minTickGap={30} tick={AXE} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXE} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  itemStyle={{ color: 'var(--mde-texte)' }}
                  labelFormatter={jourMois}
                  cursor={{ fill: 'var(--mde-survol)' }}
                  formatter={(v) => [`${v} inscription${v > 1 ? 's' : ''}`, '']}
                  separator=""
                />
                <Bar dataKey="nb" fill={BORDEAUX} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloc>

        <Bloc id="t-prog" titre="Inscrits et présents par programme">
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.programmes} margin={{ top: 18, right: 4, left: -18, bottom: 0 }} barGap={3}>
                <CartesianGrid vertical={false} stroke="var(--mde-bordure-ligne)" />
                <XAxis dataKey="programme" tickLine={false} tick={AXE} interval={0} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXE} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  itemStyle={{ color: 'var(--mde-texte)' }}
                  cursor={{ fill: 'var(--mde-survol)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar
                  dataKey="inscrits"
                  name="Inscrits"
                  fill={BORDEAUX_CLAIR}
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="presents"
                  name="Présents"
                  fill={BORDEAUX}
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloc>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Bloc id="t-annees" titre="Taux de présence par année" sous="par programme">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={parAnnee} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--mde-bordure-ligne)" />
                <XAxis dataKey="annee" tickLine={false} tick={AXE} />
                <YAxis domain={[0, 100]} unit=" %" tickLine={false} axisLine={false} tick={AXE} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  itemStyle={{ color: 'var(--mde-texte)' }}
                  formatter={(v, nom) => [`${v} %`, nom]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                {programmes.map((p, i) => (
                  <Line
                    key={p}
                    dataKey={p}
                    name={p}
                    type="monotone"
                    stroke={couleurProgramme[p] || TEINTES[i % TEINTES.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3.5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Bloc>

        <Bloc id="t-modes" titre="Modes d’émargement" sous="toutes cérémonies">
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative h-[150px] w-[150px] flex-none" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    rootTabIndex={-1} // graphique décoratif : les valeurs sont dans la légende
                    data={totalModes ? a.modes : [{ mode: 'vide', nb: 1 }]}
                    dataKey="nb"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={totalModes ? 2 : 0}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {(totalModes ? a.modes : [{ mode: 'vide' }]).map((m, k) => (
                      <Cell key={m.mode} fill={totalModes ? TEINTES[k] : 'var(--mde-survol)'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-bold leading-none tabular-nums">{nombre(totalModes)}</span>
                <span className="text-[12px] text-mde-texte-2">émargements</span>
              </div>
            </div>
            <ul className="m-0 flex min-w-[180px] flex-1 list-none flex-col gap-2.5 p-0">
              {a.modes.map((m, k) => (
                <li key={m.mode} className="flex items-center gap-2.5 text-[15px]">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TEINTES[k] }} />
                  <span className="flex-1">{m.libelle}</span>
                  <span className="font-semibold tabular-nums">{nombre(m.nb)}</span>
                  <span className="w-11 text-right tabular-nums text-mde-texte-2">
                    {totalModes ? Math.round((m.nb / totalModes) * 100) : 0} %
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Bloc>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Bloc id="t-remplissage" titre="Remplissage des cérémonies à venir" sous="inscrits / capacité">
          {aVenir.length ? (
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {aVenir.map((e) => (
                <li key={e.id} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap justify-between gap-2 text-[15px]">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.couleur }} />
                      {e.nom}
                    </span>
                    <span className="tabular-nums text-mde-texte-2">
                      <strong className="font-semibold text-mde-texte">{nombre(e.inscrits)}</strong> /{' '}
                      {nombre(e.capacite)} · {e.remplissage} %
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-[4px] bg-mde-survol">
                    <div
                      className="h-full rounded-[4px]"
                      style={{ width: `${Math.min(100, e.remplissage)}%`, background: e.couleur }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-mde-texte-2">Aucune cérémonie à venir.</p>
          )}
        </Bloc>

        <Bloc id="t-entreprises" titre="Entreprises les plus représentées">
          {a.entreprises.length ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.entreprises} layout="vertical" margin={{ top: 0, right: 34, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="entreprise"
                    width={150}
                    tickLine={false}
                    axisLine={false}
                    tick={{ ...AXE, fill: 'var(--mde-texte)' }}
                  />
                  <Tooltip
                    contentStyle={INFOBULLE}
                    itemStyle={{ color: 'var(--mde-texte)' }}
                    cursor={{ fill: 'var(--mde-survol)' }}
                    formatter={(v) => [`${v} invités`, '']}
                    separator=""
                  />
                  <Bar dataKey="nb" fill={BORDEAUX} radius={[0, 5, 5, 0]} barSize={16} isAnimationActive={false}>
                    <LabelList
                      dataKey="nb"
                      position="right"
                      style={{ fontSize: 12, fontWeight: 600, fill: 'var(--mde-texte)' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="m-0 text-mde-texte-2">Aucune entreprise renseignée.</p>
          )}
        </Bloc>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ technique

function Technique() {
  const {
    data: t,
    error,
    refetch,
  } = useQuery({
    queryKey: ['analytique-technique'],
    queryFn: () => api.get('/analytique/technique/'),
    refetchInterval: 15_000, // mesures de trafic : non notifiées en temps réel
  });
  if (error && !t) return <ErreurChargement erreur={error} onReessayer={refetch} titre="Indicateurs indisponibles" />;
  if (!t) return <Chargement />;
  const { sante, resume } = t;
  const aTraiter = t.erreursATraiter.reduce((s, x) => s + x.nb, 0);
  return (
    <>
      {error && <BandeauErreur erreur={error} onReessayer={refetch} />}
      <Kpis
        elements={[
          {
            label: 'Base de données',
            etat: sante.base,
            valeur: sante.base ? 'OK' : 'Panne',
            sub: sante.baseMs != null ? `${String(sante.baseMs).replace('.', ',')} ms` : 'injoignable',
          },
          {
            label: 'Redis',
            etat: sante.redis,
            valeur: sante.redis ? 'OK' : 'Panne',
            sub: sante.redis
              ? `cache, temps réel, file · ${String(sante.redisMs).replace('.', ',')} ms`
              : 'mode dégradé : sans cache ni temps réel',
          },
          {
            label: 'Temps de réponse moyen',
            valeur: `${resume.dureeMoyenneMs} ms`,
            sub: `${nombre(resume.requetesHeure)} requêtes · ${resume.lentesHeure} lentes (1 h)`,
          },
          {
            label: 'Erreurs à traiter',
            etat: aTraiter === 0,
            valeur: nombre(aTraiter),
            sub: `${resume.erreurs5xxHeure} erreurs serveur · ${sante.fileEmails ?? '–'} emails en file`,
          },
        ]}
      />

      <Bloc id="t-trafic" titre="Trafic de l’API" sous="par minute, dernière heure">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={t.requetes.map((m) => ({ ...m, dureeMoyenneMs: m.requetes ? m.dureeMoyenneMs : null }))}
              margin={{ top: 10, right: 0, left: -14, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--mde-bordure-ligne)" />
              <XAxis dataKey="minute" tickLine={false} minTickGap={36} tick={AXE} />
              <YAxis yAxisId="n" allowDecimals={false} tickLine={false} axisLine={false} tick={AXE} />
              <YAxis yAxisId="ms" orientation="right" unit=" ms" tickLine={false} axisLine={false} tick={AXE} />
              <Tooltip contentStyle={INFOBULLE} itemStyle={{ color: 'var(--mde-texte)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              <Bar yAxisId="n" dataKey="requetes" name="Requêtes" fill={BORDEAUX_CLAIR} isAnimationActive={false} />
              <Bar yAxisId="n" dataKey="erreurs5xx" name="Erreurs serveur" fill="#B42318" isAnimationActive={false} />
              <Line
                yAxisId="ms"
                dataKey="dureeMoyenneMs"
                name="Temps de réponse (ms)"
                type="linear"
                stroke="#2F4B7C"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Bloc>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Bloc id="t-erreurs" titre="Nouvelles erreurs techniques" sous="par jour et par origine, 14 jours">
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={t.erreursParJour} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--mde-bordure-ligne)" />
                <XAxis dataKey="date" tickFormatter={jourMois} tickLine={false} tick={AXE} minTickGap={20} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXE} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  itemStyle={{ color: 'var(--mde-texte)' }}
                  labelFormatter={jourMois}
                  cursor={{ fill: 'var(--mde-survol)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                {SOURCES.map(([cle, libelle, couleur]) => (
                  <Bar key={cle} dataKey={cle} name={libelle} stackId="e" fill={couleur} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloc>

        <Bloc id="t-sources" titre="Erreurs à traiter et emails (24 h)">
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {t.erreursATraiter.map((x) => (
              <li key={x.source} className="flex items-center gap-2.5 text-[15px]">
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: SOURCES.find(([c]) => c === x.source)?.[2] }}
                />
                <span className="flex-1">{x.libelle}</span>
                <span className="font-semibold tabular-nums">{nombre(x.nb)}</span>
                <span className="w-24 text-right text-[13px] tabular-nums text-mde-texte-2">
                  {x.dernieres24h} vues 24 h
                </span>
              </li>
            ))}
          </ul>
          <div className="h-px bg-mde-bordure-ligne" />
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Envoyés', t.emails24h.envoyes, 'text-succes'],
              ['En échec', t.emails24h.echecs, 'text-erreur'],
              ['En attente', t.emails24h.attente, 'text-mde-texte'],
            ].map(([l, v, c]) => (
              <div key={l} className="flex flex-col gap-0.5 rounded-moyen bg-mde-entete py-3">
                <span className={`text-[24px] font-bold tabular-nums ${c}`}>{nombre(v)}</span>
                <span className="text-[13px] text-mde-texte-2">{l}</span>
              </div>
            ))}
          </div>
        </Bloc>
      </div>
    </>
  );
}
