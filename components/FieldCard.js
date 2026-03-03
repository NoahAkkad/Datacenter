'use client';

import { FieldRenderer } from './FieldRenderer';
import { formatDateOnly } from '../lib/formatDate';

export function FieldCard({ field, onPreviewImage }) {
  const createdDate = formatDateOnly(field.createdAt);
  const updatedDate = formatDateOnly(field.updatedAt);
  const hasMetadata = Boolean(createdDate || updatedDate);

  return (
    <article className="field-card">
      <header className="field-card-header">
        <p className="field-label">{field.label}</p>
      </header>

      <div className="field-content">
        <FieldRenderer field={field} onPreviewImage={onPreviewImage} />
      </div>

      {hasMetadata ? (
        <footer className="field-meta">
          {createdDate ? <span>Created: {createdDate}</span> : null}
          {updatedDate ? <span>Updated: {updatedDate}</span> : null}
        </footer>
      ) : null}
    </article>
  );
}
