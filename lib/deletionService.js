const { deleteStoredFile } = require('./storage');

function ensureAuditLog(db) {
  if (!Array.isArray(db.auditLogs)) {
    db.auditLogs = [];
  }
}

function addAuditLog(db, action, actor, metadata = {}) {
  ensureAuditLog(db);
  db.auditLogs.push({
    id: `log_${Math.random().toString(36).slice(2, 10)}`,
    action,
    actorId: actor?.id,
    actorUsername: actor?.username,
    actorRole: actor?.role,
    metadata,
    createdAt: new Date().toISOString()
  });
}

async function removeRecordFiles(record, scopedFieldIds = null) {
  const values = record?.values || {};
  const deletions = Object.entries(values)
    .filter(([fieldId]) => !scopedFieldIds || scopedFieldIds.has(fieldId))
    .map(([, value]) => (value && typeof value === 'object' ? deleteStoredFile(value) : null))
    .filter(Boolean);

  await Promise.allSettled(deletions);
}

async function deleteRecordById(db, recordId, actor) {
  const record = db.records.find((entry) => entry.id === recordId);
  if (!record) return { error: 'Record not found', status: 404 };

  await removeRecordFiles(record);
  db.records = db.records.filter((entry) => entry.id !== recordId);
  addAuditLog(db, 'record.delete', actor, { recordId, applicationId: record.applicationId });
  return { deleted: record };
}

async function deleteFieldById(db, fieldId, actor) {
  const field = db.fields.find((entry) => entry.id === fieldId);
  if (!field) return { error: 'Field not found', status: 404 };

  const scopedFieldIds = new Set([field.id]);
  for (const record of db.records.filter((r) => r.applicationId === field.applicationId)) {
    if (Object.prototype.hasOwnProperty.call(record.values || {}, field.id)) {
      await removeRecordFiles(record, scopedFieldIds);
      delete record.values[field.id];
    }
  }

  db.fields = db.fields.filter((entry) => entry.id !== field.id);
  addAuditLog(db, 'field.delete', actor, { fieldId, applicationId: field.applicationId });
  return { deleted: field };
}

async function deleteApplicationById(db, applicationId, actor) {
  const application = db.applications.find((entry) => entry.id === applicationId);
  if (!application) return { error: 'Application not found', status: 404 };

  const fieldIds = new Set(db.fields.filter((field) => field.applicationId === applicationId).map((field) => field.id));
  for (const record of db.records.filter((record) => record.applicationId === applicationId)) {
    await removeRecordFiles(record, fieldIds);
  }

  db.records = db.records.filter((record) => record.applicationId !== applicationId);
  db.fields = db.fields.filter((field) => field.applicationId !== applicationId);
  db.applications = db.applications.filter((entry) => entry.id !== applicationId);
  addAuditLog(db, 'application.delete', actor, { applicationId, companyId: application.companyId });
  return { deleted: application };
}

async function deleteCompanyById(db, companyId, actor) {
  const company = db.companies.find((entry) => entry.id === companyId);
  if (!company) return { error: 'Company not found', status: 404 };

  for (const app of db.applications.filter((entry) => entry.companyId === companyId)) {
    await deleteApplicationById(db, app.id, actor);
  }

  db.companies = db.companies.filter((entry) => entry.id !== companyId);
  addAuditLog(db, 'company.delete', actor, { companyId });
  return { deleted: company };
}

function deleteUserById(db, userId, actor) {
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) return { error: 'User not found', status: 404 };
  if (user.role === 'admin') return { error: 'Admin users cannot be deleted', status: 403 };

  db.users = db.users.filter((entry) => entry.id !== userId);
  addAuditLog(db, 'user.delete', actor, { userId, username: user.username, role: user.role });
  return { deleted: user };
}

module.exports = { deleteRecordById, deleteFieldById, deleteApplicationById, deleteCompanyById, deleteUserById };
