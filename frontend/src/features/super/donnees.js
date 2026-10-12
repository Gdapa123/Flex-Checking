import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useSecours } from '../../lib/tempsReel';

export const useProgrammes = () => useQuery({ queryKey: ['programmes'], queryFn: () => api.get('/programmes/') });
export function useEvenements() {
  const secours = useSecours(15000);
  return useQuery({
    queryKey: ['evenements'],
    queryFn: () => api.get('/evenements/'),
    // en échec, nouvel essai toutes les 30 s même si le temps réel est connecté (il ne relance rien)
    refetchInterval: (q) => (q.state.error ? 30_000 : secours),
  });
}
export const useAdmins = () => useQuery({ queryKey: ['admins'], queryFn: () => api.get('/admins/') });

export const BADGE_STATUT = {
  AUJOURDHUI: ['En cours', 'bg-succes-doux text-succes', 'bg-succes'],
  INSCRIPTIONS_OUVERTES: ['Inscriptions ouvertes', 'bg-mde-bordure-ligne text-mde-texte', 'bg-mde-texte'],
  INSCRIPTIONS_FERMEES: ['Inscriptions fermées', 'bg-mde-bordure-ligne text-mde-texte-2', 'bg-mde-texte-2'],
  COMPLET: ['Complet', 'bg-avert-doux text-avert', 'bg-avert'],
  TERMINEE: ['Terminée', 'bg-mde-bordure-ligne text-mde-texte-2', 'bg-mde-texte-2'],
};

export const CHAMP_MDE = 'h-12 rounded-moyen border border-mde-champ bg-surface px-3.5 text-[16px] text-mde-texte';
