import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

/** Événements de l'admin connecté, du jour et à venir (les plus proches d'abord). */
export function useEvenementsScan() {
  return useQuery({
    queryKey: ['evenements'],
    queryFn: () => api.get('/evenements/'),
    select: (liste) => {
      const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      return liste.filter((e) => e.date >= hier).sort((a, b) => a.date.localeCompare(b.date));
    },
    staleTime: 60_000,
  });
}
