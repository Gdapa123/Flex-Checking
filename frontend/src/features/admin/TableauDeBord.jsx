import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import { dateLongue, heureTexte, nombre } from '../../lib/format';
import { marquerMaj, useSecours } from '../../lib/tempsReel';
import Carte from '../../components/ui/Carte';
import Icon from '../../components/ui/Icon';
import Squelette from '../../components/ui/Squelette';
import EtatErreur from '../../components/ui/EtatErreur';
import { useToast } from '../../components/ui/Toasts';

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
    refetch,
  } = useQuery({
    queryKey: ['statistiques', ev.id],
    queryFn: () => api.get(`/evenements/${ev.id}/statistiques/`),
    // en cas d'échec, relance périodique même si le temps réel est connecté (il ne renvoie que des changements)
    // le jour J, rechargement chaque minute même en temps réel : la tranche en cours avance sans nouvel émargement
    refetchInterval: (q) => (q.state.error ? 15_000 : secours || (ev.statut === 'AUJOURDHUI' ? 60_000 : false)),
  });
  useEffect(() => {
    if (dataUpdatedAt) marquerMaj(dataUpdatedAt);
  }, [dataUpdatedAt]);

  if (error && !s)
    return <EtatErreur titre="Statistiques indisponibles" erreur={error} onReessayer={() => refetch()} />;
  if (!s)
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[1, 2, 3, 4].map((k) => (
          <Squelette key={k} className="h-[140px] !rounded-carte" />
        ))}
      </div>
    );

  const precedente = s.comparaison.find((c) => !c.enCours);
  // sous-titres selon le moment : avant, pendant ou après la cérémonie
  const jourJ = ev.statut === 'AUJOURDHUI';
  const terminee = ev.statut === 'TERMINEE';
  const kpis = [
    { icone: 'users', label: 'Inscrits', valeur: nombre(s.inscrits), sub: `Capacité ${nombre(s.capacite)} places` },
    {
      icone: 'userCheck',
      label: 'Présents',
      valeur: nombre(s.presents),
      sub: jourJ
        ? `+${nombre(s.presents15min)} sur les 15 dernières minutes`
        : terminee
          ? 'Cérémonie terminée'
          : 'Émargement le jour de la cérémonie',
    },
    {
      icone: 'clock',
      label: terminee ? 'Inscrits absents' : 'Inscrits non présents',
      valeur: nombre(s.nonPresents),
      sub: terminee ? 'Ne se sont pas présentés' : `Attendus avant ${s.heureDebut}${jourJ ? '' : ' le jour J'}`,
    },
    {
      icone: 'chart',
      label: 'Taux de présence',
      valeur: `${s.taux} %`,
      sub: precedente ? `${precedente.taux} % en ${precedente.annee} (final)` : 'Première édition',
    },
  ];
  const total = s.modes.reduce((a, m) => a + m.nb, 0);
  const maxPoste = Math.max(1, ...s.postes.map((p) => p.nb));

  return (
    <>
      {error && <EtatErreur compact erreur={error} onReessayer={() => refetch()} />}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <Carte key={k.label} className="flex min-w-0 animate-in-up flex-col gap-2 p-4 sm:p-5">
            <span className="flex items-center gap-2.5 text-[14px] font-medium text-texte-2 sm:text-[15px]">
              <span className="flex h-9 w-9 items-center justify-center rounded-moyen bg-ps text-[18px] text-p">
                <Icon nom={k.icone} />
              </span>
              {k.label}
            </span>
            <span className="text-[34px] font-bold leading-none tracking-[-0.03em] tabular-nums sm:text-[44px]">
              {k.valeur}
            </span>
            <span className="text-[13px] leading-snug text-texte-2 sm:text-[14px]">{k.sub}</span>
          </Carte>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <ArriveesParTranche ev={ev} s={s} />

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
                <span className="font-semibold tabular-nums">{nombre(m.nb)}</span>
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
                    separator=""
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
                  {nombre(m.n)} / {nombre(m.sur)}
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
                  {nombre(s.emails.invitationsEchec)}{' '}
                  {s.emails.invitationsEchec > 1 ? 'invitations à renvoyer' : 'invitation à renvoyer'}
                </strong>{' '}
                · adresse rejetée ou boîte pleine
              </span>
              <button
                type="button"
                onClick={() => naviguer(`/admin/evenements/${ev.id}/invites?email1=ECHEC`)}
                className="h-11 cursor-pointer rounded-bouton border border-avert bg-surface px-3.5 text-[14px] font-semibold text-avert"
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
                  <td className="py-3 text-right tabular-nums">{nombre(c.inscrits)}</td>
                  <td className="py-3 text-right tabular-nums">{nombre(c.presents)}</td>
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

      {!terminee && <LienInscription ev={ev} />}
    </>
  );
}

/** « 17h45 » → minutes depuis minuit. */
const enMinutes = (h) => {
  const [hh, mm] = String(h).split('h').map(Number);
  return hh * 60 + mm;
};

function InfobulleArrivees({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={INFOBULLE} className="bg-surface px-3 py-2 text-texte">
      <div className="font-semibold">
        {d.debut} – {d.fin}
      </div>
      <div>{d.arrivees ? `${nombre(d.arrivees)} ${d.arrivees > 1 ? 'arrivées' : 'arrivée'}` : 'Aucune arrivée'}</div>
      <div className="text-texte-2">{nombre(d.cumul)} présents au total à la fin de la tranche</div>
    </div>
  );
}

/**
 * Arrivées à l'accueil par tranche de 15 minutes : nombre d'invités émargés dans chaque tranche, repère du lancement,
 * tranche en cours le jour J. Sans aucune arrivée, un message explique quand le graphique se remplira.
 */
function ArriveesParTranche({ ev, s }) {
  const jourJ = ev.statut === 'AUJOURDHUI';
  const terminee = ev.statut === 'TERMINEE';
  let cumul = 0;
  const donnees = s.tranches.map((t, i) => {
    cumul += t.arrivees;
    return { ...t, i, cumul };
  });
  const totalArrivees = cumul;
  // présences enregistrées hors du jour de la cérémonie (ex. validation manuelle le lendemain) : hors des tranches
  const horsJour = totalArrivees === 0 && s.presents > 0;
  const contient = (d, minutes) => enMinutes(d.debut) <= minutes && minutes < enMinutes(d.debut) + 15;
  const lancement = donnees.find((d) => contient(d, enMinutes(s.heureDebut)));
  // tranche en cours : fournie par le serveur (heure du serveur, pas celle de l'appareil)
  const enCours = s.trancheEnCours != null ? donnees[s.trancheEnCours] : null;
  const accueil = heureTexte(ev.heureAccueil);

  const resume = [
    { label: 'Arrivées', valeur: nombre(totalArrivees) },
    s.pic && { label: 'Pic', valeur: `${s.pic.debut} – ${s.pic.fin}`, detail: `${nombre(s.pic.arrivees)} arrivées` },
    jourJ && { label: '15 dernières minutes', valeur: `+${nombre(s.presents15min)}` },
  ].filter(Boolean);

  return (
    <Carte as="section" className="flex min-w-0 flex-col gap-4 px-6 py-5" aria-labelledby="t-arrivees">
      <div className="flex flex-col gap-1">
        <h2 id="t-arrivees" className="m-0 text-[17px] font-semibold">
          Arrivées à l’accueil
        </h2>
        <p className="m-0 text-[14px] text-texte-2">
          Nombre d’invités émargés par tranche de 15 minutes · accueil dès {accueil}, lancement à{' '}
          {heureTexte(ev.heureDebut)}.
        </p>
      </div>

      {totalArrivees === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-moyen border border-dashed border-bordure bg-fond px-6 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-moyen bg-ps text-[24px] text-p">
            <Icon nom="clock" />
          </span>
          <p className="m-0 text-[16px] font-semibold">
            {horsJour
              ? 'Aucune arrivée le jour de la cérémonie'
              : terminee
                ? 'Aucune arrivée enregistrée'
                : 'Aucune arrivée pour le moment'}
          </p>
          <p className="m-0 max-w-[460px] text-[14px] leading-[1.5] text-texte-2">
            {horsJour
              ? `${nombre(s.presents)} ${s.presents > 1 ? 'présences ont été enregistrées' : 'présence a été enregistrée'} un autre jour que celui de la cérémonie : ${s.presents > 1 ? 'elles sont comptées' : 'elle est comptée'} dans les présents, pas dans ce graphique.`
              : terminee
                ? 'Aucun invité n’a été émargé pour cette cérémonie.'
                : jourJ
                  ? `Chaque invité scanné à l’accueil apparaît ici en direct, dans sa tranche de 15 minutes. L’accueil ouvre à ${accueil}.`
                  : `Le graphique se remplira en direct le ${dateLongue(ev.date, false)}, à chaque invité scanné à l’accueil (dès ${accueil}).`}
          </p>
        </div>
      ) : (
        <>
          <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2">
            {resume.map((r) => (
              <div key={r.label} className="flex flex-col">
                <dt className="text-[13px] text-texte-2">{r.label}</dt>
                <dd className="m-0 text-[18px] font-bold tabular-nums">
                  {r.valeur}
                  {r.detail && <span className="ml-1.5 text-[14px] font-medium text-texte-2">{r.detail}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <div
            className="h-[240px]"
            role="img"
            aria-label={`Arrivées par tranche de 15 minutes : ${donnees
              .filter((d) => d.arrivees)
              .map((d) => `${d.debut} – ${d.fin} : ${d.arrivees}`)
              .join(', ')}. Total : ${totalArrivees}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={donnees} margin={{ top: 26, right: 8, left: -8, bottom: 0 }} barCategoryGap="16%">
                <CartesianGrid vertical={false} stroke="var(--bordure-ligne)" />
                {enCours && (
                  <ReferenceArea
                    x1={enCours.debut}
                    x2={enCours.debut}
                    fill="var(--ps)"
                    fillOpacity={1}
                    ifOverflow="extendDomain"
                    label={{ value: 'En cours', position: 'insideTop', fontSize: 12, fill: 'var(--texte-2)' }}
                  />
                )}
                <XAxis
                  dataKey="debut"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--bordure)' }}
                  interval="preserveStartEnd"
                  minTickGap={14}
                  tick={{ fontSize: 12, fill: 'var(--texte-2)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={[0, (m) => Math.max(4, Math.ceil(m * 1.15))]}
                  tick={{ fontSize: 12, fill: 'var(--texte-2)' }}
                />
                {lancement && (
                  <ReferenceLine
                    x={lancement.debut}
                    position="start"
                    stroke="var(--texte-2)"
                    strokeDasharray="4 3"
                    label={{
                      value: `Lancement ${heureTexte(ev.heureDebut)}`,
                      position: 'top',
                      fontSize: 12,
                      fill: 'var(--texte-2)',
                    }}
                  />
                )}
                <Tooltip cursor={{ fill: 'var(--fond)' }} content={<InfobulleArrivees />} />
                <Bar dataKey="arrivees" fill="var(--p)" radius={[5, 5, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                  <LabelList
                    dataKey="arrivees"
                    position="top"
                    formatter={(v) => (v ? v : '')}
                    style={{ fontSize: 12, fontWeight: 600, fill: 'var(--texte)' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-texte-2" aria-hidden="true">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-p" />
              Invités émargés dans la tranche
            </span>
            {lancement && (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-0 border-l-2 border-dashed border-texte-2" />
                Lancement de la cérémonie
              </span>
            )}
            {enCours && (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-ps" />
                Tranche en cours
              </span>
            )}
          </div>
        </>
      )}
    </Carte>
  );
}

/** Lien public d'inscription, à partager (le QR code d'affichage reste côté super admin). */
function LienInscription({ ev }) {
  const toast = useToast();
  const [copie, setCopie] = useState(false);
  useEffect(() => {
    if (!copie) return undefined;
    const t = setTimeout(() => setCopie(false), 2500);
    return () => clearTimeout(t);
  }, [copie]);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(ev.lienInscription);
      setCopie(true);
      toast('Lien d’inscription copié.');
    } catch {
      toast('Copie impossible : sélectionnez le lien et copiez-le manuellement.', 'erreur');
    }
  };
  return (
    <Carte as="section" className="flex flex-col gap-3 px-6 py-5" aria-labelledby="t-lien">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="t-lien" className="m-0 text-[17px] font-semibold">
          Lien d’inscription
        </h2>
        <span className="text-[14px] text-texte-2">
          {ev.etatInscriptions === 'OUVERT' ? 'À partager avec les diplômés' : 'Inscriptions actuellement fermées'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={ev.lienInscription}
          aria-label="Lien d’inscription"
          onFocus={(e) => e.target.select()}
          className="h-11 min-w-0 flex-[1_1_260px] rounded-champ border border-champ bg-fond px-3 text-[15px] text-texte outline-none focus:ring-2 focus:ring-focus"
        />
        <button
          type="button"
          onClick={copier}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-bouton border border-champ bg-surface px-4 text-[15px] font-semibold text-texte hover:bg-fond"
        >
          <Icon nom={copie ? 'check' : 'copy'} className="text-[18px]" />
          {copie ? 'Copié' : 'Copier'}
        </button>
      </div>
    </Carte>
  );
}
