'use client';

import { FieldRenderer } from './FieldRenderer';

function formatMetaDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export function FieldCard({ field, onPreviewImage }) {
  return (
    <article className="field-card">
      <header className="field-card-header">
        <p className="field-label">{field.label}</p>
      </header>

      <div className="field-content">
        <FieldRenderer field={field} onPreviewImage={onPreviewImage} />
      </div>

      <footer className="field-meta">
        <span>Created: {formatMetaDate(field.createdAt)}</span>
        <span>Updated: {formatMetaDate(field.updatedAt)}</span>
      </footer>
    </article>
  );
}
