'use client';

import { useState } from 'react';
import { Card } from './ui/card';
import { Modal } from './ui/modal';
import { LinkDisplay } from './ui/link-display';

export function GroupedFieldsView({ groupedFields = [] }) {
  const [imagePreview, setImagePreview] = useState('');

  if (!groupedFields.length) {
    return (
      <Card><p className="subtitle">No records available.</p></Card>
    );
  }

  return (
    <>
      <div className="stack section-mini-gap">
        {groupedFields.map((tagGroup) => (
          <Card key={tagGroup.id}>
            <div className="stack section-mini-gap">
              <h3>{tagGroup.name} <span className="subtitle">({tagGroup.scopeLabel})</span></h3>
              {tagGroup.fields.map((field) => (
                <div key={`${tagGroup.id}-${field.label}-${field.type}`} className="field-row">
                  <strong>{field.label}</strong>
                  {field.type === 'text' ? (
                    <span>{field.value}</span>
                  ) : field.type === 'image' ? (
                    field.fileUrl ? (
                      <button type="button" className="button secondary" onClick={() => setImagePreview(field.fileUrl)} style={{ padding: '4px', lineHeight: 0 }}>
                        <img src={field.fileUrl} alt={`${field.label} preview`} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px' }} />
                      </button>
                    ) : <span>—</span>
                  ) : field.type === 'pdf' ? (
                    field.fileUrl ? <a className="link" href={field.fileUrl} target="_blank" rel="noopener noreferrer">Open PDF</a> : <span>—</span>
                  ) : field.type === 'link' ? (
                    <LinkDisplay value={field.value} />
                  ) : (
                    <span>—</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(imagePreview)} onClose={() => setImagePreview('')} title="Image Preview">
        {imagePreview ? <img src={imagePreview} alt="Application image" className="preview-image" /> : null}
      </Modal>
    </>
  );
}
