import { Card } from './ui/card';
import { FieldRenderer } from './FieldRenderer';

export function TagSection({ tagGroup, onPreview }) {
  return (
    <Card className="tag-section">
      <div className="tag-section-head">
        <h3>{tagGroup.name}</h3>
        <p className="subtitle">{tagGroup.scopeLabel}</p>
      </div>
      <div className="fields-grid">
        {tagGroup.fields.map((field) => (
          <FieldRenderer key={`${tagGroup.id}-${field.label}-${field.type}`} field={field} onPreview={onPreview} />
        ))}
      </div>
    </Card>
  );
}
