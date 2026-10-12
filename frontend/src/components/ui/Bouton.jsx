import { forwardRef } from 'react';
import Icon from './Icon';
import Spinner from './Spinner';

const VARIANTES = {
  principal: 'btn-principal border-0',
  secondaire: 'border border-champ bg-surface text-texte hover:bg-fond',
  lien: 'border-0 bg-transparent text-texte underline underline-offset-[3px]',
  destructif: 'border-0 bg-erreur text-blanc',
  'destructif-doux': 'border border-erreur-bord bg-surface text-erreur hover:bg-erreur-doux',
  fantome: 'border-0 bg-transparent text-texte hover:bg-fond',
  // univers MDE
  mde: 'border-0 bg-mde-bordeaux text-blanc hover:bg-mde-bordeaux-survol',
  'mde-secondaire': 'border border-mde-champ bg-surface text-mde-texte hover:bg-mde-survol',
  'mde-jaune': 'border-0 bg-mde-jaune text-mde-texte hover:bg-mde-jaune-clair shadow-blanc',
  // graphite (scan)
  graphite: 'border border-g-bordure bg-g-surface text-g-texte active:bg-g-eleve',
  'graphite-transparent': 'border border-g-bordure bg-transparent text-g-texte active:bg-g-eleve',
};

const TAILLES = {
  xs: 'h-9 px-3 text-[13px] rounded-bouton',
  sm: 'h-10 px-3.5 text-[14px] rounded-bouton',
  md: 'h-11 px-4 text-[15px] rounded-bouton',
  lg: 'h-12 px-[18px] text-[15px] rounded-bouton',
  xl: 'h-[52px] px-6 text-[16px] rounded-bouton',
};

const Bouton = forwardRef(function Bouton(
  {
    variante = 'principal',
    taille = 'md',
    icone,
    iconeDroite,
    chargement = false,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={chargement || undefined}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background,transform,opacity] duration-150 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${TAILLES[taille]} ${className}`}
      {...rest}
    >
      {chargement ? <Spinner taille={16} /> : icone ? <Icon nom={icone} className="text-[18px]" /> : null}
      {children}
      {iconeDroite && <Icon nom={iconeDroite} className="text-[18px]" />}
    </button>
  );
});

export default Bouton;
