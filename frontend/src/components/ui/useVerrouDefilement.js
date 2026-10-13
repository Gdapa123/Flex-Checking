import { useEffect } from 'react';

let verrous = 0;
let ancien = '';

/**
 * Bloque le défilement de la page tant qu'un dialogue ou un panneau modal est ouvert (la page derrière le voile ne
 * défile plus sous le doigt ou la molette). Compteur partagé : un dialogue ouvert par-dessus un panneau ne libère pas
 * le défilement en se fermant.
 */
export default function useVerrouDefilement(actif) {
  useEffect(() => {
    if (!actif) return undefined;
    if (verrous === 0) {
      ancien = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    verrous += 1;
    return () => {
      verrous -= 1;
      if (verrous === 0) document.body.style.overflow = ancien;
    };
  }, [actif]);
}
