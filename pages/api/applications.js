const { readDb } = require('../../lib/db');
const { requireRole } = require('../../lib/api/auth');
const { sendSuccess, sendError } = require('../../lib/api/response');

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'user');
  if (auth.error) return sendError(res, auth.status, auth.error);

  const search = String(req.query.search || '').toLowerCase();
  const db = readDb();

  const applications = db.applications
    .map((appEntry) => {
      const company = db.companies.find((companyEntry) => companyEntry.id === appEntry.companyId);
      const relatedFields = db.fields.filter((field) => field.applicationId === appEntry.id);
      return {
        id: appEntry.id,
        name: appEntry.name,
        companyId: appEntry.companyId,
        companyName: company?.name || '-',
        fieldCount: relatedFields.length,
        fields: relatedFields
      };
    })
    .filter((entry) => entry.name.toLowerCase().includes(search) || entry.companyName.toLowerCase().includes(search));

  if (auth.user.role === 'admin') return sendSuccess(res, applications);

  return sendSuccess(
    res,
    {
      applications: applications.map((entry) => ({ id: entry.id, name: entry.name }))
    }
  );
}
