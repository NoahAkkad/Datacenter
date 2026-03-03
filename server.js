const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const next = require('next');
const { readDb, writeDb, withDb, nextId } = require('./lib/db');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./lib/auth');
const { PRESET_FIELD_TYPES, getTagPresets, getPresetByKey } = require('./lib/tagPresetLibrary');

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

function normalizeLinkValue(value) {
  const trimmed = sanitizeText(value);
  if (!trimmed) {
    return { valid: true, value: '' };
  }

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, value: '' };
    }
    return { valid: true, value: normalized };
  } catch {
    return { valid: false, value: '' };
  }
}

function normalizeFieldName(value) {
  return sanitizeText(value).toLowerCase();
}

function normalizeNumberValue(value) {
  const trimmed = sanitizeText(value);
  if (!trimmed) {
    return { valid: true, value: '' };
  }

  const normalized = Number(trimmed);
  if (!Number.isFinite(normalized)) {
    return { valid: false, value: '' };
  }

  return { valid: true, value: String(normalized) };
}

function normalizeTagName(value) {
  return sanitizeText(value).toLowerCase();
}

const TAG_SCOPES = {
  APPLICATION: 'application',
  COMPANY: 'company',
  GLOBAL: 'global'
};

const TAG_SCOPE_TYPES = {
  COMPANY: 'company',
  GLOBAL_COMPANY: 'global_company',
  GLOBAL_SYSTEM: 'global_system'
};

function toScopeType(scope) {
  if (scope === TAG_SCOPES.COMPANY) return TAG_SCOPE_TYPES.GLOBAL_COMPANY;
  if (scope === TAG_SCOPES.GLOBAL) return TAG_SCOPE_TYPES.GLOBAL_SYSTEM;
  return TAG_SCOPE_TYPES.COMPANY;
}

function scopePriority(scope) {
  const scopeType = toScopeType(scope);
  if (scopeType === TAG_SCOPE_TYPES.COMPANY) return 0;
  if (scopeType === TAG_SCOPE_TYPES.GLOBAL_COMPANY) return 1;
  return 2;
}

function scopeDisplayLabel(scope) {
  const scopeType = toScopeType(scope);
  if (scopeType === TAG_SCOPE_TYPES.GLOBAL_COMPANY) return 'Company Global';
  if (scopeType === TAG_SCOPE_TYPES.GLOBAL_SYSTEM) return 'System Global';
  return 'Company';
}

function normalizeTagScope(scope) {
  const value = sanitizeText(scope).toLowerCase();
  if (Object.values(TAG_SCOPES).includes(value)) {
    return value;
  }
  return '';
}

function resolveTagScope(tag = {}) {
  const explicitScope = normalizeTagScope(tag.scope);
  if (explicitScope) {
    return explicitScope;
  }
  if (tag.allApplications === true) {
    return TAG_SCOPES.COMPANY;
  }
  return TAG_SCOPES.APPLICATION;
}

function isTagVisibleForApplication(tag, application) {
  const scope = resolveTagScope(tag);
  if (scope === TAG_SCOPES.GLOBAL) {
    return true;
  }
  if (!application) {
    return false;
  }
  if (scope === TAG_SCOPES.COMPANY) {
    return tag.companyId === application.companyId;
  }
  return tag.applicationId === application.id;
}

function normalizeTagEntity(tag, now = new Date().toISOString()) {
  const scopedTag = { ...ensureTimestamps(tag, now) };
  scopedTag.scope = resolveTagScope(scopedTag);
  scopedTag.scopeType = toScopeType(scopedTag.scope);

  if (scopedTag.scope === TAG_SCOPES.GLOBAL) {
    scopedTag.companyId = null;
    scopedTag.company_id = null;
    scopedTag.applicationId = null;
    scopedTag.allApplications = false;
    return scopedTag;
  }

  if (scopedTag.scope === TAG_SCOPES.COMPANY) {
    scopedTag.applicationId = null;
    scopedTag.allApplications = true;
    scopedTag.company_id = scopedTag.companyId;
    return scopedTag;
  }

  scopedTag.allApplications = false;
  scopedTag.company_id = scopedTag.companyId;
  return scopedTag;
}

function buildPresetFieldsForTag(db, tag, applicationId, preset) {
  const tagScope = resolveTagScope(tag);
  const scopedApplicationId = tagScope === TAG_SCOPES.APPLICATION ? applicationId : null;
  const existingFields = db.fields.filter((field) => field.tagId === tag.id);
  const existingNames = new Set(existingFields.map((field) => normalizeFieldName(field.name)));
  const now = new Date().toISOString();
  const createdFields = [];
  const skippedFields = [];

  for (const presetField of preset.fields) {
    const normalizedFieldType = sanitizeText(presetField.type).toLowerCase();
    if (!PRESET_FIELD_TYPES.includes(normalizedFieldType)) {
      skippedFields.push(presetField.name);
      continue;
    }

    if (existingNames.has(normalizeFieldName(presetField.name))) {
      skippedFields.push(presetField.name);
      continue;
    }

    const field = {
      id: nextId('fld'),
      applicationId: scopedApplicationId,
      companyId: tagScope === TAG_SCOPES.GLOBAL ? null : tag.companyId,
      allApplications: tagScope === TAG_SCOPES.COMPANY,
      scope: tagScope,
      scope_type: toScopeType(tagScope),
      name: sanitizeText(presetField.name),
      type: normalizedFieldType,
      tagId: tag.id,
      tag_id: tag.id,
      tagName: tag.name,
      createdAt: now,
      updatedAt: now
    };

    createdFields.push(field);
    existingNames.add(normalizeFieldName(presetField.name));
  }

  return { createdFields, skippedFields };
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

  const existingDefault = db.tags.find((tag) => tag.applicationId === application.id
    && ['general', 'uncategorized'].includes(normalizeTagName(tag.name)));
  if (existingDefault) {
    return existingDefault;
  }

  const now = new Date().toISOString();
  const fallbackTag = {
    id: nextId('tag'),
    name: 'Uncategorized',
    description: 'Default tag for fields without an explicit category.',
    scope: TAG_SCOPES.APPLICATION,
    applicationId: application.id,
    companyId: application.companyId,
    allApplications: false,
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
      const matchedTag = tagById.get(field.tagId) || null;
      const tagLabel = matchedTag?.name || field.tagName || 'Uncategorized';
      const scope = resolveTagScope(matchedTag || {});
      const fieldMetadata = {
        createdAt: field.createdAt || null,
        updatedAt: field.updatedAt || null
      };

      if (field.type === 'text') {
        return {
          label: field.name,
          type: 'text',
          value: rawValue === undefined || rawValue === null ? '—' : String(rawValue),
          tagId: matchedTag?.id || null,
          tagName: tagLabel,
          tagScope: scope,
          tagScopeType: toScopeType(scope),
          ...fieldMetadata
        };
      }

      if (field.type === 'number') {
        return {
          label: field.name,
          type: 'number',
          value: rawValue === undefined || rawValue === null ? '—' : String(rawValue),
          tagId: matchedTag?.id || null,
          tagName: tagLabel,
          tagScope: scope,
          tagScopeType: toScopeType(scope),
          ...fieldMetadata
        };
      }

      if (field.type === 'link') {
        return {
          label: field.name,
          type: 'link',
          value: rawValue === undefined || rawValue === null ? '' : String(rawValue),
          tagId: matchedTag?.id || null,
          tagName: tagLabel,
          tagScope: scope,
          tagScopeType: toScopeType(scope),
          ...fieldMetadata
        };
      }

      if (!rawValue || !rawValue.url) {
        return {
          label: field.name,
          type: field.type,
          fileUrl: '',
          tagId: matchedTag?.id || null,
          tagName: tagLabel,
          tagScope: scope,
          tagScopeType: toScopeType(scope),
          empty: true,
          ...fieldMetadata
        };
      }

      return {
        label: field.name,
        type: field.type,
        fileUrl: rawValue.url,
        tagId: matchedTag?.id || null,
        tagName: tagLabel,
        tagScope: scope,
        tagScopeType: toScopeType(scope),
        ...fieldMetadata
      };
    })
    .filter((field) => Boolean(field.tagId));
}

function tagsForApplication(db, application) {
  return (db.tags || []).filter((tag) => isTagVisibleForApplication(tag, application));
}

function fieldsForApplication(db, application) {
  const visibleTags = tagsForApplication(db, application);
  const visibleTagIds = new Set(visibleTags.map((tag) => tag.id));
  const fieldById = new Map();

  (db.fields || []).forEach((field) => {
    const visibleByTag = field.tagId && visibleTagIds.has(field.tagId);
    const visibleByLegacyScope = field.applicationId === application.id
      || (field.allApplications === true && field.companyId === application.companyId)
      || (field.scope === TAG_SCOPES.GLOBAL);

    if (visibleByTag || visibleByLegacyScope) {
      fieldById.set(field.id, field);
    }
  });

  return Array.from(fieldById.values());
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
    db.tags = db.tags.map((tag) => normalizeTagEntity(tag, now));
    db.fields = (db.fields || [])
      .map((field) => {
        const normalizedField = {
          ...field,
          allApplications: field.allApplications === true,
          scope: normalizeTagScope(field.scope) || (field.allApplications === true ? TAG_SCOPES.COMPANY : TAG_SCOPES.APPLICATION)
        };

        if (normalizedField.tagId) {
          const matchedTag = db.tags.find((tag) => tag.id === normalizedField.tagId);
          if (matchedTag) {
            normalizedField.tagName = matchedTag.name;
            normalizedField.scope = resolveTagScope(matchedTag);
            normalizedField.scopeType = toScopeType(normalizedField.scope);
            return normalizedField;
          }
        }

        const fallbackApplication = db.applications.find((entry) => entry.id === normalizedField.applicationId)
          || db.applications.find((entry) => entry.companyId === normalizedField.companyId);

        if (!fallbackApplication) {
          return null;
        }

        const fallbackTag = ensureDefaultTag(db, fallbackApplication);
        normalizedField.tagId = fallbackTag.id;
        normalizedField.tagName = fallbackTag.name;
        normalizedField.scope = TAG_SCOPES.APPLICATION;
        normalizedField.scopeType = toScopeType(TAG_SCOPES.APPLICATION);
        normalizedField.allApplications = false;
        normalizedField.applicationId = fallbackApplication.id;
        normalizedField.companyId = fallbackApplication.companyId;

        return normalizedField;
      })
      .filter(Boolean);

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
          tags: tagsForApplication(db, appEntry),
          fields: fieldsForApplication(db, appEntry),
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

    const fields = fieldsForApplication(db, application);
    const tags = tagsForApplication(db, application);
    const company = db.companies.find((entry) => entry.id === application.companyId);
    const mergedRecord = getConsolidatedRecord(db.records.filter((record) => record.applicationId === application.id));
    const normalizedFields = normalizeRecordFields(fields, tags, mergedRecord?.values || {});
    const records = [{
      createdAt: mergedRecord?.createdAt || null,
      updatedAt: mergedRecord?.updatedAt || null,
      fields: normalizedFields
    }];

    const fieldGroupsByTagId = normalizedFields.reduce((accumulator, field) => {
      if (!field.tagId) return accumulator;
      if (!accumulator[field.tagId]) {
        accumulator[field.tagId] = [];
      }
      accumulator[field.tagId].push(field);
      return accumulator;
    }, {});

    const groupedFields = tags
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        scope: resolveTagScope(tag),
        scopeType: toScopeType(resolveTagScope(tag)),
        scopeLabel: scopeDisplayLabel(resolveTagScope(tag)),
        company_id: tag.companyId ?? null,
        fields: fieldGroupsByTagId[tag.id] || []
      }))
      .filter((tagGroup) => tagGroup.fields.length > 0)
      .sort((a, b) => scopePriority(a.scope) - scopePriority(b.scope) || a.name.localeCompare(b.name));

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
      name: 'Uncategorized',
      description: 'Default tag for fields without an explicit category.',
      scope: TAG_SCOPES.APPLICATION,
      applicationId: application.id,
      companyId,
      allApplications: false,
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

    const tags = tagsForApplication(db, application)
      .map((tag) => {
        const scope = resolveTagScope(tag);
        return {
          ...tag,
          scope,
          scope_type: toScopeType(scope),
          company_id: tag.companyId ?? null,
          displayLabel: `${tag.name} (${scopeDisplayLabel(scope)})`
        };
      })
      .sort((a, b) => scopePriority(a.scope) - scopePriority(b.scope) || a.name.localeCompare(b.name));

    res.json({ tags });
  });

  server.post('/api/applications/:applicationId/tags', authRequired, requireRole('admin'), (req, res) => {
    const { applicationId } = req.params;
    const nextName = sanitizeText(req.body?.name);
    const nextDescription = sanitizeText(req.body?.description);
    const bodyScope = normalizeTagScope(req.body?.scope);
    const companyIdFromBody = sanitizeText(req.body?.companyId);
    const presetTemplate = getPresetByKey(req.body?.presetKey);
    const isLegacyAllApplications = applicationId === 'all';
    const requestedScope = bodyScope || (isLegacyAllApplications ? TAG_SCOPES.COMPANY : TAG_SCOPES.APPLICATION);
    const db = readDb();
    const application = requestedScope === TAG_SCOPES.APPLICATION ? db.applications.find((entry) => entry.id === applicationId) : null;
    const companyId = requestedScope === TAG_SCOPES.APPLICATION
      ? application?.companyId
      : (requestedScope === TAG_SCOPES.COMPANY ? companyIdFromBody : null);

    if (!nextName) {
      res.status(400).json({ error: 'Tag name is required' });
      return;
    }

    if (!Object.values(TAG_SCOPES).includes(requestedScope)) {
      res.status(400).json({ error: 'Invalid tag scope' });
      return;
    }

    if (requestedScope === TAG_SCOPES.APPLICATION && !application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    if (requestedScope === TAG_SCOPES.COMPANY) {
      if (!companyId) {
        res.status(400).json({ error: 'Company is required for company scope tags' });
        return;
      }
      if (!db.companies.find((entry) => entry.id === companyId)) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }
    }

    if (requestedScope === TAG_SCOPES.GLOBAL && req.body?.confirmGlobal !== true) {
      res.status(400).json({ error: 'Global tag creation requires explicit confirmation' });
      return;
    }

    const duplicate = (db.tags || []).find((entry) => {
      if (normalizeTagName(entry.name) !== normalizeTagName(nextName)) return false;
      const scope = resolveTagScope(entry);
      if (scope !== requestedScope) return false;
      if (scope === TAG_SCOPES.APPLICATION) return entry.applicationId === application.id;
      if (scope === TAG_SCOPES.COMPANY) return entry.companyId === companyId;
      return true;
    });

    if (duplicate) {
      res.status(409).json({ error: 'Tag name already exists in this scope' });
      return;
    }

    const now = new Date().toISOString();
    const tag = {
      id: nextId('tag'),
      name: nextName,
      description: nextDescription,
      scope: requestedScope,
      scope_type: toScopeType(requestedScope),
      applicationId: requestedScope === TAG_SCOPES.APPLICATION ? application.id : null,
      companyId: requestedScope === TAG_SCOPES.COMPANY ? companyId : (requestedScope === TAG_SCOPES.APPLICATION ? application.companyId : null),
      company_id: requestedScope === TAG_SCOPES.GLOBAL ? null : (requestedScope === TAG_SCOPES.COMPANY ? companyId : application.companyId),
      allApplications: requestedScope === TAG_SCOPES.COMPANY,
      createdAt: now,
      updatedAt: now
    };

    withDb((current) => {
      current.tags.push(tag);

      let presetResult = { createdFields: [], skippedFields: [] };
      if (presetTemplate) {
        presetResult = buildPresetFieldsForTag(current, tag, application?.id || null, presetTemplate);
        if (presetResult.createdFields.length > 0) {
          current.fields.push(...presetResult.createdFields);
        }
      }

      tag._presetResult = presetResult;
      return current;
    });

    const presetResult = tag._presetResult || { createdFields: [], skippedFields: [] };
    delete tag._presetResult;

    res.status(201).json({
      ...tag,
      preset: presetTemplate
        ? {
          key: presetTemplate.key,
          createdCount: presetResult.createdFields.length,
          skippedCount: presetResult.skippedFields.length,
          skippedFields: presetResult.skippedFields
        }
        : null
    });
  });

  server.get('/api/tag-presets', authRequired, requireRole('admin'), (_, res) => {
    res.json({ presets: getTagPresets() });
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

    const requestedScope = normalizeTagScope(req.body?.scope)
      || (req.body?.allApplications === true ? TAG_SCOPES.COMPANY : resolveTagScope(tag));
    const nextCompanyId = requestedScope === TAG_SCOPES.COMPANY
      ? sanitizeText(req.body?.companyId) || tag.companyId
      : (requestedScope === TAG_SCOPES.APPLICATION ? tag.companyId : null);
    const nextApplicationId = requestedScope === TAG_SCOPES.APPLICATION
      ? (sanitizeText(req.body?.applicationId) || tag.applicationId)
      : null;

    if (!Object.values(TAG_SCOPES).includes(requestedScope)) {
      res.status(400).json({ error: 'Invalid tag scope' });
      return;
    }

    if (requestedScope === TAG_SCOPES.APPLICATION && !db.applications.find((entry) => entry.id === nextApplicationId)) {
      res.status(400).json({ error: 'Valid applicationId is required for application scope tags' });
      return;
    }

    if (requestedScope === TAG_SCOPES.COMPANY && !db.companies.find((entry) => entry.id === nextCompanyId)) {
      res.status(400).json({ error: 'Valid companyId is required for company scope tags' });
      return;
    }

    if (requestedScope === TAG_SCOPES.GLOBAL && req.body?.confirmGlobal !== true) {
      res.status(400).json({ error: 'Global tag update requires explicit confirmation' });
      return;
    }

    const duplicate = (db.tags || []).find((entry) => {
      if (entry.id === id || normalizeTagName(entry.name) !== normalizeTagName(nextName)) return false;
      const scope = resolveTagScope(entry);
      if (scope !== requestedScope) return false;
      if (scope === TAG_SCOPES.APPLICATION) return entry.applicationId === nextApplicationId;
      if (scope === TAG_SCOPES.COMPANY) return entry.companyId === nextCompanyId;
      return true;
    });

    if (duplicate) {
      res.status(409).json({ error: 'Tag name already exists in this scope' });
      return;
    }

    tag.name = nextName;
    tag.description = nextDescription;
    tag.scope = requestedScope;
    tag.allApplications = requestedScope === TAG_SCOPES.COMPANY;
    tag.companyId = requestedScope === TAG_SCOPES.GLOBAL ? null : nextCompanyId;
    tag.applicationId = requestedScope === TAG_SCOPES.APPLICATION ? nextApplicationId : null;
    tag.updatedAt = new Date().toISOString();

    db.fields = db.fields.map((field) => {
      if (field.tagId !== tag.id) return field;
      const updatedField = {
        ...field,
        tagName: tag.name,
        scope: requestedScope,
        allApplications: requestedScope === TAG_SCOPES.COMPANY
      };

      if (requestedScope === TAG_SCOPES.APPLICATION) {
        updatedField.applicationId = tag.applicationId;
        updatedField.companyId = tag.companyId;
      }

      if (requestedScope === TAG_SCOPES.COMPANY) {
        updatedField.applicationId = null;
        updatedField.companyId = tag.companyId;
      }

      if (requestedScope === TAG_SCOPES.GLOBAL) {
        updatedField.applicationId = null;
        updatedField.companyId = null;
      }

      return updatedField;
    });

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
    if (linkedFields.length > 0) {
      res.status(409).json({
        error: 'Tag cannot be deleted while fields are attached. Reassign fields first.',
        linkedFieldCount: linkedFields.length
      });
      return;
    }

    db.tags = db.tags.filter((entry) => entry.id !== id);
    writeDb(db);
    res.json({ ok: true, deletedId: id, entity: 'tag' });
  });

  server.post('/api/applications/:applicationId/fields', authRequired, requireRole('admin'), (req, res) => {
    const { applicationId } = req.params;
    const { name, type, applicationIds = [], tagId } = req.body;
    const allowedTypes = PRESET_FIELD_TYPES;
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

    for (const targetApplicationId of targetApplicationIds) {
      const application = appById.get(targetApplicationId);
      let selectedTag = null;

      if (tagId) {
        selectedTag = db.tags.find((entry) => entry.id === sanitizeText(tagId)
          && isTagVisibleForApplication(entry, application));
      }
      if (!selectedTag) {
        res.status(400).json({ error: 'A valid tag selection is required for field creation' });
        return;
      }

      const tagScope = resolveTagScope(selectedTag);
      const scopedApplicationId = tagScope === TAG_SCOPES.APPLICATION ? targetApplicationId : null;
      const duplicate = db.fields.find((field) => field.applicationId === scopedApplicationId
        && field.tagId === selectedTag.id
        && normalizeFieldName(field.name) === normalizeFieldName(nextName));
      if (duplicate) {
        duplicateEntries.push({
          applicationId: scopedApplicationId,
          tagId: selectedTag.id,
          fieldId: duplicate.id,
          fieldName: duplicate.name
        });
        continue;
      }

      fieldsToCreate.push({
        id: nextId('fld'),
        applicationId: scopedApplicationId,
        companyId: tagScope === TAG_SCOPES.GLOBAL ? null : application.companyId,
        allApplications: tagScope === TAG_SCOPES.COMPANY,
        scope: tagScope,
        scope_type: toScopeType(tagScope),
        name: nextName,
        type,
        tagId: selectedTag.id,
        tag_id: selectedTag.id,
        tagName: selectedTag.name,
        createdAt
      });
    }

    if (duplicateEntries.length > 0) {
      res.status(409).json({
        error: 'A field with this name already exists inside this tag.',
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
    const application = db.applications.find((a) => a.id === applicationId);
    const applicationFields = application ? fieldsForApplication(db, application) : [];

    if (!application) {
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

    for (const field of applicationFields) {
      if (!(field.id in values)) {
        continue;
      }

      if (field.type === 'text') {
        values[field.id] = sanitizeText(values[field.id]);
        continue;
      }

      if (field.type === 'number') {
        const normalizedNumber = normalizeNumberValue(values[field.id]);
        if (!normalizedNumber.valid) {
          res.status(400).json({ error: `Invalid number for field: ${field.name}` });
          return;
        }
        values[field.id] = normalizedNumber.value;
        continue;
      }

      if (field.type === 'link') {
        const normalizedLink = normalizeLinkValue(values[field.id]);
        if (!normalizedLink.valid) {
          res.status(400).json({ error: `Invalid URL for field: ${field.name}` });
          return;
        }
        values[field.id] = normalizedLink.value;
      }
    }

    const files = req.files || [];
    applicationFields
      .filter((field) => ['pdf', 'image'].includes(field.type))
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

  server.get('/api/company/:id/applications', authRequired, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const company = db.companies.find((entry) => entry.id === id);

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const applications = db.applications
      .filter((application) => application.companyId === id)
      .map((application) => ({ id: application.id, name: application.name }));

    res.json({
      companyId: company.id,
      companyName: company.name,
      applications
    });
  });

  server.get('/api/company/:id/fields', authRequired, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const applicationId = sanitizeText(req.query.applicationId);
    const db = readDb();
    const company = db.companies.find((entry) => entry.id === id);

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    if (!applicationId) {
      res.json({
        companyId: company.id,
        companyName: company.name,
        applications: [],
        hasData: false
      });
      return;
    }

    const selectedApplication = db.applications.find((application) => application.id === applicationId && application.companyId === id);

    if (!selectedApplication) {
      res.status(404).json({ error: 'Application not found for selected company' });
      return;
    }

    const companyApplications = [selectedApplication];
    const applicationsPayload = companyApplications.map((application) => {
      const applicationTags = tagsForApplication(db, application);
      const applicationFields = fieldsForApplication(db, application)
        .map((field) => {
          const matchedTag = applicationTags.find((tag) => tag.id === field.tagId);
          return {
            ...field,
            tagId: matchedTag?.id || field.tagId || null,
            tagName: matchedTag?.name || field.tagName || 'Uncategorized'
          };
        });
      const latestRecord = db.records
        .filter((record) => record.applicationId === application.id)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];
      const normalizedFields = normalizeRecordFields(applicationFields, applicationTags, latestRecord?.values || {});
      const fieldGroupsByTagId = normalizedFields.reduce((accumulator, field) => {
        if (!field.tagId) return accumulator;
        if (!accumulator[field.tagId]) {
          accumulator[field.tagId] = [];
        }
        accumulator[field.tagId].push(field);
        return accumulator;
      }, {});
      const groupedFields = applicationTags
        .map((tag) => ({
          id: tag.id,
          name: tag.name,
          scope: resolveTagScope(tag),
          scopeType: toScopeType(resolveTagScope(tag)),
          scopeLabel: scopeDisplayLabel(resolveTagScope(tag)),
          company_id: tag.companyId ?? null,
          fields: fieldGroupsByTagId[tag.id] || []
        }))
        .filter((tagGroup) => tagGroup.fields.length > 0)
        .sort((a, b) => scopePriority(a.scope) - scopePriority(b.scope) || a.name.localeCompare(b.name));

      return {
        applicationId: application.id,
        applicationName: application.name,
        fields: applicationFields,
        groupedFields,
        values: latestRecord?.values || {},
        recordId: latestRecord?.id || null,
        recordCreatedAt: latestRecord?.createdAt || null,
        recordUpdatedAt: latestRecord?.updatedAt || null
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
    const allowedTypes = PRESET_FIELD_TYPES;
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
        res.status(400).json({ error: 'tagId is required' });
        return;
      } else {
        const fieldApplication = db.applications.find((entry) => entry.id === field.applicationId) || db.applications.find((entry) => entry.companyId === field.companyId);
        const matchedTag = db.tags.find((tag) => tag.id === nextTagId
          && isTagVisibleForApplication(tag, fieldApplication));
        if (!matchedTag) {
          res.status(400).json({ error: 'Tag not found for this application' });
          return;
        }
        const tagScope = resolveTagScope(matchedTag);
        field.tagId = matchedTag.id;
        field.tag_id = matchedTag.id;
        field.tagName = matchedTag.name;
        field.scope = tagScope;
        field.scope_type = toScopeType(tagScope);
        field.allApplications = tagScope === TAG_SCOPES.COMPANY;
        if (tagScope === TAG_SCOPES.APPLICATION) {
          field.applicationId = fieldApplication?.id || field.applicationId;
          field.companyId = fieldApplication?.companyId || field.companyId;
        }
        if (tagScope === TAG_SCOPES.COMPANY) {
          field.applicationId = null;
          field.companyId = matchedTag.companyId;
        }
        if (tagScope === TAG_SCOPES.GLOBAL) {
          field.applicationId = null;
          field.companyId = null;
        }
      }
    }

    if (req.body?.name !== undefined || req.body?.tagId !== undefined) {
      const duplicateName = db.fields.find((entry) => entry.id !== field.id
        && entry.applicationId === field.applicationId
        && entry.tagId === field.tagId
        && normalizeFieldName(entry.name) === normalizeFieldName(field.name));
      if (duplicateName) {
        res.status(409).json({ error: 'A field with this name already exists inside this tag.' });
        return;
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

    record.values = record.values || {};
    for (const field of applicationFields) {
      if (!(field.id in patchValues)) continue;
      const incomingValue = patchValues[field.id];

      if (field.type === 'text') {
        record.values[field.id] = sanitizeText(incomingValue);
        continue;
      }

      if (field.type === 'number') {
        const normalizedNumber = normalizeNumberValue(incomingValue);
        if (!normalizedNumber.valid) {
          res.status(400).json({ error: `Invalid number for field: ${field.name}` });
          return;
        }
        record.values[field.id] = normalizedNumber.value;
        continue;
      }

      if (field.type === 'link') {
        const normalizedLink = normalizeLinkValue(incomingValue);
        if (!normalizedLink.valid) {
          res.status(400).json({ error: `Invalid URL for field: ${field.name}` });
          return;
        }
        record.values[field.id] = normalizedLink.value;
        continue;
      }

      const existingFile = record.values[field.id];
      if (!existingFile || typeof existingFile !== 'object') continue;

      const nextFileName = sanitizeText(incomingValue?.originalname ?? existingFile.originalname);
      const nextDescription = sanitizeText(incomingValue?.description ?? existingFile.description);
      record.values[field.id] = {
        ...existingFile,
        originalname: nextFileName || existingFile.originalname,
        description: nextDescription
      };
    }

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
