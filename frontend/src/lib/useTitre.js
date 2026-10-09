import { useEffect } from 'react';

/** Titre de l'onglet : « … · Flex’Checking ». */
export default function useTitre(titre) {
  useEffect(() => {
    document.title = titre ? `${titre} · Flex’Checking` : 'Flex’Checking';
  }, [titre]);
}
