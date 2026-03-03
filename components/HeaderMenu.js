'use client';

import { useEffect, useRef, useState } from 'react';

export function HeaderMenu({ onLogout, loggingOut = false }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await onLogout();
  };

  return (
    <div className="header-menu" ref={containerRef}>
      <button
        className="header-menu-trigger"
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        disabled={loggingOut}
      >
        👤
      </button>

      <div className={`header-menu-dropdown ${open ? 'open' : ''}`} aria-hidden={!open}>
        <button className="menu-item danger" type="button" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </div>
  );
}
