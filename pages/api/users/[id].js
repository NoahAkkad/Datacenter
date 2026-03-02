const { readDb, writeDb } = require('../../../lib/db');
const { requireRole } = require('../../../lib/api/auth');
const { sendSuccess, sendError } = require('../../../lib/api/response');
const { deleteUserById } = require('../../../lib/deletionService');

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);
  if (req.body?.confirm !== true) return sendError(res, 400, 'Deletion requires explicit confirmation');

  const { id } = req.query;
  if (id === auth.user.id) return sendError(res, 403, 'You cannot delete your own active account');

  const db = readDb();
  const deletion = deleteUserById(db, id, auth.user);
  if (deletion.error) return sendError(res, deletion.status, deletion.error);
  writeDb(db);
  return sendSuccess(res, { ok: true, deletedId: id, entity: 'user' });
}
