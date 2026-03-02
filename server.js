const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const next = require('next');
const { readDb, writeDb, withDb, nextId } = require('./lib/db');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./lib/auth');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
      return;
    }
    cb(new Error('Only image and PDF files are allowed'));
  }
});

const {
  deleteRecordById,
  deleteFieldById,
  deleteApplicationById,
  deleteCompanyById,
  deleteUserById
} = require('./lib/deletionService');

const authCookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: !dev,
  path: '/'
};

function authRequired(req, res, nextFn) {
  try {
    const token = req.cookies.auth;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = verifyToken(token);
    nextFn();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}

function requireRole(role) {
  return (req, res, nextFn) => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    nextFn();
  };
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function normalizeFieldName(value) {
  return sanitizeText(value).toLowerCase();
}

function normalizeTagName(value) {
  return sanitizeText(value).toLowerCase();
}

function isNonEmptyId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function logUpdateIssue(entity, message, meta = {}) {
  // eslint-disable-next-line no-console
  console.error(`[update:${entity}] ${message}`, meta);
}

function logUpdateAttempt(entity, id, changes, user) {
  // eslint-disable-next-line no-console
  console.info('[update:attempt]', {
    entity,
    id,
    requestedBy: user?.id || 'unknown',
    changes
  });
}

function logUpdateSuccess(entity, id, result, user) {
  // eslint-disable-next-line no-console
  console.info('[update:success]', {
    entity,
    id,
    requestedBy: user?.id || 'unknown',
    updated: result
  });
}

function sendUpdateSuccess(res, data) {
  res.status(200).json({ success: true, data });
}

function ensureTimestamps(entity, now = new Date().toISOString()) {
  if (!entity.createdAt) {
    entity.createdAt = now;
  }

  if (!entity.updatedAt) {
    entity.updatedAt = entity.createdAt;
  }

  return entity;
}

function ensureDefaultTag(db, application) {
  if (!Array.isArray(db.tags)) {
    db.tags = [];
  }

  const existingDefault = db.tags.find((tag) => tag.applicationId === application.id && normalizeTagName(tag.name) === 'general');
  if (existingDefault) {
    return existingDefault;
  }

  const now = new Date().toISOString();
  const fallbackTag = {
    id: nextId('tag'),
    name: 'General',
    description: 'Default tag for ungrouped fields.',
    applicationId: application.id,
    companyId: application.companyId,
    createdAt: now,
    updatedAt: now
  };
  db.tags.push(fallbackTag);
  return fallbackTag;
}


function normalizeRecordFields(fields, tags = [], recordValues = {}) {
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));

  return fields
    .map((field) => {
      const rawValue = recordValues[field.id];
      if (!rawValue) return null;

      const matchedTag = tagById.get(field.tagId) || null;
      const tagLabel = matchedTag?.name || field.tagName || 'General';

      if (field.type === 'text') {
        return { label: field.name, type: 'text', value: String(rawValue), tagId: matchedTag?.id || null, tagName: tagLabel };
      }

      return {
        label: field.name,
        type: field.type,
        fileUrl: rawValue.url,
        tagId: matchedTag?.id || null,
        tagName: tagLabel
      };
    })
    .filter(Boolean);
}

function getConsolidatedRecord(records = []) {
  if (!records.length) return null;

  const sortedRecords = [...records].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const mergedValues = sortedRecords.reduce((accumulator, record) => ({
    ...accumulator,
    ...(record.values || {})
  }), {});

  return {
    id: sortedRecords[0].id,
    applicationId: sortedRecords[0].applicationId,
    values: mergedValues,
    createdAt: sortedRecords[0].createdAt,
    updatedAt: sortedRecords[sortedRecords.length - 1].createdAt
  };
}

function requireDeleteConfirmation(req, res, nextFn) {
  if (req.body?.confirm !== true) {
    res.status(400).json({ error: 'Deletion requires explicit confirmation' });
    return;
  }
  nextFn();
}

app.prepare().then(() => {
  const server = express();
  server.use(express.json({ limit: '1mb' }));
  server.use(cookieParser());

  withDb((db) => {
    if (!db.users.find((u) => u.username === 'admin')) {
      db.users.push({
        id: nextId('usr'),
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    }

    const now = new Date().toISOString();
    db.companies = db.companies.map((company) => ensureTimestamps(company, now));
    db.applications = db.applications.map((application) => ensureTimestamps(application, now));
    if (!Array.isArray(db.tags)) {
      db.tags = [];
    }
    db.tags = db.tags.map((tag) => ensureTimestamps(tag, now));

    return db;
  });

  server.post('/api/auth/login', (req, res) => {
    const { username, password, portal } = req.body;
    const db = readDb();
    const user = db.users.find((u) => u.username === username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (portal === 'admin' && user.role !== 'admin') {
      res.status(403).json({ error: 'This account is not allowed in admin portal' });
      return;
    }

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    res.cookie('auth', token, {
      ...authCookieOptions,
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({ id: user.id, username: user.username, role: user.role });
  });

  const logoutHandler = (req, res) => {
    const origin = req.get('origin');
    const host = req.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          res.status(403).json({ error: 'Invalid origin' });
          return;
        }
      } catch {
        res.status(403).json({ error: 'Invalid origin' });
        return;
      }
    }

    res.clearCookie('auth', authCookieOptions);
    res.json({ ok: true });
  };

  server.post('/api/auth/logout', logoutHandler);
  server.post('/api/logout', logoutHandler);

  server.get('/api/auth/me', authRequired, (req, res) => {
    res.json(req.user);
  });

  server.get('/api/companies', authRequired, requireRole('admin'), (req, res) => {
    const db = readDb();
    const companies = db.companies.map((company) => ({
      ...company,
      applications: db.applications
        .filter((appEntry) => appEntry.companyId === company.id)
        .map((appEntry) => ({
          ...appEntry,
          tags: db.tags.filter((tag) => tag.applicationId === appEntry.id),
          fields: db.fields.filter((field) => field.applicationId === appEntry.id),
          records: (() => {
            const mergedRecord = getConsolidatedRecord(db.records.filter((record) => record.applicationId === appEntry.id));
            return mergedRecord ? [mergedRecord] : [];
          })()
        }))
    }));
    res.json(companies);
  });

  server.get('/api/applications', authRequired, requireRole('user'), (req, res) => {
    const search = String(req.query.search || '').toLowerCase();
    const db = readDb();

    const applications = db.applications
      .filter((appEntry) => appEntry.name.toLowerCase().includes(search))
      .map((appEntry) => ({
        id: appEntry.id,
        name: appEntry.name,
        createdAt: appEntry.createdAt,
        updatedAt: appEntry.updatedAt
      }));

    res.json({ applications });
  });

  server.get('/api/applications/:id', authRequired, requireRole('user'), (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const application = db.applications.find((entry) => entry.id === id);

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    const fields = db.fields.filter((field) => field.applicationId === application.id);
    const tags = db.tags.filter((tag) => tag.applicationId === application.id);
    const company = db.companies.find((entry) => entry.id === application.companyId);
    const mergedRecord = getConsolidatedRecord(db.records.filter((record) => record.applicationId === application.id));
    const records = mergedRecord
      ? [{
        createdAt: mergedRecord.createdAt,
        updatedAt: mergedRecord.updatedAt,
        fields: normalizeRecordFields(fields, tags, mergedRecord.values)
      }]
      : [];

    const groupedFields = records[0]?.fields.reduce((accumulator, field) => {
      const groupName = field.tagName || 'General';
      if (!accumulator[groupName]) {
        accumulator[groupName] = [];
      }
      accumulator[groupName].push(field);
      return accumulator;
    }, {}) || {};

    res.json({
      id: application.id,
      name: application.name,
      companyName: company?.name || 'Unknown Company',
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      records,
      groupedFields
    });
  });

  server.post('/api/companies', authRequired, requireRole('admin'), (req, res) => {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Company name is required' });
      return;
    }

    const now = new Date().toISOString();
    const company = { id: nextId('cmp'), name, createdAt: now, updatedAt: now };
    withDb((db) => {
      db.companies.push(company);
      return db;
    });
    res.status(201).json(company);
  });

  server.post('/api/companies/:companyId/applications', authRequired, requireRole('admin'), (req, res) => {
    const { companyId } = req.params;
    const { name } = req.body;
    const db = readDb();

    if (!db.companies.find((c) => c.id === companyId)) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const now = new Date().toISOString();
    const application = { id: nextId('app'), companyId, name, createdAt: now, updatedAt: now };
    const defaultTag = {
      id: nextId('tag'),
      name: 'General',
      description: 'Default tag for ungrouped fields.',
      applicationId: application.id,
      companyId,
      createdAt: now,
      updatedAt: now
    };
    withDb((current) => {
      current.applications.push(application);
      if (!Array.isArray(current.tags)) {
        current.tags = [];
      }
      current.tags.push(defaultTag);
      return current;
    });

    res.status(201).json(application);
  });

  server.get('/api/applications/:applicationId/tags', authRequired, requireRole('admin'), (req, res) => {
    const { applicationId } = req.params;
    const db = readDb();
    const application = db.applications.find((entry) => entry.id === applicationId);

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    const tags = db.tags.filter((tag) => tag.applicationId === applicationId);
    res.json({ tags });
  });

  server.post('/api/applications/:applicationId/tags', authRequired, requireRole('admin'), (req, res) => {
    const { applicationId } = req.params;
    const nextName = sanitizeText(req.body?.name);
    const nextDescription = sanitizeText(req.body?.description);
    const db = readDb();
    const application = db.applications.find((entry) => entry.id === applicationId);

    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    if (!nextName) {
      res.status(400).json({ error: 'Tag name is required' });
      return;
    }

    const duplicate = db.tags.find((tag) => tag.applicationId === applicationId && normalizeTagName(tag.name) === normalizeTagName(nextName));
    if (duplicate) {
      res.status(409).json({ error: 'Tag name already exists in this application' });
      return;
    }

    const now = new Date().toISOString();
    const tag = {
      id: nextId('tag'),
      name: nextName,
      description: nextDescription,
      applicationId,
      companyId: application.companyId,
      createdAt: now,
      updatedAt: now
    };

    withDb((current) => {
      current.tags.push(tag);
      return current;
    });

    res.status(201).json(tag);
  });

  server.put('/api/tags/:id', authRequired, requireRole('admin'), (req, res) => {
    const id = sanitizeText(req.params.id);
    const nextName = sanitizeText(req.body?.name);
    const nextDescription = sanitizeText(req.body?.description);
    const db = readDb();
    const tag = (db.tags || []).find((entry) => entry.id === id);

    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    if (!nextName) {
      res.status(400).json({ error: 'Tag name is required' });
      return;
    }

    const duplicate = (db.tags || []).find((entry) => entry.applicationId === tag.applicationId
      && entry.id !== id
      && normalizeTagName(entry.name) === normalizeTagName(nextName));
    if (duplicate) {
      res.status(409).json({ error: 'Tag name already exists in this application' });
      return;
    }

    tag.name = nextName;
    tag.description = nextDescription;
    tag.updatedAt = new Date().toISOString();

    db.fields = db.fields.map((field) => (field.tagId === tag.id ? { ...field, tagName: tag.name } : field));

    writeDb(db);
    res.json({ success: true, data: tag });
  });

  server.delete('/api/tags/:id', authRequired, requireRole('admin'), requireDeleteConfirmation, (req, res) => {
    const id = sanitizeText(req.params.id);
    const db = readDb();
    const tag = (db.tags || []).find((entry) => entry.id === id);

    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    const linkedFields = db.fields.filter((field) => field.tagId === tag.id);
    const application = db.applications.find((entry) => entry.id === tag.applicationId);
    const fallbackTag = application ? ensureDefaultTag(db, application) : null;

    linkedFields.forEach((field) => {
      if (fallbackTag && fallbackTag.id !== tag.id) {
        field.tagId = fallbackTag.id;
        field.tagName = fallbackTag.name;
      } else {
        field.tagId = null;
        field.tagName = 'General';
      }
    });

    db.tags = db.tags.filter((entry) => entry.id !== id);
    writeDb(db);
    res.json({ ok: true, deletedId: id, entity: 'tag' });
  });

  server.post('/api/applications/:applicationId/fields', authRequired, requireRole('admin'), (req, res) => {
    const { applicationId } = req.params;
    const { name, type, applicationIds = [], tagId, tagName } = req.body;
    const allowedTypes = ['text', 'pdf', 'image'];
    const nextName = sanitizeText(name);

    if (!allowedTypes.includes(type)) {
      res.status(400).json({ error: 'Invalid field type' });
      return;
    }

    if (!nextName) {
      res.status(400).json({ error: 'Field name is required' });
      return;
    }

    const db = readDb();
    const targetApplicationIds = applicationId === 'all'
      ? Array.from(new Set(applicationIds.map((id) => sanitizeText(id)).filter(Boolean)))
      : [applicationId];

    if (applicationId === 'all' && targetApplicationIds.length === 0) {
      res.status(400).json({ error: 'At least one application ID is required for bulk field creation' });
      return;
    }

    const appById = new Map(db.applications.map((entry) => [entry.id, entry]));
    const missingApplication = targetApplicationIds.find((id) => !appById.has(id));
    if (missingApplication) {
      res.status(404).json({ error: `Application not found: ${missingApplication}` });
      return;
    }

    const createdAt = new Date().toISOString();
    const duplicateEntries = [];
    const fieldsToCreate = [];

    targetApplicationIds.forEach((targetApplicationId) => {
      const duplicate = db.fields.find((field) => field.applicationId === targetApplicationId && normalizeFieldName(field.name) === normalizeFieldName(nextName));
      if (duplicate) {
        duplicateEntries.push({
          applicationId: targetApplicationId,
          fieldId: duplicate.id,
          fieldName: duplicate.name
        });
        return;
      }

      const application = appById.get(targetApplicationId);
      let selectedTag = null;

      if (tagId && applicationId !== 'all') {
        selectedTag = db.tags.find((entry) => entry.id === sanitizeText(tagId) && entry.applicationId === targetApplicationId);
      }

      if (!selectedTag && tagName) {
        selectedTag = db.tags.find((entry) => entry.applicationId === targetApplicationId && normalizeTagName(entry.name) === normalizeTagName(tagName));
      }

      if (!selectedTag) {
        selectedTag = ensureDefaultTag(db, application);
      }

      fieldsToCreate.push({
        id: nextId('fld'),
        applicationId: targetApplicationId,
        name: nextName,
        type,
        tagId: selectedTag.id,
        tagName: selectedTag.name,
        createdAt
      });
    });

    if (duplicateEntries.length > 0) {
      res.status(409).json({
        error: 'Field name already exists for one or more applications',
        duplicates: duplicateEntries
      });
      return;
    }

    withDb((current) => {
      current.fields.push(...fieldsToCreate);
      return current;
    });

    if (fieldsToCreate.length === 1) {
      res.status(201).json(fieldsToCreate[0]);
      return;
    }

    res.status(201).json({ count: fieldsToCreate.length, fields: fieldsToCreate });
  });

  server.post('/api/applications/:applicationId/records', authRequired, requireRole('admin'), upload.any(), (req, res) => {
    const { applicationId } = req.params;
    const db = readDb();
    const applicationFields = db.fields.filter((f) => f.applicationId === applicationId);

    if (!db.applications.find((a) => a.id === applicationId)) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    let values = {};
    try {
      values = JSON.parse(req.body.values || '{}');
    } catch {
      res.status(400).json({ error: 'Invalid values payload' });
      return;
    }

    const files = req.files || [];
    applicationFields
      .filter((field) => field.type !== 'text')
      .forEach((field) => {
        const matched = files.find((file) => file.fieldname === field.id);
        if (matched) {
          values[field.id] = {
            filename: matched.filename,
            originalname: matched.originalname,
            mimetype: matched.mimetype,
            url: `/uploads/${matched.filename}`
          };
        }
      });

    const now = new Date().toISOString();
    let upsertedRecord;

    withDb((current) => {
      const applicationRecords = current.records.filter((record) => record.applicationId === applicationId);
      const existingRecord = applicationRecords[0];

      if (!existingRecord) {
        upsertedRecord = {
          id: nextId('rec'),
          applicationId,
          values,
          createdAt: now,
          updatedAt: now
        };
        current.records.push(upsertedRecord);
        return current;
      }

      existingRecord.values = {
        ...(existingRecord.values || {}),
        ...values
      };
      existingRecord.updatedAt = now;
      upsertedRecord = existingRecord;
      current.records = current.records.filter((record) => record.applicationId !== applicationId || record.id === existingRecord.id);
      return current;
    });

    res.status(200).json(upsertedRecord);
  });

  server.get('/api/company/:id/fields', authRequired, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const company = db.companies.find((entry) => entry.id === id);

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const companyApplications = db.applications.filter((application) => application.companyId === id);
    const applicationsPayload = companyApplications.map((application) => {
      const applicationTags = db.tags.filter((tag) => tag.applicationId === application.id);
      const applicationFields = db.fields
        .filter((field) => field.applicationId === application.id)
        .map((field) => {
          const matchedTag = applicationTags.find((tag) => tag.id === field.tagId);
          return {
            ...field,
            tagId: matchedTag?.id || field.tagId || null,
            tagName: matchedTag?.name || field.tagName || 'General'
          };
        });
      const latestRecord = db.records
        .filter((record) => record.applicationId === application.id)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];

      return {
        applicationId: application.id,
        applicationName: application.name,
        fields: applicationFields,
        values: latestRecord?.values || {},
        recordId: latestRecord?.id || null
      };
    });

    const hasData = applicationsPayload.some((application) => Object.keys(application.values || {}).length > 0);
    res.json({
      companyId: company.id,
      companyName: company.name,
      applications: applicationsPayload,
      hasData
    });
  });

  server.post('/api/users', authRequired, requireRole('admin'), (req, res) => {
    const { username, password, role = 'user' } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    if (!['user', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const db = readDb();
    if (db.users.find((u) => u.username === username)) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    const user = {
      id: nextId('usr'),
      username,
      passwordHash: hashPassword(password),
      role,
      createdAt: new Date().toISOString()
    };

    withDb((current) => {
      current.users.push(user);
      return current;
    });

    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  });

  server.get('/api/users', authRequired, requireRole('admin'), (req, res) => {
    const db = readDb();
    res.json(db.users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt
    })));
  });

  const updateCompanyHandler = (req, res) => {
    const { id } = req.params;
    if (!isNonEmptyId(id)) {
      logUpdateIssue('company', 'Invalid ID', { id, body: req.body });
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      logUpdateIssue('company', 'Invalid request body', { id, bodyType: typeof req.body });
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    logUpdateAttempt('company', id, req.body, req.user);

    const nextName = sanitizeText(req.body?.name);
    if (!nextName) {
      res.status(400).json({ error: 'Company name is required' });
      return;
    }

    const db = readDb();
    const company = db.companies.find((entry) => entry.id === id);
    if (!company) {
      logUpdateIssue('company', 'Company not found', { id });
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    company.name = nextName;
    company.updatedAt = new Date().toISOString();
    writeDb(db);
    logUpdateSuccess('company', id, { name: company.name }, req.user);
    sendUpdateSuccess(res, company);
  };

  server.put('/api/company/:id', authRequired, requireRole('admin'), updateCompanyHandler);
  server.patch('/api/company/:id', authRequired, requireRole('admin'), updateCompanyHandler);
  server.put('/api/companies/:id', authRequired, requireRole('admin'), updateCompanyHandler);
  server.patch('/api/companies/:id', authRequired, requireRole('admin'), updateCompanyHandler);

  const updateApplicationHandler = (req, res) => {
    const { id } = req.params;
    if (!isNonEmptyId(id)) {
      logUpdateIssue('application', 'Invalid ID', { id });
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      logUpdateIssue('application', 'Invalid request body', { id, bodyType: typeof req.body });
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    logUpdateAttempt('application', id, req.body, req.user);

    const nextName = sanitizeText(req.body?.name);
    if (!nextName) {
      res.status(400).json({ error: 'Application name is required' });
      return;
    }

    const db = readDb();
    const application = db.applications.find((entry) => entry.id === id);
    if (!application) {
      logUpdateIssue('application', 'Application not found', { id });
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    application.name = nextName;
    application.updatedAt = new Date().toISOString();
    writeDb(db);
    logUpdateSuccess('application', id, { name: application.name }, req.user);
    sendUpdateSuccess(res, application);
  };

  server.put('/api/application/:id', authRequired, requireRole('admin'), updateApplicationHandler);
  server.patch('/api/application/:id', authRequired, requireRole('admin'), updateApplicationHandler);
  server.put('/api/applications/:id', authRequired, requireRole('admin'), updateApplicationHandler);
  server.patch('/api/applications/:id', authRequired, requireRole('admin'), updateApplicationHandler);

  const updateFieldHandler = (req, res) => {
    const { id } = req.params;
    const allowedTypes = ['text', 'pdf', 'image'];
    if (!isNonEmptyId(id)) {
      logUpdateIssue('field', 'Invalid ID', { id });
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      logUpdateIssue('field', 'Invalid request body', { id, bodyType: typeof req.body });
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    logUpdateAttempt('field', id, req.body, req.user);

    const db = readDb();
    const field = db.fields.find((entry) => entry.id === id);

    if (!field) {
      logUpdateIssue('field', 'Field not found', { id });
      res.status(404).json({ error: 'Field not found' });
      return;
    }

    if (req.body?.name !== undefined) {
      const nextName = sanitizeText(req.body.name);
      if (!nextName) {
        res.status(400).json({ error: 'Field name cannot be empty' });
        return;
      }

      const duplicateName = db.fields.find((entry) => entry.applicationId === field.applicationId
        && entry.id !== field.id
        && normalizeFieldName(entry.name) === normalizeFieldName(nextName));
      if (duplicateName) {
        res.status(409).json({ error: 'Field name already exists in this application' });
        return;
      }

      field.name = nextName;
    }

    if (req.body?.label !== undefined) {
      const nextLabel = sanitizeText(req.body.label);
      field.label = nextLabel;
    }

    if (req.body?.order !== undefined) {
      const numericOrder = Number(req.body.order);
      if (!Number.isInteger(numericOrder) || numericOrder < 0) {
        res.status(400).json({ error: 'Field order must be a non-negative integer' });
        return;
      }
      field.order = numericOrder;
    }

    if (req.body?.type !== undefined) {
      if (!allowedTypes.includes(req.body.type)) {
        res.status(400).json({ error: 'Invalid field type' });
        return;
      }
      field.type = req.body.type;
    }

    if (req.body?.tagId !== undefined) {
      const nextTagId = sanitizeText(req.body.tagId);
      if (!nextTagId) {
        const application = db.applications.find((entry) => entry.id === field.applicationId);
        const defaultTag = application ? ensureDefaultTag(db, application) : null;
        field.tagId = defaultTag?.id || null;
        field.tagName = defaultTag?.name || 'General';
      } else {
        const matchedTag = db.tags.find((tag) => tag.id === nextTagId && tag.applicationId === field.applicationId);
        if (!matchedTag) {
          res.status(400).json({ error: 'Tag not found for this application' });
          return;
        }
        field.tagId = matchedTag.id;
        field.tagName = matchedTag.name;
      }
    }

    writeDb(db);
    logUpdateSuccess('field', id, field, req.user);
    sendUpdateSuccess(res, field);
  };

  server.put('/api/field/:id', authRequired, requireRole('admin'), updateFieldHandler);
  server.patch('/api/field/:id', authRequired, requireRole('admin'), updateFieldHandler);
  server.put('/api/fields/:id', authRequired, requireRole('admin'), updateFieldHandler);
  server.patch('/api/fields/:id', authRequired, requireRole('admin'), updateFieldHandler);

  const updateRecordDataHandler = (req, res) => {
    const { id } = req.params;
    if (!isNonEmptyId(id)) {
      logUpdateIssue('record', 'Invalid ID', { id });
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      logUpdateIssue('record', 'Invalid request body', { id, bodyType: typeof req.body });
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    logUpdateAttempt('record', id, req.body, req.user);

    const db = readDb();
    const record = db.records.find((entry) => entry.id === id);
    if (!record) {
      logUpdateIssue('record', 'Record not found', { id });
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const applicationFields = db.fields.filter((field) => field.applicationId === record.applicationId);
    const patchValues = req.body?.values;
    if (!patchValues || typeof patchValues !== 'object') {
      logUpdateIssue('record', 'Invalid values payload', { id, body: req.body });
      res.status(400).json({ error: 'values object is required' });
      return;
    }

    applicationFields.forEach((field) => {
      if (!(field.id in patchValues)) return;
      const incomingValue = patchValues[field.id];

      if (field.type === 'text') {
        record.values[field.id] = sanitizeText(incomingValue);
        return;
      }

      const existingFile = record.values[field.id];
      if (!existingFile || typeof existingFile !== 'object') return;

      const nextFileName = sanitizeText(incomingValue?.originalname ?? existingFile.originalname);
      const nextDescription = sanitizeText(incomingValue?.description ?? existingFile.description);
      record.values[field.id] = {
        ...existingFile,
        originalname: nextFileName || existingFile.originalname,
        description: nextDescription
      };
    });

    writeDb(db);
    logUpdateSuccess('record', id, { values: record.values }, req.user);
    sendUpdateSuccess(res, record);
  };

  server.put('/api/data/:id', authRequired, requireRole('admin'), updateRecordDataHandler);
  server.patch('/api/data/:id', authRequired, requireRole('admin'), updateRecordDataHandler);
  server.put('/api/records/:id', authRequired, requireRole('admin'), updateRecordDataHandler);
  server.patch('/api/records/:id', authRequired, requireRole('admin'), updateRecordDataHandler);

  const updateUserHandler = (req, res) => {
    const { id } = req.params;
    if (!isNonEmptyId(id)) {
      logUpdateIssue('user', 'Invalid ID', { id });
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      logUpdateIssue('user', 'Invalid request body', { id, bodyType: typeof req.body });
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    logUpdateAttempt('user', id, req.body, req.user);

    const db = readDb();
    const user = db.users.find((entry) => entry.id === id);

    if (!user) {
      logUpdateIssue('user', 'User not found', { id });
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (req.body?.username !== undefined) {
      const nextUsername = sanitizeText(req.body.username);
      if (!nextUsername) {
        res.status(400).json({ error: 'Username cannot be empty' });
        return;
      }
      const usernameTaken = db.users.some((entry) => entry.username === nextUsername && entry.id !== id);
      if (usernameTaken) {
        res.status(409).json({ error: 'Username already exists' });
        return;
      }
      user.username = nextUsername;
    }

    if (req.body?.password !== undefined) {
      const password = String(req.body.password || '');
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }
      user.passwordHash = hashPassword(password);
    }

    writeDb(db);
    logUpdateSuccess('user', id, { username: user.username, passwordUpdated: req.body?.password !== undefined }, req.user);
    sendUpdateSuccess(res, { id: user.id, username: user.username, role: user.role });
  };

  server.put('/api/user/:id', authRequired, requireRole('admin'), updateUserHandler);
  server.patch('/api/user/:id', authRequired, requireRole('admin'), updateUserHandler);
  server.put('/api/users/:id', authRequired, requireRole('admin'), updateUserHandler);
  server.patch('/api/users/:id', authRequired, requireRole('admin'), updateUserHandler);

  server.delete('/api/company/:id', authRequired, requireRole('admin'), requireDeleteConfirmation, (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const deletion = deleteCompanyById(db, id, req.user);
    if (deletion.error) {
      res.status(deletion.status).json({ error: deletion.error });
      return;
    }

    writeDb(db);

    res.json({ ok: true, deletedId: id, entity: 'company' });
  });

  server.delete('/api/application/:id', authRequired, requireRole('admin'), requireDeleteConfirmation, (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const deletion = deleteApplicationById(db, id, req.user);
    if (deletion.error) {
      res.status(deletion.status).json({ error: deletion.error });
      return;
    }

    writeDb(db);

    res.json({ ok: true, deletedId: id, entity: 'application' });
  });

  server.delete('/api/field/:id', authRequired, requireRole('admin'), requireDeleteConfirmation, (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const deletion = deleteFieldById(db, id, req.user);
    if (deletion.error) {
      res.status(deletion.status).json({ error: deletion.error });
      return;
    }

    writeDb(db);

    res.json({ ok: true, deletedId: id, entity: 'field' });
  });

  server.delete('/api/data/:id', authRequired, requireRole('admin'), requireDeleteConfirmation, (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const deletion = deleteRecordById(db, id, req.user);
    if (deletion.error) {
      res.status(deletion.status).json({ error: deletion.error });
      return;
    }

    writeDb(db);

    res.json({ ok: true, deletedId: id, entity: 'data' });
  });

  server.delete('/api/users/:id', authRequired, requireRole('admin'), requireDeleteConfirmation, (req, res) => {
    const id = sanitizeText(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    if (id === req.user.id) {
      res.status(403).json({ error: 'You cannot delete your own active account' });
      return;
    }

    const db = readDb();
    const deletion = deleteUserById(db, id, req.user);
    if (deletion.error) {
      res.status(deletion.status).json({ error: deletion.error });
      return;
    }

    writeDb(db);

    res.status(200).json({ success: true, message: 'User deleted successfully.' });
  });

  server.get('/api/browse', authRequired, requireRole('admin'), (req, res) => {
    const { company = '', application = '' } = req.query;
    const db = readDb();

    const companies = db.companies
      .filter((c) => c.name.toLowerCase().includes(company.toLowerCase()))
      .map((c) => {
        const apps = db.applications
          .filter((a) => a.companyId === c.id && a.name.toLowerCase().includes(application.toLowerCase()))
          .map((a) => {
            const fields = db.fields.filter((f) => f.applicationId === a.id);
            const records = db.records.filter((r) => r.applicationId === a.id);
            return { ...a, fields, records };
          });
        return { ...c, applications: apps };
      })
      .filter((c) => c.applications.length > 0 || !application);

    res.json(companies);
  });

  server.all('*', (req, res) => handle(req, res));

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`> Ready on http://localhost:${port}`);
  });
});
