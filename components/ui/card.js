export function Card({ className = '', ...props }) {
  return <section className={`card ${className}`} {...props} />;
}
