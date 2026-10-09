import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Spinner from '../../components/ui/Spinner';
import { useMoi } from './useMoi';
import ChangerMotDePasse from './ChangerMotDePasse';

/** Garde de route : session valide et rôle autorisé, sinon redirection vers la connexion. */
export function RequireRole({ roles, connexion, children }) {
  const { data: moi, isLoading, isError } = useMoi();
  const location = useLocation();
  const qc = useQueryClient();
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
