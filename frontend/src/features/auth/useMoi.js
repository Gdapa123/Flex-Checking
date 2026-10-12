import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const CLE_MOI = 'fc-moi';

/** Dernier compte connu sur cet appareil : permet au poste de scan de rester utilisable hors ligne. */
export function lireMoiMemorise() {
  try {
    return JSON.parse(localStorage.getItem(CLE_MOI) || 'null');
  } catch {
    return null;
  }
}

export function oublierMoi() {
  try {
    localStorage.removeItem(CLE_MOI);
    localStorage.removeItem('fc-evenements-scan');
  } catch {
    /* stockage indisponible */
  }
}

export function memoriser(moi) {
  try {
    if (moi) {
      const { id, nom, role, doitChangerMotDePasse } = moi;
      localStorage.setItem(CLE_MOI, JSON.stringify({ id, nom, role, doitChangerMotDePasse }));
    }
  } catch {
    /* stockage indisponible */
  }
}

export function useMoi() {
  return useQuery({
    queryKey: ['moi'],
    queryFn: async () => {
      try {
        const moi = await api.get('/auth/moi/');
        memoriser(moi);
        return moi;
      } catch (e) {
        if (e?.status === 401) oublierMoi();
        throw e;
      }
    },
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
      oublierMoi();
      qc.clear();
    }
  };
}
