import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readDb, withDb, nextId } = require('../../../../../lib/db');
const { verifyToken } = require('../../../../../lib/auth');
const { uploadFile } = require('../../../../../lib/storage');

function json(data, status = 200) {
  return Response.json(data, { status });
}

function requireAdmin(request) {
  const token = request.cookies.get('auth')?.value;
  if (!token) return { error: json({ success: false, error: 'Unauthorized' }, 401) };
  try {
    const user = verifyToken(token);
    if (user.role !== 'admin') return { error: json({ success: false, error: 'Forbidden' }, 403) };
    return { user };
  } catch {
    return { error: json({ success: false, error: 'Unauthorized' }, 401) };
  }
}

export async function POST(request, { params }) {
  const auth = requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { id: applicationId } = params;
    const db = readDb();
    const applicationFields = db.fields.filter((f) => f.applicationId === applicationId);
    if (!db.applications.find((a) => a.id === applicationId)) return json({ success: false, error: 'Application not found' }, 404);

    const formData = await request.formData();
    const values = JSON.parse(formData.get('values') || '{}');

    for (const field of applicationFields.filter((entry) => entry.type !== 'text')) {
      const file = formData.get(field.id);
      if (!file) continue;
      const arrayBuffer = await file.arrayBuffer();
      values[field.id] = await uploadFile({
        buffer: Buffer.from(arrayBuffer),
        originalName: file.name,
        mimeType: file.type
      });
    }

    const record = { id: nextId('rec'), applicationId, values, createdAt: new Date().toISOString() };
    withDb((current) => {
      current.records.push(record);
      return current;
    });

    return json({ success: true, data: record }, 201);
  } catch (error) {
    console.error('record upload error', error);
    return json({ success: false, error: 'Record upload failed' }, 500);
  }
}
