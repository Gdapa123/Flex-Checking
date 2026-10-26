import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Bouton from '../../components/ui/Bouton';
import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';
import Spinner from '../../components/ui/Spinner';
import { useTempsReel } from '../../lib/tempsReel';
import { lireMoiMemorise, oublierMoi, useMoi } from './useMoi';
import ChangerMotDePasse from './ChangerMotDePasse';

/**
 * Garde de route : session valide et rôle autorisé, sinon redirection vers la connexion.
 * Seul un 401 déconnecte : une panne réseau ou serveur garde l'utilisateur dans son espace
 * (le poste de scan continue avec le dernier compte connu, pour émarger hors ligne).
 */
export function RequireRole({ roles, connexion, precharger, children }) {
  const { data, isLoading, error, refetch, isFetching } = useMoi();
  useEffect(() => {
    // en parallèle de /auth/moi ; un échec est ignoré (le chargement normal réessaiera et affichera l'erreur)
    precharger?.().catch(() => {});
  }, [precharger]);
  const location = useLocation();
  const qc = useQueryClient();
  const nonConnecte = error?.status === 401;
  const scan = location.pathname.startsWith('/scan');
  const moi = data || (error && !nonConnecte && scan ? lireMoiMemorise() : null);
  // une connexion temps réel tant que l'espace protégé est affiché
  useTempsReel(Boolean(data && roles.includes(data.role) && !data.doitChangerMotDePasse));
  useEffect(() => {
    // session expirée : on oublie aussi les données du compte précédent (un autre compte peut se connecter)
    const expiree = () => {
      oublierMoi();
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'moi' });
      qc.setQueryData(['moi'], null);
    };
    window.addEventListener('fc:session-expiree', expiree);
    return () => window.removeEventListener('fc:session-expiree', expiree);
  }, [qc]);
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center text-texte-2" role="status" aria-label="Chargement">
        <Spinner taille={28} />
      </div>
    );
  if (error && !nonConnecte && !moi) return <ServeurInjoignable onReessayer={() => refetch()} enCours={isFetching} />;
  if (nonConnecte || !moi)
    return <Navigate to={connexion} replace state={{ depuis: location.pathname + location.search }} />;
  if (!roles.includes(moi.role)) return <Navigate to={moi.role === 'SUPER_ADMIN' ? '/super' : '/admin'} replace />;
  // borne libre-service : la session restreinte n'ouvre que l'espace scan (le serveur refuse le reste)
  if (moi.borne && !scan) return <Navigate to="/scan" replace />;
  if (moi.doitChangerMotDePasse)
    return <ChangerMotDePasse univers={connexion.startsWith('/super') ? 'mde' : 'programme'} />;
  return children;
}

function ServeurInjoignable({ onReessayer, enCours }) {
  return (
    <main className="flex min-h-screen items-center justify-center border-t-[6px] border-texte px-4 py-10">
      <div
        role="alert"
        className="flex w-full max-w-[420px] animate-in-up flex-col gap-4 rounded-carte border border-bordure-carte bg-surface p-6 shadow-carte sm:p-8"
      >
        <Logo hauteur={36} />
        <Icon nom="wifiOff" className="text-[28px] text-texte-2" />
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Connexion au serveur impossible</h1>
          <p className="m-0 text-[15px] leading-[1.5] text-texte-2">
            Vérifiez le réseau. Si le service est momentanément saturé, réessayez dans une minute : votre session est
            conservée.
          </p>
        </div>
        <Bouton taille="lg" icone="refresh" chargement={enCours} onClick={onReessayer}>
          Réessayer
        </Bouton>
      </div>
    </main>
  );
}
