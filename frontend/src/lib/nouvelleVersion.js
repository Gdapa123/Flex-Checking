import { lazy } from 'react';

/**
 * Onglet ouvert avant une mise à jour du site : les fichiers de l'ancienne version (`/assets/<nom>-<empreinte>.js`)
 * n'existent plus, l'ouverture d'une page chargée à la demande (confirmation, espace admin…) échoue. Vite signale
 * cet échec (`vite:preloadError`) : la page est rechargée une fois pour prendre la nouvelle version, au lieu
 * d'afficher une erreur. Une seconde fois en moins d'une minute : l'erreur suit son cours (vraie panne, signalée).
 */

const CLE = 'fc-rechargement-version';
const DELAI_MS = 60_000;

export function rechargerSiNouvelleVersion(evenement, { stockage, recharger, maintenant = Date.now() } = {}) {
  try {
    const dernier = Number(stockage.getItem(CLE)) || 0;
    if (maintenant - dernier < DELAI_MS) return false;
    stockage.setItem(CLE, String(maintenant));
  } catch {
    return false; // stockage indisponible (navigation privée stricte) : pas de rechargement, pas de boucle possible
  }
  evenement.preventDefault();
  recharger();
  return true;
}

export function installerRechargementVersion() {
  window.addEventListener('vite:preloadError', (evenement) =>
    rechargerSiNouvelleVersion(evenement, {
      stockage: window.sessionStorage,
      recharger: () => window.location.reload(),
    }),
  );
}

/**
 * `React.lazy` compatible avec ce rechargement : quand Vite a annulé l'erreur (`preventDefault`), l'import se résout
 * sans module ; la page reste alors sur l'écran de chargement jusqu'au rechargement, au lieu de lever
 * « undefined is not an object (evaluating 'a._result.default') » (erreur signalée sur iPhone le 2026-11-10).
 */
export const pageDifferee = (importer) => lazy(() => importer().then((module) => module ?? new Promise(() => {})));
