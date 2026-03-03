'use client';

import { useEffect } from 'react';

export function Toast({ message, type = 'info', onClose, duration = 3200 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => onClose?.(), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, onClose]);

  if (!message) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <div className={`toast ${type}`}>{message}</div>
    </div>
  );
}
