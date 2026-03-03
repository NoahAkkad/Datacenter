'use client';

import { LinkDisplay } from './ui/link-display';

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toISOString().slice(0, 10);
}

export function FieldRenderer({ field, onPreview }) {
  return (
    <article className="field-card">
      <header className="field-card-head">
        <h4>{field.label}</h4>
      </header>
      <div className="field-card-body">
        {field.type === 'text' ? <p>{field.value || '—'}</p> : null}
        {field.type === 'image' ? (
          field.fileUrl ? (
            <button type="button" className="image-preview-trigger" onClick={() => onPreview(field.fileUrl)}>
              <img src={field.fileUrl} alt={`${field.label} preview`} className="field-image" />
            </button>
          ) : <p>—</p>
        ) : null}
        {field.type === 'pdf' ? (
          field.fileUrl ? <a className="pdf-link" href={field.fileUrl} target="_blank" rel="noopener noreferrer">Open PDF</a> : <p>—</p>
        ) : null}
        {field.type === 'link' ? <LinkDisplay value={field.value} /> : null}
      </div>
      <footer className="field-card-meta">Updated: {formatDate(field.updatedAt || field.createdAt)}</footer>
    </article>
  );
}
