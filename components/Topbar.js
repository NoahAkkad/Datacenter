'use client';

export function Topbar({ title, subtitle, profile, onMenuToggle, showMenuButton, actions }) {
  return (
    <header className="topbar">
      <div className="topbar-main">
        {showMenuButton ? <button type="button" className="icon-btn" onClick={onMenuToggle} aria-label="Open navigation" title="Open navigation">☰</button> : null}
        <div>
          <h1 className="title">{title}</h1>
          {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        </div>
      </div>
      <div className="topbar-actions">
        {actions}
        {profile}
      </div>
    </header>
  );
}
