const PRESET_FIELD_TYPES = ['text', 'number', 'link', 'pdf', 'image'];

const TAG_PRESET_TEMPLATES = [
  {
    key: 'dashboard_information',
    name: 'Dashboard Information',
    fields: [
      { name: 'Dashboard Login', type: 'text' },
      { name: 'Dashboard Password', type: 'text' },
      { name: 'Dashboard Link', type: 'link' }
    ]
  },
  {
    key: 'google_console_information',
    name: 'Google Console Information',
    fields: [
      { name: 'Email', type: 'text' },
      { name: 'Password', type: 'text' }
    ]
  },
  {
    key: 'company_information',
    name: 'Company Information',
    fields: [
      { name: 'Name', type: 'text' },
      { name: 'Phone', type: 'number' },
      { name: 'Email', type: 'text' },
      { name: 'Email Password', type: 'text' },
      { name: 'Email Support', type: 'text' }
    ]
  },
  {
    key: 'contract_with_partner',
    name: 'Contract With Partner',
    fields: [
      { name: 'Company Name', type: 'text' },
      { name: 'Company Link', type: 'link' },
      { name: 'Contract PDF', type: 'pdf' },
      { name: 'Contract Photo', type: 'image' }
    ]
  },
  {
    key: 'rdp_information',
    name: 'RDP Information',
    fields: [
      { name: 'RDP IP', type: 'number' },
      { name: 'RDP User', type: 'text' },
      { name: 'RDP Password', type: 'text' }
    ]
  },
  {
    key: 'app_information',
    name: 'APP Information',
    fields: [
      { name: 'App Link', type: 'text' },
      { name: 'App Logo', type: 'image' }
    ]
  }
];

function sanitizePreset(preset) {
  return {
    key: String(preset.key),
    name: String(preset.name),
    fields: (preset.fields || []).map((field) => ({
      name: String(field.name),
      type: String(field.type).toLowerCase()
    }))
  };
}

function validatePresetTemplate(preset) {
  if (!preset || typeof preset !== 'object') return false;
  if (!preset.key || !preset.name || !Array.isArray(preset.fields)) return false;
  return preset.fields.every((field) => field.name && PRESET_FIELD_TYPES.includes(String(field.type).toLowerCase()));
}

const VALID_TAG_PRESET_TEMPLATES = TAG_PRESET_TEMPLATES
  .map(sanitizePreset)
  .filter(validatePresetTemplate);

function getTagPresets() {
  return VALID_TAG_PRESET_TEMPLATES.map((preset) => ({
    ...preset,
    fields: preset.fields.map((field) => ({ ...field }))
  }));
}

function getPresetByKey(presetKey) {
  const normalizedKey = String(presetKey || '').trim().toLowerCase();
  if (!normalizedKey) return null;
  return VALID_TAG_PRESET_TEMPLATES.find((preset) => preset.key === normalizedKey) || null;
}

module.exports = {
  PRESET_FIELD_TYPES,
  getTagPresets,
  getPresetByKey
};
