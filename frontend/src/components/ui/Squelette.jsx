export default function Squelette({ className = 'h-5', style }) {
  return <div aria-hidden="true" className={`squelette animate-shimmer rounded-puce ${className}`} style={style} />;
}
