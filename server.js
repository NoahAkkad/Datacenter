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


function normalizeRecordFields(fields, recordValues = {}) {
  return fields
    .map((field) => {
      const rawValue = recordValues[field.id];
      if (!rawValue) return null;

      if (field.type === 'text') {
        return { label: field.name, type: 'text', value: String(rawValue) };
      }

      return {
        label: field.name,
        type: field.type,
        fileUrl: rawValue.url
      };
    })
    .filter(Boolean);
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
          fields: db.fields.filter((field) => field.applicationId === appEntry.id),
          records: db.records.filter((record) => record.applicationId === appEntry.id)
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
        name: appEntry.name
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
    const records = db.records
      .filter((record) => record.applicationId === application.id)
      .map((record) => ({
        createdAt: record.createdAt,
        fields: normalizeRecordFields(fields, record.values)
      }));

    res.json({
      id: application.id,
      name: application.name,
      records
    });
  });

  server.post('/api/companies', authRequired, requireRole('admin'), (req, res) => {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Company name is required' });
      return;
    }

    const company = { id: nextId('cmp'), name, createdAt: new Date().toISOString() };
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

    const application = { id: nextId('app'), companyId, name, createdAt: new Date().toISOString() };
    withDb((current) => {
      current.applications.push(application);
      return current;
    });

    res.status(201).json(application);
  });

  server.post('/api/applications/:applicationId/fields', authRequired, requireRole('admin'), (req, res) => {
    const { applicationId } = req.params;
    const { name, type, applicationIds = [] } = req.body;
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

    const missingApplication = targetApplicationIds.find((id) => !db.applications.find((a) => a.id === id));
    if (missingApplication) {
      res.status(404).json({ error: `Application not found: ${missingApplication}` });
      return;
    }

    const createdAt = new Date().toISOString();
    const fieldsToCreate = targetApplicationIds.map((targetApplicationId) => ({
      id: nextId('fld'),
      applicationId: targetApplicationId,
      name: nextName,
      type,
      createdAt
    }));

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

    const record = {
      id: nextId('rec'),
      applicationId,
      values,
      createdAt: new Date().toISOString()
    };

    withDb((current) => {
      current.records.push(record);
      return current;
    });

    res.status(201).json(record);
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

  server.put('/api/company/:id', authRequired, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const nextName = sanitizeText(req.body?.name);
    if (!nextName) {
      res.status(400).json({ error: 'Company name is required' });
      return;
    }

    const db = readDb();
    const company = db.companies.find((entry) => entry.id === id);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    company.name = nextName;
    writeDb(db);
    res.json(company);
  });

  server.put('/api/application/:id', authRequired, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const nextName = sanitizeText(req.body?.name);
    if (!nextName) {
      res.status(400).json({ error: 'Application name is required' });
      return;
    }

    const db = readDb();
    const application = db.applications.find((entry) => entry.id === id);
    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    application.name = nextName;
    writeDb(db);
    res.json(application);
  });

  server.put('/api/field/:id', authRequired, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const allowedTypes = ['text', 'pdf', 'image'];
    const db = readDb();
    const field = db.fields.find((entry) => entry.id === id);

    if (!field) {
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

    writeDb(db);
    res.json(field);
  });

  server.put('/api/data/:id', authRequired, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const record = db.records.find((entry) => entry.id === id);
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const applicationFields = db.fields.filter((field) => field.applicationId === record.applicationId);
    const patchValues = req.body?.values;
    if (!patchValues || typeof patchValues !== 'object') {
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
    res.json(record);
  });

  server.put('/api/user/:id', authRequired, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const user = db.users.find((entry) => entry.id === id);

    if (!user) {
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
    res.json({ id: user.id, username: user.username, role: user.role });
  });

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
