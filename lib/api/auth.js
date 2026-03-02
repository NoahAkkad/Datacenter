const { verifyToken, hashPassword } = require('../auth');
const { connectDb, withDb, nextId, readDb } = require('../db');

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

function buildDefaultAdminUser() {
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

  return {
    id: process.env.DEFAULT_ADMIN_ID || 'usr_default_admin',
    username,
    passwordHash: hashPassword(password),
    role: 'admin',
    createdAt: new Date(0).toISOString()
  };
}

async function ensureDefaultAdmin() {
  await connectDb();
  try {
    withDb((db) => {
      if (!db.users.find((u) => u.username === (process.env.DEFAULT_ADMIN_USERNAME || 'admin'))) {
        db.users.push({
          id: nextId('usr'),
          username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
          passwordHash: hashPassword(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'),
          role: 'admin',
          createdAt: new Date().toISOString()
        });
      }
      return db;
    });
  } catch (error) {
    if (isProduction) {
      console.warn('[auth] Unable to persist default admin user. Falling back to in-memory default user.', error.message);
      return;
    }
    throw error;
  }
}

function readAuthDb() {
  const db = readDb();
  const defaultAdmin = buildDefaultAdminUser();
  if (!db.users.some((user) => user.username === defaultAdmin.username)) {
    return { ...db, users: [...db.users, defaultAdmin] };
  }
  return db;
}

module.exports = { setAuthCookie, clearAuthCookie, requireAuth, requireRole, ensureDefaultAdmin, readAuthDb };
