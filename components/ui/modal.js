'use client';

import { Card } from './card';

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="modal" onClick={onClose}>
      <Card className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <div className="stack">{children}</div>
      </Card>
    </div>
  );
}
