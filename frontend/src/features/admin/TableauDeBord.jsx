import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import { nombre } from '../../lib/format';
import { marquerMaj, useSecours } from '../../lib/tempsReel';
import Carte from '../../components/ui/Carte';
import Icon from '../../components/ui/Icon';
import Squelette from '../../components/ui/Squelette';

const COULEURS_MODES = ['bg-p', 'barre-segment-mode-1', 'barre-segment-mode-2', 'bg-neutre'];
// mêmes teintes que les classes ci-dessus, pour les graphiques SVG
const TEINTES_MODES = [
  'var(--p)',
  'color-mix(in srgb, var(--p) 55%, #fff)',
  'color-mix(in srgb, var(--p) 28%, #fff)',
  'var(--neutre)',
];
const INFOBULLE = {
  borderRadius: 10,
  border: '1px solid var(--bordure)',
  fontFamily: 'Poppins',
  fontSize: 13,
  boxShadow: 'var(--ombre-carte)',
};
const jourMois = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** A3 · Tableau de bord temps réel (WebSocket ; interrogation toutes les 5 s en secours) et rapport PDF. */
export default function TableauDeBord({ ev }) {
  const naviguer = useNavigate();
  const secours = useSecours(5000);
  const {
    data: s,
    error,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['statistiques', ev.id],
    queryFn: () => api.get(`/evenements/${ev.id}/statistiques/`),
    refetchInterval: secours,
  });
  useEffect(() => {
    if (dataUpdatedAt) marquerMaj(dataUpdatedAt);
  }, [dataUpdatedAt]);

  if (error)
    return (
      <Carte className="p-6">
        <p role="alert" className="m-0 text-erreur">
          Impossible de charger les statistiques. Nouvelle tentative automatique…
        </p>
      </Carte>
    );
  if (!s)
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {[1, 2, 3, 4].map((k) => (
          <Squelette key={k} className="h-[140px] !rounded-carte" />
        ))}
      </div>
    );

  const precedente = s.comparaison.find((c) => !c.enCours);
  const kpis = [
    { icone: 'users', label: 'Inscrits', valeur: nombre(s.inscrits), sub: `Capacité ${nombre(s.capacite)} places` },
    {
      icone: 'userCheck',
      label: 'Présents',
      valeur: nombre(s.presents),
      sub: `+${s.presents15min} sur les 15 dernières minutes`,
    },
    {
      icone: 'clock',
      label: 'Inscrits non présents',
      valeur: nombre(s.nonPresents),
      sub: `Attendus avant ${s.heureDebut}`,
    },
    {
      icone: 'chart',
      label: 'Taux de présence',
      valeur: `${s.taux} %`,
      sub: precedente ? `${precedente.taux} % en ${precedente.annee} (final)` : 'Première édition',
    },
  ];
  const total = s.modes.reduce((a, m) => a + m.nb, 0);
  const max = Math.max(1, ...s.tranches.map((t) => t.arrivees));
  let cumul = 0;
  const donnees = s.tranches.map((t, i) => {
    cumul += t.arrivees;
    return { ...t, i, cumul, etiquette: i % 2 === 0 ? t.debut : '' };
  });
  const maxPoste = Math.max(1, ...s.postes.map((p) => p.nb));

  return (
    <>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {kpis.map((k) => (
          <Carte key={k.label} className="flex animate-in-up flex-col gap-2 p-5">
            <span className="flex items-center gap-2.5 text-[15px] font-medium text-texte-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-moyen bg-ps text-[18px] text-p">
                <Icon nom={k.icone} />
              </span>
              {k.label}
            </span>
            <span className="text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums">{k.valeur}</span>
            <span className="text-[14px] text-texte-2">{k.sub}</span>
          </Carte>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Carte as="section" className="flex min-w-0 flex-col gap-5 px-6 py-5" aria-labelledby="t-arrivees">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="t-arrivees" className="m-0 text-[17px] font-semibold">
              Arrivées par tranche de 15 minutes
            </h2>
            <span className="text-[14px] text-texte-2">
              {s.pic
                ? `Pic : ${s.pic.debut} – ${s.pic.fin} · ${s.pic.arrivees} arrivées`
                : 'Aucune arrivée pour le moment'}
            </span>
          </div>
          <div
            className="h-[230px]"
            role="img"
            aria-label={`Arrivées par tranche de 15 minutes. ${s.tranches.map((t) => `${t.debut} : ${t.arrivees}`).join(', ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={donnees} margin={{ top: 22, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
                <XAxis
                  dataKey="etiquette"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--bordure)' }}
                  interval={0}
                  tick={{ fontSize: 12, fill: 'var(--texte-2)' }}
                />
                <YAxis yAxisId="arrivees" hide domain={[0, (m) => Math.max(1, m * 1.15)]} />
                <YAxis yAxisId="cumul" hide orientation="right" domain={[0, (m) => Math.max(1, m * 1.08)]} />
                <Tooltip
                  cursor={{ fill: 'var(--fond)' }}
                  formatter={(v, nom) => [nom === 'cumul' ? `${v} présents au total` : `${v} arrivées`, '']}
                  labelFormatter={(_, p) => (p?.[0] ? `${p[0].payload.debut} – ${p[0].payload.fin}` : '')}
                  contentStyle={INFOBULLE}
                  itemStyle={{ color: 'var(--texte)' }}
                />
                <Bar
                  yAxisId="arrivees"
                  dataKey="arrivees"
                  radius={[6, 6, 2, 2]}
                  maxBarSize={44}
                  isAnimationActive={false}
                >
                  {donnees.map((d) => (
                    <Cell key={d.i} fill={d.i === s.trancheCourante ? 'var(--p)' : 'var(--ps)'} />
                  ))}
                  <LabelList
                    dataKey="arrivees"
                    position="top"
                    formatter={(v) => (v ? v : '')}
                    style={{ fontSize: 13, fontWeight: 600, fill: 'var(--texte)' }}
                  />
                </Bar>
                <Line
                  yAxisId="cumul"
                  dataKey="cumul"
                  type="monotone"
                  stroke="var(--s)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 text-[13px] text-texte-2" aria-hidden="true">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-p" />
              Arrivées par tranche
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-s" />
              Présents cumulés
            </span>
          </div>
          <span className="sr-only">Maximum : {max} arrivées sur une tranche.</span>
        </Carte>

        <Carte as="section" className="flex min-w-0 flex-col gap-5 px-6 py-5" aria-labelledby="t-modes">
          <h2 id="t-modes" className="m-0 text-[17px] font-semibold">
            Répartition par mode d’émargement
          </h2>
          <div className="relative mx-auto h-[150px] w-[150px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  rootTabIndex={-1} // graphique décoratif : les valeurs sont dans la légende
                  data={total ? s.modes : [{ mode: 'vide', nb: 1 }]}
                  dataKey="nb"
                  nameKey="libelle"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={total ? 2 : 0}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {(total ? s.modes : [{ mode: 'vide' }]).map((m, k) => (
                    <Cell key={m.mode} fill={total ? TEINTES_MODES[k] : 'var(--subtil)'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[26px] font-bold leading-none tabular-nums">{nombre(total)}</span>
              <span className="text-[12px] text-texte-2">présents</span>
            </div>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {s.modes.map((m, k) => (
              <li key={m.mode} className="flex items-center gap-2.5 text-[15px]">
                <span className={`h-2.5 w-2.5 rounded-[3px] ${COULEURS_MODES[k]}`} />
                <span className="flex-1">{m.libelle}</span>
                <span className="font-semibold tabular-nums">{m.nb}</span>
                <span className="w-11 text-right tabular-nums text-texte-2">
                  {total ? Math.round((m.nb / total) * 100) : 0} %
                </span>
              </li>
            ))}
          </ul>
        </Carte>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))' }}>
        <Carte as="section" className="flex min-w-0 flex-col gap-4 px-6 py-5" aria-labelledby="t-inscriptions">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="t-inscriptions" className="m-0 text-[17px] font-semibold">
              Inscriptions cumulées
            </h2>
            <span className="text-[14px] text-texte-2">
              {s.remplissage} % de la capacité ({nombre(s.capacite)} places)
            </span>
          </div>
          {s.inscriptions.length ? (
            <div
              className="h-[180px]"
              role="img"
              aria-label={`Inscriptions cumulées : ${s.inscriptions.at(-1).cumul} au ${jourMois(s.inscriptions.at(-1).date)}.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s.inscriptions} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="degrade-inscriptions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--p)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--p)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={jourMois}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--bordure)' }}
                    minTickGap={28}
                    tick={{ fontSize: 12, fill: 'var(--texte-2)' }}
                  />
                  <YAxis hide domain={[0, (m) => Math.max(m, s.capacite ? Math.min(s.capacite, m * 1.2) : m)]} />
                  <Tooltip
                    contentStyle={INFOBULLE}
                    itemStyle={{ color: 'var(--texte)' }}
                    labelFormatter={jourMois}
                    formatter={(v, nom, p) => [`${v} inscrits (+${p.payload.nb} ce jour)`, '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumul"
                    stroke="var(--p)"
                    strokeWidth={2.5}
                    fill="url(#degrade-inscriptions)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="m-0 text-[15px] text-texte-2">Aucune inscription pour le moment.</p>
          )}
        </Carte>

        <Carte as="section" className="flex min-w-0 flex-col gap-4 px-6 py-5" aria-labelledby="t-postes">
          <h2 id="t-postes" className="m-0 text-[17px] font-semibold">
            Arrivées par poste d’accueil
          </h2>
          {s.postes.length ? (
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {s.postes.map((p) => (
                <li key={p.poste} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-3 text-[15px]">
                    <span className="truncate">{p.poste}</span>
                    <span className="font-semibold tabular-nums">{nombre(p.nb)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-[4px] bg-subtil">
                    <div className="h-full rounded-[4px] bg-p" style={{ width: `${(p.nb / maxPoste) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[15px] text-texte-2">Aucun émargement pour le moment.</p>
          )}
        </Carte>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))' }}>
        <Carte as="section" className="flex flex-col gap-[18px] px-6 py-5" aria-labelledby="t-emails">
          <h2 id="t-emails" className="m-0 text-[17px] font-semibold">
            Suivi des emails
          </h2>
          {[
            { label: 'Email n°1 envoyés · invitation', n: s.emails.invitationsEnvoyees, sur: s.inscrits },
            ...(s.emails.magazineActif
              ? [{ label: 'Email n°2 envoyés · magazine', n: s.emails.magazinesEnvoyes, sur: s.presents }]
              : []),
          ].map((m) => (
            <div key={m.label} className="flex flex-col gap-2">
              <div className="flex justify-between text-[15px]">
                <span>{m.label}</span>
                <span className="font-semibold tabular-nums">
                  {m.n} / {m.sur}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-[3px] bg-subtil">
                <div className="h-full bg-succes" style={{ width: `${m.sur ? (m.n / m.sur) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
          {!s.emails.magazineActif && (
            <p className="m-0 text-[14px] text-texte-2">Email n°2 (magazine) désactivé pour ce programme.</p>
          )}
          {s.emails.invitationsEchec > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-moyen border border-avert-bord bg-avert-fond px-3.5 py-3">
              <Icon nom="alert" className="text-[20px] text-avert" />
              <span className="flex-1 text-[15px] text-avert-texte">
                <strong className="font-semibold">
                  {s.emails.invitationsEchec}{' '}
                  {s.emails.invitationsEchec > 1 ? 'invitations à renvoyer' : 'invitation à renvoyer'}
                </strong>{' '}
                · adresse rejetée ou boîte pleine
              </span>
              <button
                type="button"
                onClick={() => naviguer(`/admin/evenements/${ev.id}/invites?email1=ECHEC`)}
                className="h-10 cursor-pointer rounded-petit border border-avert bg-surface px-3.5 text-[14px] font-semibold text-avert"
              >
                Voir
              </button>
            </div>
          ) : (
            <p className="m-0 flex items-center gap-2 text-[14px] text-succes">
              <Icon nom="checkCircle" className="text-[16px]" />
              Aucun email en échec.
            </p>
          )}
        </Carte>

        <Carte as="section" className="flex flex-col gap-4 px-6 py-5" aria-labelledby="t-comparaison">
          <h2 id="t-comparaison" className="m-0 text-[17px] font-semibold">
            Comparaison avec les années précédentes
          </h2>
          {s.comparaison.length > 1 && (
            <div className="h-[130px]" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...s.comparaison].reverse()} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="annee"
                    tickLine={false}
                    axisLine={{ stroke: 'var(--bordure)' }}
                    tick={{ fontSize: 12, fill: 'var(--texte-2)' }}
                  />
                  <YAxis hide domain={[0, 100]} />
                  <Bar dataKey="taux" radius={[6, 6, 2, 2]} maxBarSize={48} isAnimationActive={false}>
                    {[...s.comparaison].reverse().map((c) => (
                      <Cell key={c.evenement} fill={c.enCours ? 'var(--p)' : 'var(--ps)'} />
                    ))}
                    <LabelList
                      dataKey="taux"
                      position="top"
                      formatter={(v) => `${v} %`}
                      style={{ fontSize: 12, fontWeight: 600, fill: 'var(--texte)' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="text-[13px] text-texte-2">
                <th scope="col" className="w-[72px] pb-2.5 text-left font-normal">
                  Année
                </th>
                <th scope="col" className="pb-2.5 text-right font-normal">
                  Inscrits
                </th>
                <th scope="col" className="pb-2.5 text-right font-normal">
                  Présents
                </th>
                <th scope="col" className="pb-2.5 pl-5 text-left font-normal">
                  Taux de présence
                </th>
              </tr>
            </thead>
            <tbody>
              {s.comparaison.map((c) => (
                <tr key={c.evenement} className="border-t border-bordure-ligne">
                  <td className={`py-3 ${c.enCours ? 'font-bold' : 'font-medium'}`}>{c.annee}</td>
                  <td className="py-3 text-right tabular-nums">{c.inscrits}</td>
                  <td className="py-3 text-right tabular-nums">{c.presents}</td>
                  <td className="py-3 pl-5">
                    <span className="flex items-center gap-2.5">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-subtil">
                        <span
                          className={`block h-full ${c.enCours ? 'bg-p' : 'bg-neutre'}`}
                          style={{ width: `${c.taux}%` }}
                        />
                      </span>
                      <span className="w-11 text-right font-semibold tabular-nums">{c.taux} %</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="text-[14px] text-texte-2">
            {s.comparaison.length > 1
              ? `${ev.annee} en cours · taux final des années précédentes.`
              : 'Aucune édition précédente pour ce programme.'}
          </span>
        </Carte>
      </div>
    </>
  );
}
