const { verifyToken, hashPassword } = require('../auth');
const { withDb, nextId, readDb } = require('../db');

const isProduction = process.env.NODE_ENV === 'production';

function setAuthCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `auth=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${8 * 60 * 60}; ${isProduction ? 'Secure;' : ''}`
  );
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `auth=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0; ${isProduction ? 'Secure;' : ''}`);
}

function getUserFromRequest(req) {
  const token = req.cookies?.auth;
  if (!token) return null;
  try { return verifyToken(token); } catch { return null; }
}

function requireAuth(req) {
  const user = getUserFromRequest(req);
  if (!user) return { error: 'Unauthorized', status: 401 };
  return { user };
}

function requireRole(req, _res, role) {
  const auth = requireAuth(req);
  if (auth.error) return auth;
  if (auth.user.role !== role) return { error: 'Forbidden', status: 403 };
  return auth;
}

function ensureDefaultAdmin() {
  withDb((db) => {
    if (!db.users.find((u) => u.username === 'admin')) {
      db.users.push({ id: nextId('usr'), username: 'admin', passwordHash: hashPassword(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'), role: 'admin', createdAt: new Date().toISOString() });
    }
    return db;
  });
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth, requireRole, ensureDefaultAdmin, readDb };
