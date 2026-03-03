'use client';

import { Card } from './card';

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-xl space-y-4" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <div className="space-y-3">{children}</div>
      </Card>
    </div>
  );
}
