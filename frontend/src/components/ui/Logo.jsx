import rouge from '../../assets/logo-rouge.png';
import blanc from '../../assets/logo-blanc.png';

/** Logo Flex’Checking (monogramme MDE). Version blanche sur dégradés et graphite. */
export default function Logo({ variante = 'rouge', hauteur = 38, className = '' }) {
  return (
    <img
      src={variante === 'blanc' ? blanc : rouge}
      alt="Flex’Checking · MDE Business School"
      height={hauteur}
      width={Math.round((hauteur * 794) / 240)}
      className={`block flex-none self-start object-contain ${className}`}
      style={{ height: hauteur, width: Math.round((hauteur * 794) / 240) }}
    />
  );
}
