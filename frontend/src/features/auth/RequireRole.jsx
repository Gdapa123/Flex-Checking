import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Spinner from '../../components/ui/Spinner';
import { useTempsReel } from '../../lib/tempsReel';
import { useMoi } from './useMoi';
import ChangerMotDePasse from './ChangerMotDePasse';

/** Garde de route : session valide et rôle autorisé, sinon redirection vers la connexion. */
export function RequireRole({ roles, connexion, children }) {
  const { data: moi, isLoading, isError } = useMoi();
  const location = useLocation();
  const qc = useQueryClient();
  // une connexion temps réel tant que l'espace protégé est affiché
  useTempsReel(Boolean(moi && roles.includes(moi.role) && !moi.doitChangerMotDePasse));
  useEffect(() => {
    const expiree = () => qc.setQueryData(['moi'], null);
    window.addEventListener('fc:session-expiree', expiree);
    return () => window.removeEventListener('fc:session-expiree', expiree);
  }, [qc]);
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center text-texte-2" role="status" aria-label="Chargement">
        <Spinner taille={28} />
      </div>
    );
  if (isError || !moi)
    return <Navigate to={connexion} replace state={{ depuis: location.pathname + location.search }} />;
  if (!roles.includes(moi.role)) return <Navigate to={moi.role === 'SUPER_ADMIN' ? '/super' : '/admin'} replace />;
  if (moi.doitChangerMotDePasse)
    return <ChangerMotDePasse univers={connexion.startsWith('/super') ? 'mde' : 'programme'} />;
  return children;
}
