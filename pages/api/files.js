const { readDb } = require('../../lib/db');
const { requireRole } = require('../../lib/api/auth');
const { sendSuccess, sendError } = require('../../lib/api/response');

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');
  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);

  const db = readDb();
  const fileRows = [];

  db.records.forEach((record) => {
    const application = db.applications.find((app) => app.id === record.applicationId);
    const company = db.companies.find((comp) => comp.id === application?.companyId);

    Object.entries(record.values || {}).forEach(([fieldId, value]) => {
      const field = db.fields.find((entry) => entry.id === fieldId);
      if (!field || field.type === 'text' || !value?.url) return;

      fileRows.push({
        id: `${record.id}-${fieldId}`,
        recordId: record.id,
        fieldId,
        fieldName: field.name,
        fileName: value.originalName || 'uploaded-file',
        fileUrl: value.url,
        fileType: field.type,
        applicationId: application?.id,
        applicationName: application?.name || '-',
        companyId: company?.id,
        companyName: company?.name || '-',
        createdAt: record.createdAt
      });
    });
  });

  return sendSuccess(res, fileRows);
}
