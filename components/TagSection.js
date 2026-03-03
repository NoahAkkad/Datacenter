'use client';

import { Card } from './ui/card';
import { FieldCard } from './FieldCard';

export function TagSection({ tagGroup, onPreviewImage }) {
  return (
    <Card className="tag-card">
      <div className="tag-title-wrap">
        <h3 className="tag-title">{tagGroup.name}</h3>
        <span className="tag-scope">{tagGroup.scopeLabel}</span>
      </div>

      <div className="field-card-grid">
        {tagGroup.fields.map((field) => (
          <FieldCard key={`${tagGroup.id}-${field.label}-${field.type}`} field={field} onPreviewImage={onPreviewImage} />
        ))}
      </div>
    </Card>
  );
}
