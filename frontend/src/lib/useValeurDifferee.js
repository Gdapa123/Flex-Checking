import { useEffect, useState } from 'react';

/**
 * Valeur recopiée `delai` ms après son dernier changement (recherche à la frappe : une requête quand la saisie
 * s'arrête, pas une par lettre). Une valeur vide est recopiée tout de suite (effacement immédiat).
 */
export default function useValeurDifferee(valeur, delai = 300) {
  const [differee, setDifferee] = useState(valeur);
  useEffect(() => {
    if (!valeur) {
      setDifferee(valeur);
      return undefined;
    }
    const t = setTimeout(() => setDifferee(valeur), delai);
    return () => clearTimeout(t);
  }, [valeur, delai]);
  return valeur ? differee : valeur;
}
