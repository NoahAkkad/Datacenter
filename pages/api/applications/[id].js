const { readDb } = require('../../../lib/db');
const { requireRole } = require('../../../lib/api/auth');
const { sendSuccess, sendError } = require('../../../lib/api/response');
const { normalizeRecordFields } = require('../../../lib/api/records');

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'user');
  if (auth.error) return sendError(res, auth.status, auth.error);

  const { id } = req.query;
  const db = readDb();
  const application = db.applications.find((entry) => entry.id === id);
  if (!application) return sendError(res, 404, 'Application not found');

  const fields = db.fields.filter((field) => field.applicationId === application.id);
  const records = db.records.filter((record) => record.applicationId === application.id).map((record) => ({
    createdAt: record.createdAt,
    fields: normalizeRecordFields(fields, record.values)
  }));
  return sendSuccess(res, { id: application.id, name: application.name, records });
}
