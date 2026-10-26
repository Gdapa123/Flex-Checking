import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from './features/auth/RequireRole';
import Spinner from './components/ui/Spinner';

const Inscription = lazy(() => import('./features/invite/InscriptionPage'));
const Confirmation = lazy(() => import('./features/invite/ConfirmationPage'));
const Pratique = lazy(() => import('./features/invite/PratiquePage'));
const Sondage = lazy(() => import('./features/invite/SondagePage'));
const Confidentialite = lazy(() => import('./features/invite/ConfidentialitePage'));
const ConnexionAdmin = lazy(() => import('./features/auth/ConnexionAdmin'));
const ConnexionSuper = lazy(() => import('./features/auth/ConnexionSuper'));
// espaces protégés : leur code (public, sans donnée) se télécharge pendant la vérification de la session
// (voir RequireRole `precharger`) plutôt qu'après, ce qui évite un aller-retour réseau à l'ouverture
const chargerAdmin = () => import('./features/admin/AdminApp');
const chargerSuper = () => import('./features/super/SuperApp');
const chargerScan = () => import('./features/scan/ScanApp');
const AdminApp = lazy(chargerAdmin);
const SuperApp = lazy(chargerSuper);
const ScanApp = lazy(chargerScan);
const Introuvable = lazy(() => import('./features/auth/Introuvable'));

function Chargement() {
  return (
    <div className="flex min-h-screen items-center justify-center text-texte-2" role="status" aria-label="Chargement">
      <Spinner taille={28} />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Chargement />}>
      <Routes>
        <Route path="/" element={<Navigate to="/connexion" replace />} />
        <Route path="/i/:slug" element={<Inscription />} />
        <Route path="/i/:slug/confirmation" element={<Confirmation />} />
        <Route path="/i/:slug/pratique" element={<Pratique />} />
        <Route path="/sondage/:jeton" element={<Sondage />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        <Route path="/connexion" element={<ConnexionAdmin />} />
        <Route path="/super/connexion" element={<ConnexionSuper />} />
        <Route
          path="/admin/*"
          element={
            <RequireRole roles={['ADMIN', 'SUPER_ADMIN']} connexion="/connexion" precharger={chargerAdmin}>
              <AdminApp />
            </RequireRole>
          }
        />
        <Route
          path="/scan/*"
          element={
            <RequireRole roles={['ADMIN', 'SUPER_ADMIN']} connexion="/connexion" precharger={chargerScan}>
              <ScanApp />
            </RequireRole>
          }
        />
        <Route
          path="/super/*"
          element={
            <RequireRole roles={['SUPER_ADMIN']} connexion="/super/connexion" precharger={chargerSuper}>
              <SuperApp />
            </RequireRole>
          }
        />
        <Route path="*" element={<Introuvable />} />
      </Routes>
    </Suspense>
  );
}
