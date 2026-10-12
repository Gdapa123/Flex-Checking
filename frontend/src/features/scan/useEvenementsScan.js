import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { lireMoiMemorise } from '../auth/useMoi';

const CLE = 'fc-evenements-scan';

/** Dernière liste chargée, pour le compte mémorisé : le poste de scan reste utilisable hors ligne. */
function lireListe() {
  try {
    const m = JSON.parse(localStorage.getItem(CLE) || 'null');
    return m && m.compte === lireMoiMemorise()?.id ? m.liste : undefined;
  } catch {
    return undefined;
  }
}

/** Événements de l'admin connecté, du jour et à venir (les plus proches d'abord). */
export function useEvenementsScan() {
  const qc = useQueryClient();
  const requete = useQuery({
    queryKey: ['evenements'],
    queryFn: () => api.get('/evenements/'),
    initialData: lireListe,
    initialDataUpdatedAt: 0, // toujours revérifiée auprès du serveur
    select: (liste) => {
      const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      return liste.filter((e) => e.date >= hier).sort((a, b) => a.date.localeCompare(b.date));
    },
    staleTime: 60_000,
  });
  // La clé ['evenements'] est partagée avec d'autres écrans : on mémorise la liste à chaque
  // réponse du serveur, quel que soit l'écran qui l'a chargée.
  const { dataUpdatedAt } = requete;
  useEffect(() => {
    if (!dataUpdatedAt) return;
    try {
      const liste = qc.getQueryData(['evenements']);
      if (liste) localStorage.setItem(CLE, JSON.stringify({ compte: lireMoiMemorise()?.id, liste }));
    } catch {
      /* stockage indisponible */
    }
  }, [dataUpdatedAt, qc]);
  return requete;
}
