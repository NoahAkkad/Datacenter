const { verifyPassword, signToken } = require('../../../lib/auth');
const { sendSuccess, sendError } = require('../../../lib/api/response');
const { setAuthCookie, ensureDefaultAdmin, readAuthDb } = require('../../../lib/api/auth');
const { validateRuntimeEnv } = require('../../../lib/env');

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  try {
    validateRuntimeEnv();
    await ensureDefaultAdmin();

    const { username, password, portal } = req.body || {};
    const db = readAuthDb();
    const user = db.users.find((u) => u.username === username);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendError(res, 401, 'Invalid credentials');
    }

    if (portal === 'admin' && user.role !== 'admin') {
      return sendError(res, 403, 'This account is not allowed in admin portal');
    }

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    setAuthCookie(res, token);

    return sendSuccess(res, { id: user.id, username: user.username, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Login failed' });
  }
}
