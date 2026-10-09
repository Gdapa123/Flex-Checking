import { Route, Routes } from 'react-router-dom';
import ScanSetup from './ScanSetup';
import ScanPoste from './ScanPoste';

export default function ScanApp() {
  return (
    <Routes>
      <Route index element={<ScanSetup />} />
      <Route path=":id" element={<ScanPoste />} />
    </Routes>
  );
}
