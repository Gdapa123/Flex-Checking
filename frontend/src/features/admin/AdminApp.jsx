import { Route, Routes } from 'react-router-dom';
import ChoixCeremonie from './ChoixCeremonie';
import EspaceEvenement from './EspaceEvenement';

export default function AdminApp() {
  return (
    <Routes>
      <Route index element={<ChoixCeremonie />} />
      <Route path="evenements/:id/*" element={<EspaceEvenement />} />
    </Routes>
  );
}
