/** Carte « relief doux » du design. */
export default function Carte({ as: Tag = 'div', mde = false, className = '', children, ...rest }) {
  const base = mde
    ? 'rounded-carte border border-mde-bordure-carte bg-surface shadow-carte-mde'
    : 'rounded-carte border border-bordure-carte bg-surface shadow-carte';
  return (
    <Tag className={`${base} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
