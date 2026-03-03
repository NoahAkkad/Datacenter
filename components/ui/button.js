const variants = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-400',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300'
};

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant] || variants.primary} ${className}`}
      {...props}
    />
  );
}
