export function Skeleton({ className = '', style = {} }) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}
