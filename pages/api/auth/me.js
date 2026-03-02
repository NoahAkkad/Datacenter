const { requireAuth } = require('../../../lib/api/auth');
const { sendSuccess, sendError } = require('../../../lib/api/response');

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');
  const auth = requireAuth(req, res);
  if (auth.error) return sendError(res, auth.status, auth.error);
  return sendSuccess(res, auth.user);
}
