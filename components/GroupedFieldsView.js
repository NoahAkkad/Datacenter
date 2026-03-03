'use client';

import { useState } from 'react';
import { Card } from './ui/card';
import { Modal } from './ui/modal';
import { TagSection } from './TagSection';

export function GroupedFieldsView({ groupedFields = [] }) {
  const [imagePreview, setImagePreview] = useState('');

  if (!groupedFields.length) {
    return (
      <Card><p className="subtitle">No records available.</p></Card>
    );
  }

  return (
    <>
      <div className="tag-sections">
        {groupedFields.map((tagGroup) => <TagSection key={tagGroup.id} tagGroup={tagGroup} onPreview={setImagePreview} />)}
      </div>

      <Modal open={Boolean(imagePreview)} onClose={() => setImagePreview('')} title="Image Preview">
        {imagePreview ? <img src={imagePreview} alt="Application image" className="preview-image" /> : null}
      </Modal>
    </>
  );
}
