/**
 * Liens « Ajouter à l'agenda » et « Itinéraire » d'un événement public.
 * Les horaires (UTC) et la description viennent de l'API (`ev.agenda`), comme le fichier .ics.
 */

/** Adresse lisible par les applications de cartes (« Hôtel · Cocody, Abidjan » → « Hôtel, Cocody, Abidjan »). */
export const adresse = (ev) => ev.lieu.replace(/\s*·\s*/g, ', ').trim();

/** « 2026-11-27T17:45:00Z » → « 20261127T174500Z » (format Google Agenda). */
const compact = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '');

/** iPhone ou iPad (iPadOS se présente comme un Mac tactile) : Calendrier et Plans y sont les applications par défaut. */
function appareilApple() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Place en tête l'option la plus probable pour l'appareil (Apple sur iPhone / Mac). */
function ordonner(options) {
  if (!appareilApple()) return options;
  return [...options.filter((o) => o.apple), ...options.filter((o) => !o.apple)];
}

/** Horaires de l'agenda : fournis par l'API ; à défaut (données en cache d'une version antérieure),
 * reconstruits depuis la date et les heures (Abidjan = UTC), avec la même règle que le serveur. */
function horaires(ev) {
  if (ev.agenda?.debut && ev.agenda?.fin) return ev.agenda;
  const [h, m] = ev.heureDebut.split(':').map(Number);
  const fin = new Date(Date.UTC(...ev.date.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)), h + 3, m));
  return {
    debut: `${ev.date}T${ev.heureAccueil}:00Z`,
    fin: fin.toISOString().replace('.000', ''),
    description: `Accueil dès ${ev.heureAccueil}. Présentez votre QR code à l’accueil.`,
  };
}

export function liensAgenda(ev) {
  const { debut, fin, description } = horaires(ev);
  const lieu = adresse(ev);
  const google = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.nomAffiche,
    dates: `${compact(debut)}/${compact(fin)}`,
    details: description,
    location: lieu,
  });
  const microsoft365 = `https://outlook.office.com/calendar/0/deeplink/compose?${new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.nomAffiche,
    startdt: debut,
    enddt: fin,
    location: lieu,
    body: description,
  })}`;
  return ordonner([
    {
      cle: 'google',
      nom: 'Google Agenda',
      detail: 'Android, Gmail',
      icone: 'calendarPlus',
      href: `https://calendar.google.com/calendar/render?${google}`,
    },
    {
      cle: 'office',
      nom: 'Microsoft 365',
      detail: 'Outlook professionnel',
      icone: 'briefcase',
      href: microsoft365,
    },
  ]);
}

export function liensItineraire(ev) {
  const destination = encodeURIComponent(adresse(ev));
  return ordonner([
    {
      cle: 'google',
      nom: 'Google Maps',
      detail: 'Itinéraire depuis votre position',
      icone: 'navigation',
      href: `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
    },
    {
      cle: 'apple',
      nom: 'Plans',
      detail: 'iPhone, iPad, Mac',
      icone: 'mapPin',
      href: `https://maps.apple.com/?daddr=${destination}`,
      apple: true,
    },
  ]);
}
