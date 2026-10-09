import GestionInvites from '../invites/GestionInvites';
import { PageSuper } from './SuperApp';
import { useEvenements, useProgrammes } from './donnees';

/** SA9 · Tous les invités, filtres événement et programme. */
export default function TousInvites() {
  const { data: evenements = [] } = useEvenements();
  const { data: programmes = [] } = useProgrammes();
  return (
    <PageSuper titre="Tous les invités">
      <GestionInvites univers="mde" evenements={evenements} programmes={programmes} />
    </PageSuper>
  );
}
