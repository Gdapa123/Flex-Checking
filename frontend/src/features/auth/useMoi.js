import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function useMoi() {
  return useQuery({
    queryKey: ['moi'],
    queryFn: () => api.get('/auth/moi/'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useDeconnexion() {
  const qc = useQueryClient();
  return async () => {
    try {
      await api.post('/auth/deconnexion/');
    } finally {
      qc.clear();
    }
  };
}
