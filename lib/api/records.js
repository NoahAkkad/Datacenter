function normalizeRecordFields(fields, recordValues = {}) {
  return fields
    .map((field) => {
      const rawValue = recordValues[field.id];
      if (!rawValue) return null;
      if (field.type === 'text') return { label: field.name, type: 'text', value: String(rawValue) };
      return { label: field.name, type: field.type, fileUrl: rawValue.url };
    })
    .filter(Boolean);
}

module.exports = { normalizeRecordFields };
