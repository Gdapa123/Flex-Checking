import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filtres, recherche, tri et page synchronisés avec l'URL (partageables, conservés au rechargement).
 * `defauts` : valeurs par défaut (non écrites dans l'URL).
 */
export default function useUrlState(defauts) {
  const [params, setParams] = useSearchParams();
  const valeurs = useMemo(() => {
    const v = { ...defauts };
    for (const k of Object.keys(defauts)) if (params.has(k)) v[k] = params.get(k);
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const maj = useCallback(
    (changements, { remplacer = false } = {}) => {
      setParams(
        (actuels) => {
          const n = new URLSearchParams(actuels);
          for (const [k, val] of Object.entries(changements)) {
            if (val === undefined || val === null || val === '' || String(val) === String(defauts[k] ?? ''))
              n.delete(k);
            else n.set(k, val);
          }
          return n;
        },
        { replace: remplacer },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );
  return [valeurs, maj];
}
