const { readDb, withDb, nextId } = require('../../../../lib/db');
const { requireRole } = require('../../../../lib/api/auth');
const { sendSuccess, sendError } = require('../../../../lib/api/response');

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);

  const { id: applicationId } = req.query;
  const { name, type } = req.body || {};
  const allowedTypes = ['text', 'pdf', 'image'];
  if (!allowedTypes.includes(type)) return sendError(res, 400, 'Invalid field type');

  const db = readDb();
  if (!db.applications.find((a) => a.id === applicationId)) return sendError(res, 404, 'Application not found');

  const field = { id: nextId('fld'), applicationId, name, type, createdAt: new Date().toISOString() };
  withDb((current) => {
    current.fields.push(field);
    return current;
  });

  return sendSuccess(res, field, 201);
}
