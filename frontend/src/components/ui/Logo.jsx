import logoSvg from '../../assets/logo.svg?raw';

/** Rapport largeur / hauteur du logo horizontal (pictogramme + « Flex’Checking »). */
export const RATIO_LOGO = 3.3277;

// SVG vectoriel (texte converti en tracés) : la couleur suit `currentColor`.
const balisage = logoSvg
  .replace('<svg ', '<svg aria-hidden="true" focusable="false" width="100%" height="100%" ')
  .replace(/<title>.*?<\/title>/, '');

/** Logo Flex’Checking (monogramme MDE). Rouge sur fond clair, blanc sur dégradés et graphite. */
export default function Logo({ variante = 'rouge', hauteur = 38, className = '' }) {
  return (
    <span
      role="img"
      aria-label="Flex’Checking · MDE Business School"
      className={`block flex-none self-start ${variante === 'blanc' ? 'text-blanc' : 'text-logo'} ${className}`}
      style={{ height: hauteur, width: Math.round(hauteur * RATIO_LOGO) }}
      // SVG statique fourni avec l'application (aucune donnée utilisateur)
      dangerouslySetInnerHTML={{ __html: balisage }}
    />
  );
}
