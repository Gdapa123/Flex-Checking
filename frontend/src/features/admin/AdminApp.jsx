import { Route, Routes } from 'react-router-dom';
import ChoixCeremonie from './ChoixCeremonie';
import EspaceEvenement from './EspaceEvenement';
import Introuvable from '../auth/Introuvable';

export default function AdminApp() {
  return (
    <Routes>
      <Route index element={<ChoixCeremonie />} />
      <Route path="evenements/:id/*" element={<EspaceEvenement />} />
      <Route path="*" element={<Introuvable />} />
    </Routes>
  );
}
