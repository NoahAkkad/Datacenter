const { readDb, withDb, nextId } = require('../../lib/db');
const { hashPassword } = require('../../lib/auth');
const { requireRole } = require('../../lib/api/auth');
const { sendSuccess, sendError } = require('../../lib/api/response');

export default async function handler(req, res) {
  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);

  if (req.method === 'GET') {
    const db = readDb();
    const users = db.users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt
    }));
    return sendSuccess(res, users);
  }

  if (req.method === 'POST') {
    const { username, password, role = 'user' } = req.body || {};
    if (!username || !password) return sendError(res, 400, 'Username and password required');
    if (!['user', 'admin'].includes(role)) return sendError(res, 400, 'Invalid role');

    const db = readDb();
    if (db.users.find((u) => u.username === username)) return sendError(res, 409, 'Username already exists');

    const user = { id: nextId('usr'), username, passwordHash: hashPassword(password), role, createdAt: new Date().toISOString() };
    withDb((current) => {
      current.users.push(user);
      return current;
    });

    return sendSuccess(res, { id: user.id, username: user.username, role: user.role }, 201);
  }

  return sendError(res, 405, 'Method not allowed');
}
