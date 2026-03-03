export function IconButton({ icon, label, variant = 'neutral', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`icon-btn ${variant} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
