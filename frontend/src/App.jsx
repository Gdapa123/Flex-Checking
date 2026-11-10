import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from './features/auth/RequireRole';
import Spinner from './components/ui/Spinner';
import { pageDifferee } from './lib/nouvelleVersion';

const Inscription = pageDifferee(() => import('./features/invite/InscriptionPage'));
const Confirmation = pageDifferee(() => import('./features/invite/ConfirmationPage'));
const Pratique = pageDifferee(() => import('./features/invite/PratiquePage'));
const Sondage = pageDifferee(() => import('./features/invite/SondagePage'));
const Confidentialite = pageDifferee(() => import('./features/invite/ConfidentialitePage'));
const ConnexionAdmin = pageDifferee(() => import('./features/auth/ConnexionAdmin'));
const ConnexionSuper = pageDifferee(() => import('./features/auth/ConnexionSuper'));
// espaces protégés : leur code (public, sans donnée) se télécharge pendant la vérification de la session
// (voir RequireRole `precharger`) plutôt qu'après, ce qui évite un aller-retour réseau à l'ouverture
const chargerAdmin = () => import('./features/admin/AdminApp');
const chargerSuper = () => import('./features/super/SuperApp');
const chargerScan = () => import('./features/scan/ScanApp');
const AdminApp = pageDifferee(chargerAdmin);
const SuperApp = pageDifferee(chargerSuper);
const ScanApp = pageDifferee(chargerScan);
const Introuvable = pageDifferee(() => import('./features/auth/Introuvable'));

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
