/**
 * Signalement des erreurs techniques du navigateur au serveur (consultées par le super admin dans
 * « Erreurs techniques »). Les interfaces n'affichent jamais le détail technique.
 */

const MAX_PAR_PAGE = 20;
const deja = new Set();
let envoyes = 0;

/** Chemin de la page sans paramètres ni ancre (ils peuvent contenir une recherche ou un email). */
const lieuCourant = () => (typeof window === 'undefined' ? '' : window.location.pathname);

export function signalerErreur(erreur, complement = '') {
  try {
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

/** Capture les erreurs JavaScript non gérées de toute l'application. */
export function installerSignalement() {
  window.addEventListener('error', (e) => {
    // erreurs de chargement de ressource (image, script) : pas d'objet Error, peu exploitables
    if (!e.error && !e.message) return;
    if (/ResizeObserver loop/.test(e.message || '')) return; // avertissement bénin des navigateurs
    signalerErreur(e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const raison = e.reason;
    // erreurs d'API déjà traitées par l'interface (4xx) ou enregistrées par le serveur (5xx)
    if (raison?.name === 'AbortError' || typeof raison?.status === 'number') return;
    signalerErreur(raison);
  });
}
