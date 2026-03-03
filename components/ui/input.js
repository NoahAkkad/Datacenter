export function Input({ className = '', ...props }) {
  return <input className={`w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 ${className}`} {...props} />;
}
