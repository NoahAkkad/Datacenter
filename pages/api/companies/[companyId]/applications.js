const { readDb, withDb, nextId } = require('../../../../lib/db');
const { requireRole } = require('../../../../lib/api/auth');
const { sendSuccess, sendError } = require('../../../../lib/api/response');

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);

  const { companyId } = req.query;
  const { name } = req.body || {};
  const db = readDb();
  if (!db.companies.find((c) => c.id === companyId)) return sendError(res, 404, 'Company not found');

  const application = { id: nextId('app'), companyId, name, createdAt: new Date().toISOString() };
  withDb((current) => {
    current.applications.push(application);
    return current;
  });
  return sendSuccess(res, application, 201);
}
