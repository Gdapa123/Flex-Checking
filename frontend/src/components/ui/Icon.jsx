import { ICONES } from './icones';

/** Icône SVG (1em, couleur courante). Décorative par défaut ; passer `label` si elle porte du sens. */
export default function Icon({ nom, className = '', label, style }) {
  const trace = ICONES[nom];
  if (!trace) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block flex-none ${className}`}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      // tracés statiques issus du design (aucune donnée utilisateur)
      dangerouslySetInnerHTML={{ __html: trace }}
    />
  );
}
