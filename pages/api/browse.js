const { readDb } = require('../../lib/db');
const { requireRole } = require('../../lib/api/auth');
const { sendSuccess, sendError } = require('../../lib/api/response');

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);

  const { company = '', application = '' } = req.query;
  const db = readDb();
  const companies = db.companies
    .filter((c) => c.name.toLowerCase().includes(String(company).toLowerCase()))
    .map((c) => {
      const apps = db.applications
        .filter((a) => a.companyId === c.id && a.name.toLowerCase().includes(String(application).toLowerCase()))
        .map((a) => ({ ...a, fields: db.fields.filter((f) => f.applicationId === a.id), records: db.records.filter((r) => r.applicationId === a.id) }));
      return { ...c, applications: apps };
    })
    .filter((c) => c.applications.length > 0 || !application);

  return sendSuccess(res, companies);
}
