const { readDb } = require('../../lib/db');
const { requireRole } = require('../../lib/api/auth');
const { sendSuccess, sendError } = require('../../lib/api/response');

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'user');
  if (auth.error) return sendError(res, auth.status, auth.error);

  const search = String(req.query.search || '').toLowerCase();
  const db = readDb();
  const applications = db.applications.filter((a) => a.name.toLowerCase().includes(search)).map((a) => ({ id: a.id, name: a.name }));
  return sendSuccess(res, { applications });
}
