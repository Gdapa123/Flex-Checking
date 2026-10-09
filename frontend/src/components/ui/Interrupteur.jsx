/** Interrupteur (role switch), style du design (piste 44×26). */
export default function Interrupteur({
  actif,
  onChange,
  label,
  description,
  couleur = 'bg-succes',
  univers = 'clair',
  id,
}) {
  const piste = actif
    ? couleur
    : univers === 'graphite'
      ? 'bg-g-bordure'
      : univers === 'mde'
        ? 'bg-mde-bordure'
        : 'bg-champ-doux';
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={actif}
      onClick={() => onChange(!actif)}
      className="flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent p-0 text-left text-[15px] text-inherit"
    >
      <span className="flex flex-col">
        <span>{label}</span>
        {description && <span className="text-[13px] opacity-75">{description}</span>}
      </span>
      <span className={`relative h-[26px] w-11 flex-none rounded-[13px] transition-colors ${piste}`}>
        <span
          className="absolute top-[3px] h-5 w-5 rounded-full bg-blanc transition-[left]"
          style={{ left: actif ? 21 : 3 }}
        />
      </span>
    </button>
  );
}
