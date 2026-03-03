'use client';

import { LinkDisplay } from './ui/link-display';

export function FieldRenderer({ field, onPreviewImage }) {
  if (field.type === 'image') {
    if (!field.fileUrl) return <span className="field-value">—</span>;

    return (
      <button
        type="button"
        className="field-image-trigger"
        onClick={() => onPreviewImage(field.fileUrl)}
        aria-label={`Open preview for ${field.label}`}
      >
        <img src={field.fileUrl} alt={`${field.label} preview`} className="field-image" />
      </button>
    );
  }

  if (field.type === 'pdf') {
    return field.fileUrl ? (
      <a className="button secondary field-file-btn" href={field.fileUrl} target="_blank" rel="noopener noreferrer">
        Open PDF
      </a>
    ) : <span className="field-value">—</span>;
  }

  if (field.type === 'link') {
    return <LinkDisplay value={field.value} />;
  }

  return <p className="field-value">{field.value || '—'}</p>;
}
