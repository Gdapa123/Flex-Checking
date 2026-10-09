import Icon from './Icon';

const STYLES = {
  INSCRIT: { cls: 'bg-subtil text-texte', point: 'bg-texte-2' },
  PRESENT: { cls: 'bg-succes-doux text-succes', icone: 'check' },
  DEJA: { cls: 'bg-avert-doux text-avert', icone: 'alert' },
  INVALIDE: { cls: 'bg-erreur-doux text-erreur', icone: 'xCircle' },
  ATTENTE: { cls: 'bg-avert-fond text-avert', icone: 'clock' },
  NEUTRE: { cls: 'bg-subtil text-texte', point: 'bg-texte-2' },
  SUCCES: { cls: 'bg-succes-doux text-succes', point: 'bg-succes' },
  MDE: { cls: 'bg-mde-bordure-ligne text-mde-texte', point: 'bg-mde-texte' },
  MDE_OFF: { cls: 'bg-mde-bordure-ligne text-mde-texte-2', point: 'bg-mde-texte-2' },
};

/** Badge de statut : toujours icône (ou pastille) + libellé. */
export default function Badge({ type = 'NEUTRE', children, taille = 'md', className = '' }) {
  const s = STYLES[type] || STYLES.NEUTRE;
  const t = taille === 'sm' ? 'h-6 px-2 text-[12px] gap-[5px]' : 'h-7 px-2.5 text-[13px] gap-1.5';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold ${t} ${s.cls} ${className}`}
    >
      {s.icone ? (
        <Icon nom={s.icone} className={taille === 'sm' ? 'text-[12px]' : 'text-[13px]'} />
      ) : (
        <span className={`h-[7px] w-[7px] rounded-full ${s.point}`} />
      )}
      {children}
    </span>
  );
}
