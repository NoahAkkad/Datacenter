const { readDb, writeDb } = require('../../../lib/db');
const { requireRole } = require('../../../lib/api/auth');
const { sendSuccess, sendError } = require('../../../lib/api/response');
const { deleteApplicationById } = require('../../../lib/deletionService');

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);
  if (req.body?.confirm !== true) return sendError(res, 400, 'Deletion requires explicit confirmation');
  const db = readDb();
  const deletion = await deleteApplicationById(db, req.query.id, auth.user);
  if (deletion.error) return sendError(res, deletion.status, deletion.error);
  writeDb(db);
  return sendSuccess(res, { ok: true, deletedId: req.query.id, entity: 'application' });
}
