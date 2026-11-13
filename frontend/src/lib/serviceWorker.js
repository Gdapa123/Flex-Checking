/**
 * Enregistrement du service worker (PWA du scan). Remplace le `registerSW.js` de vite-plugin-pwa, qui ne gérait pas
 * l'échec : Safari refuse l'enregistrement en navigation privée ou en mode Isolement (« SecurityError · Script
 * https://inscription.mde.ci/sw.js load failed », iPhone, 2026-11-12) et le refus remontait comme erreur technique.
 * Sans service worker le site fonctionne normalement (seul le mode hors ligne manque) : l'échec est ignoré.
 */
export function enregistrerServiceWorker(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  if (!nav?.serviceWorker) return;
  window.addEventListener('load', () => {
    try {
      nav.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    } catch {
      // certains navigateurs lèvent l'exception de façon synchrone
    }
  });
}
