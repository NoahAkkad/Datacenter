export function Card({ className = '', ...props }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:shadow-md ${className}`} {...props} />;
}
