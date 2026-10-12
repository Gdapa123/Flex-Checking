import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import Icon from '../../components/ui/Icon';
import { messageErreur } from '../../lib/api';

/** Message d'une lecture en échec, adapté à la cause (réseau, saturation, autre). */
export function texteErreur(erreur) {
  if (erreur?.status === 503) return 'Service momentanément saturé. Réessayez dans une minute.';
  return messageErreur(erreur, 'Les données n’ont pas pu être chargées.');
}

/** Carte affichée à la place d'un contenu dont le chargement a échoué, avec un bouton « Réessayer ». */
export default function ErreurChargement({ erreur, onReessayer, titre = 'Chargement impossible', className = '' }) {
  return (
    <Carte mde role="alert" className={`flex flex-col items-start gap-3 p-6 ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-moyen bg-erreur-doux text-[20px] text-erreur">
          <Icon nom="alertCircle" />
        </span>
        <h2 className="m-0 text-[17px] font-semibold">{titre}</h2>
      </div>
      <p className="m-0 text-[15px] text-mde-texte-2">{texteErreur(erreur)}</p>
      {onReessayer && (
        <Bouton variante="mde-secondaire" icone="refresh" onClick={() => onReessayer()}>
          Réessayer
        </Bouton>
      )}
    </Carte>
  );
}

/** Bandeau discret : la dernière donnée reste affichée, mais son rafraîchissement a échoué. */
export function BandeauErreur({ erreur, onReessayer }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-moyen border border-erreur-bord bg-erreur-doux px-4 py-2.5 text-[14px] text-erreur"
    >
      <Icon nom="alertCircle" className="text-[18px]" />
      <span className="flex-1">{texteErreur(erreur)}</span>
      {onReessayer && (
        <button
          type="button"
          onClick={() => onReessayer()}
          className="min-h-11 cursor-pointer rounded-bouton border-0 bg-transparent px-2 font-semibold text-erreur underline underline-offset-[3px]"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
