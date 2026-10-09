import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from './features/auth/RequireRole';
import Spinner from './components/ui/Spinner';

const Inscription = lazy(() => import('./features/invite/InscriptionPage'));
const Confirmation = lazy(() => import('./features/invite/ConfirmationPage'));
const ConnexionAdmin = lazy(() => import('./features/auth/ConnexionAdmin'));
const ConnexionSuper = lazy(() => import('./features/auth/ConnexionSuper'));
const AdminApp = lazy(() => import('./features/admin/AdminApp'));
const SuperApp = lazy(() => import('./features/super/SuperApp'));
const ScanApp = lazy(() => import('./features/scan/ScanApp'));
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
        <Route path="/connexion" element={<ConnexionAdmin />} />
        <Route path="/super/connexion" element={<ConnexionSuper />} />
        <Route
          path="/admin/*"
          element={
            <RequireRole roles={['ADMIN', 'SUPER_ADMIN']} connexion="/connexion">
              <AdminApp />
            </RequireRole>
          }
        />
        <Route
          path="/scan/*"
          element={
            <RequireRole roles={['ADMIN', 'SUPER_ADMIN']} connexion="/connexion">
              <ScanApp />
            </RequireRole>
          }
        />
        <Route
          path="/super/*"
          element={
            <RequireRole roles={['SUPER_ADMIN']} connexion="/super/connexion">
              <SuperApp />
            </RequireRole>
          }
        />
        <Route path="*" element={<Introuvable />} />
      </Routes>
    </Suspense>
  );
}
