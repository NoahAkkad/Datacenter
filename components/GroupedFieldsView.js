'use client';

import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { TagSection } from './TagSection';

export function GroupedFieldsView({ groupedFields = [] }) {
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    if (!imagePreview) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setImagePreview('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imagePreview]);

  if (!groupedFields.length) {
    return (
      <Card className="empty-state-card"><p className="subtitle">No data available.</p></Card>
    );
  }

  return (
    <>
      <div className="stack section-gap fade-in">
        {groupedFields.map((tagGroup) => (
          <TagSection key={tagGroup.id} tagGroup={tagGroup} onPreviewImage={setImagePreview} />
        ))}
      </div>

      {imagePreview ? (
        <div className="image-preview-overlay" onClick={() => setImagePreview('')}>
          <button
            type="button"
            className="image-preview-close"
            aria-label="Close image preview"
            onClick={() => setImagePreview('')}
          >
            ×
          </button>
          <img
            src={imagePreview}
            alt="Application image"
            className="image-preview-image"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
