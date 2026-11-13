/**
 * Signalement des erreurs techniques du navigateur au serveur (consultées par le super admin dans
 * « Erreurs techniques »). Les interfaces n'affichent jamais le détail technique.
 */

const MAX_PAR_PAGE = 20;
const deja = new Set();
let envoyes = 0;

/** Chemin de la page sans paramètres ni ancre (ils peuvent contenir une recherche ou un email), et sans jeton
 * personnel (lien du sondage, à usage unique) : `/sondage/<jeton>` devient `/sondage/:jeton`. */
export const normaliserLieu = (chemin) => chemin.replace(/^\/sondage\/[^/]+/, '/sondage/:jeton');
const lieuCourant = () => (typeof window === 'undefined' ? '' : normaliserLieu(window.location.pathname));

/** Robots d'exploration (Google, Bing…) : ils ouvrent d'anciennes versions des pages, leurs erreurs ne concernent
 * aucun visiteur (« Failed to fetch dynamically imported module » de GoogleOther, 2026-11-10). */
export const estRobot = (agent) =>
  /bot\b|crawler|spider|GoogleOther|Google-InspectionTool|Lighthouse/i.test(agent || '');

/** Échec de téléchargement d'une page chargée à la demande (connexion coupée, fichier d'une ancienne version). */
export const estEchecChargement = (erreur) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload/i.test(
    String(erreur?.message ?? erreur ?? ''),
  );

export function signalerErreur(erreur, complement = '') {
  try {
    if (typeof navigator !== 'undefined' && estRobot(navigator.userAgent)) return;
    const type = erreur?.name || (typeof erreur === 'string' ? 'Erreur' : erreur?.constructor?.name) || 'Erreur';
    const message = String(erreur?.message ?? erreur ?? '').slice(0, 1000);
    const cle = `${type}|${message}|${lieuCourant()}`;
    if (deja.has(cle) || envoyes >= MAX_PAR_PAGE) return;
    deja.add(cle);
    envoyes += 1;
    const details = `${erreur?.stack || ''}${complement ? `\n\nComposants :${complement}` : ''}`.slice(0, 8000);
    fetch('/api/erreurs/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, lieu: lieuCourant(), details }),
      credentials: 'omit',
      keepalive: true,
    }).catch(() => {});
  } catch {
    // le signalement ne doit jamais provoquer d'erreur lui-même
  }
}

/** Scripts de l'application : bundle Vite en production (`/assets/`), modules servis par Vite en développement. */
const scriptApplication = (url) => {
  const origine = window.location.origin;
  return ['/assets/', '/src/', '/node_modules/', '/@vite/', '/@react-refresh'].some((d) => url.startsWith(origine + d));
};
const URL_RE =
  /\b(?:https?|chrome-extension|moz-extension|safari-extension|safari-web-extension|webkit-masked-url):\/\/[^\s)'"]+/g;

/**
 * Vrai sauf preuve qu'une erreur vient d'ailleurs que de l'application : fichier ou trace pointant uniquement vers
 * des scripts étrangers (extension du navigateur, script injecté par le navigateur intégré d'une application comme
 * Instagram ou Facebook, y compris un script en ligne attribué à l'URL de la page). Sans information (pas de trace,
 * rejet d'une chaîne, échec de chargement d'un fichier de l'application), l'erreur est signalée.
 */
export function vientDeLApplication(erreur, fichier = '') {
  if (fichier) return scriptApplication(fichier);
  const urls = typeof erreur?.stack === 'string' ? erreur.stack.match(URL_RE) || [] : [];
  return urls.length === 0 || urls.some(scriptApplication);
}

/** Capture les erreurs JavaScript non gérées de toute l'application. */
export function installerSignalement() {
  window.addEventListener('error', (e) => {
    // erreurs de chargement de ressource (image, script) : pas d'objet Error, peu exploitables
    if (!e.error && !e.message) return;
    if (/ResizeObserver loop/.test(e.message || '')) return; // avertissement bénin des navigateurs
    // « Script error. » : erreur d'un script d'une autre origine (injecté par le navigateur, ex. PHX sur Android),
    // masquée par le navigateur, sans objet Error ni fichier : rien d'exploitable, pas notre code
    if (!e.error && !e.filename && /^Script error\.?$/i.test(e.message || '')) return;
    if (!vientDeLApplication(e.error, e.filename)) return;
    signalerErreur(e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const raison = e.reason;
    // erreurs d'API déjà traitées par l'interface (4xx) ou enregistrées par le serveur (5xx)
    if (raison?.name === 'AbortError' || typeof raison?.status === 'number') return;
    if (!vientDeLApplication(raison)) return;
    signalerErreur(raison);
  });
}
