export default function Spinner({ taille = 18, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block flex-none animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      style={{ width: taille, height: taille }}
    />
  );
}
