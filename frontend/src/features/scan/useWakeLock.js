import { useEffect } from 'react';

/** Écran maintenu allumé (Screen Wake Lock API), réacquis au retour sur l'onglet. */
export default function useWakeLock(actif = true) {
  useEffect(() => {
    if (!actif || !('wakeLock' in navigator)) return undefined;
    let verrou = null;
    let fini = false;
    const demander = async () => {
      try {
        verrou = await navigator.wakeLock.request('screen');
      } catch {
        /* refusé (batterie faible, onglet masqué) */
      }
    };
    const visibilite = () => document.visibilityState === 'visible' && !fini && demander();
    demander();
    document.addEventListener('visibilitychange', visibilite);
    return () => {
      fini = true;
      document.removeEventListener('visibilitychange', visibilite);
      verrou?.release?.();
    };
  }, [actif]);
}
