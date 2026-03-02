const { clearAuthCookie } = require('../../../lib/api/auth');
const { sendSuccess, sendError } = require('../../../lib/api/response');

function validateSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');
  if (!validateSameOrigin(req)) return sendError(res, 403, 'Invalid origin');
  clearAuthCookie(res);
  return sendSuccess(res, { ok: true });
}
