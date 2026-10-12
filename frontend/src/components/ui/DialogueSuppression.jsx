import { useEffect, useId, useState } from 'react';
import Bouton from './Bouton';
import Dialogue from './Dialogue';

/**
 * Confirmation d'une suppression définitive. Si `nomAConfirmer` est fourni (élément qui contient des données :
 * cérémonie avec invités, programme avec cérémonies), il faut le retaper pour activer le bouton.
 */
export default function DialogueSuppression({
  ouvert,
  titre,
  children,
  nomAConfirmer,
  onConfirmer,
  onFermer,
  univers = 'mde',
  libelle = 'Supprimer définitivement',
}) {
  const id = useId();
  const [saisie, setSaisie] = useState('');
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    if (ouvert) setSaisie('');
  }, [ouvert]);
  const confirme = !nomAConfirmer || saisie.trim().toLowerCase() === nomAConfirmer.trim().toLowerCase();
  const valider = async () => {
    if (!confirme || envoi) return;
    setEnvoi(true);
    try {
      await onConfirmer(saisie.trim());
    } finally {
      setEnvoi(false);
    }
  };
  const mde = univers === 'mde';
  return (
    <Dialogue
      ouvert={ouvert}
      titre={titre}
      tonalite="erreur"
      icone="trash"
      univers={univers}
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante={mde ? 'mde-secondaire' : 'secondaire'} onClick={onFermer} data-autofocus={!nomAConfirmer}>
            Annuler
          </Bouton>
          <Bouton variante="destructif" icone="trash" disabled={!confirme} chargement={envoi} onClick={valider}>
            {libelle}
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>{children}</div>
        {nomAConfirmer && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              valider();
            }}
            className="flex flex-col gap-1.5"
          >
            <label htmlFor={`${id}-confirmation`} className="text-[14px] font-medium">
              Pour confirmer, saisissez <strong className="font-semibold">{nomAConfirmer}</strong>
            </label>
            <input
              id={`${id}-confirmation`}
              data-autofocus
              autoComplete="off"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              className={`h-11 rounded-champ border bg-surface px-3 text-[15px] outline-none focus:ring-2 ${mde ? 'border-mde-champ text-mde-texte focus:ring-mde-focus' : 'border-champ text-texte focus:ring-focus'}`}
            />
          </form>
        )}
      </div>
    </Dialogue>
  );
}
