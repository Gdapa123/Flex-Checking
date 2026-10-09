/**
 * Contrôle segmenté (radiogroup) : civilité, filtre de statut, durée, onglets.
 * `variante` : programme | mde | graphite.
 */
export default function Segmente({
  options,
  valeur,
  onChange,
  label,
  labelledBy,
  variante = 'programme',
  taille = 'md',
  grille = false,
  className = '',
  bordure,
}) {
  const fond = { programme: 'bg-subtil', mde: 'bg-mde-survol', graphite: 'bg-g-fond border border-g-bordure' }[
    variante
  ];
  const actif = {
    programme: 'btn-principal',
    mde: 'bg-mde-bordeaux text-blanc',
    graphite: 'bg-p text-op',
  }[variante];
  const inactif = variante === 'graphite' ? 'text-g-texte' : variante === 'mde' ? 'text-mde-texte' : 'text-texte';
  const h = { sm: 'h-[38px] px-3.5 text-[14px]', md: 'h-11 text-[16px]', lg: 'h-11 w-[72px] text-[16px]' }[taille];
  const onKey = (e, i) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = options[(i + dir + options.length) % options.length];
    onChange(n.value);
    e.currentTarget.parentElement
      .querySelectorAll('[role=radio]')
      [(i + dir + options.length) % options.length]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={`${grille ? 'grid' : 'flex'} gap-0.5 rounded-moyen p-[3px] ${fond} ${className}`}
      style={
        grille
          ? {
              gridTemplateColumns: `repeat(${options.length},minmax(0,1fr))`,
              gap: 4,
              padding: 4,
              border: bordure ? `1px solid ${bordure}` : undefined,
            }
          : undefined
      }
    >
      {options.map((o, i) => {
        const on = o.value === valeur;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (valeur == null && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`cursor-pointer rounded-petit border-0 font-semibold transition-[background,color,transform] duration-150 active:scale-[.97] ${h} ${on ? actif : `bg-transparent ${inactif}`}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
