import { Link } from 'react-router-dom';
import Icon from './Icon';

const VARIANTES = {
  mde: 'border-mde-champ text-mde-texte hover:bg-mde-survol hover:text-mde-texte',
  programme: 'border-champ text-texte hover:bg-fond hover:text-texte',
  danger: 'border-erreur-bord text-erreur hover:bg-erreur-doux hover:text-erreur',
};

/**
 * Action compacte d'une ligne de tableau : icône seule, libellé accessible et info-bulle identiques.
 * Lien interne si `to` est fourni, bouton sinon.
 */
export default function BoutonIcone({ icone, libelle, to, onClick, variante = 'mde', className = '' }) {
  const classes = `flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-bouton border bg-surface text-[18px] no-underline ${VARIANTES[variante]} ${className}`;
  if (to)
    return (
      <Link to={to} aria-label={libelle} title={libelle} className={classes}>
        <Icon nom={icone} />
      </Link>
    );
  return (
    <button type="button" onClick={onClick} aria-label={libelle} title={libelle} className={classes}>
      <Icon nom={icone} />
    </button>
  );
}
