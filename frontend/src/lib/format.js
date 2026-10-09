/** Formats français, fuseau Africa/Abidjan (UTC+0). */
const TZ = 'Africa/Abidjan';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_COURTS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 2026-11-14 » → Date à midi UTC (évite tout décalage de jour). */
export function dateIso(d) {
  if (d instanceof Date) return d;
  const [a, m, j] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12));
}

/** « Samedi 14 novembre 2026 » */
export function dateLongue(d, majuscule = true) {
  const x = dateIso(d);
  const s = `${JOURS[x.getUTCDay()]} ${x.getUTCDate()} ${MOIS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
  return majuscule ? s[0].toUpperCase() + s.slice(1) : s;
}

/** « Sam. 14 nov. 2026 » */
export function dateCourte(d) {
  const x = dateIso(d);
  return `${JOURS_COURTS[x.getUTCDay()]} ${x.getUTCDate()} ${MOIS_COURTS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

/** « Sam. 14.11 » (bandeau de l'en-tête invité) */
export function dateBandeau(d) {
  const x = dateIso(d);
  return `${JOURS_COURTS[x.getUTCDay()]} ${String(x.getUTCDate()).padStart(2, '0')}.${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** « 18:00 » ou « 18:00:00 » → « 18h00 » */
export function heureTexte(h) {
  if (!h) return '';
  const [hh, mm] = String(h).split(':');
  return `${Number(hh)}h${mm}`;
}

function parties(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  const f = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
}

/** ISO datetime → « 18h42 » (heure d'Abidjan) */
export function heure(iso) {
  if (!iso) return '';
  const p = parties(iso);
  return `${Number(p.hour)}h${p.minute}`;
}

/** ISO datetime → « 09/10/2026 » */
export function jour(iso) {
  if (!iso) return '';
  const p = parties(iso);
  return `${p.day}/${p.month}/${p.year}`;
}

/** ISO datetime → « 09/10/2026 19:04 » */
export function jourHeure(iso) {
  if (!iso) return '';
  const p = parties(iso);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export const nombre = (n) => new Intl.NumberFormat('fr-FR').format(n ?? 0);
export const pourcent = (n) => `${Math.round(n ?? 0)} %`;

export const MODES = {
  QR_CAMERA: 'QR caméra',
  DOUCHETTE: 'Douchette',
  CODE: 'Code 4 chiffres',
  MANUEL: 'Manuel',
};

export const STATUTS_EVENEMENT = {
  AUJOURDHUI: 'Aujourd’hui',
  INSCRIPTIONS_OUVERTES: 'Inscriptions ouvertes',
  INSCRIPTIONS_FERMEES: 'Inscriptions fermées',
  COMPLET: 'Complet',
  TERMINEE: 'Terminée',
};

/** Accord « Inscrit·e » / « Présent·e » (écriture inclusive, prompt). */
export const INSCRIT_E = 'Inscrit·e';

export function initiales(nom = '') {
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m[0] || '')
    .join('')
    .toUpperCase();
}

export function prenomSeul(nom = '') {
  return nom.split(/\s+/)[0] || nom;
}
