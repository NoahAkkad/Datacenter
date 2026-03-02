const { readDb } = require('../../lib/db');
const { requireRole } = require('../../lib/api/auth');
const { sendSuccess, sendError } = require('../../lib/api/response');

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);

  const db = readDb();
  const fields = db.fields.map((field) => {
    const application = db.applications.find((app) => app.id === field.applicationId);
    const company = db.companies.find((comp) => comp.id === application?.companyId);
    return {
      ...field,
      applicationName: application?.name || '-',
      companyName: company?.name || '-'
    };
  });

  return sendSuccess(res, fields);
}
