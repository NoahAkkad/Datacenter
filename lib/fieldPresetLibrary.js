export const FIELD_PRESETS = {
  'Dashboard Login': { type: 'text' },
  'Dashboard Password': { type: 'text' },
  'Dashboard Link': { type: 'link' },
  Email: { type: 'text' },
  Password: { type: 'text' },
  Phone: { type: 'number' },
  'Company Name': { type: 'text' },
  'Company Link': { type: 'link' },
  'Contract PDF': { type: 'pdf' },
  'Contract Photo': { type: 'image' },
  'RDP IP': { type: 'number' },
  'RDP User': { type: 'text' },
  'RDP Password': { type: 'text' },
  'App Link': { type: 'text' },
  'App Logo': { type: 'image' }
};

export const FIELD_PRESET_OPTIONS = ['Manual', ...Object.keys(FIELD_PRESETS)];

