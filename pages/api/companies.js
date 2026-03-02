const { readDb, withDb, nextId } = require('../../lib/db');
const { requireRole } = require('../../lib/api/auth');
const { sendSuccess, sendError } = require('../../lib/api/response');

export default async function handler(req, res) {
  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);

  try {
    if (req.method === 'GET') {
      const db = readDb();
      const companies = db.companies.map((company) => ({
        ...company,
        applications: db.applications.filter((appEntry) => appEntry.companyId === company.id).map((appEntry) => ({
          ...appEntry,
          fields: db.fields.filter((field) => field.applicationId === appEntry.id),
          records: db.records.filter((record) => record.applicationId === appEntry.id)
        }))
      }));
      return sendSuccess(res, companies);
    }

    if (req.method === 'POST') {
      const { name } = req.body || {};
      if (!name) return sendError(res, 400, 'Company name is required');
      const company = { id: nextId('cmp'), name, createdAt: new Date().toISOString() };
      withDb((db) => {
        db.companies.push(company);
        return db;
      });
      return sendSuccess(res, company, 201);
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error('companies api error', error);
    return sendError(res, 500, 'Unexpected error');
  }
}
