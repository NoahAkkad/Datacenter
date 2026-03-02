const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const next = require('next');
const { readDb, withDb, nextId } = require('./lib/db');
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

  server.get('/api/companies', authRequired, (req, res) => {
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
    const { name, type } = req.body;
    const allowedTypes = ['text', 'pdf', 'image'];

    if (!allowedTypes.includes(type)) {
      res.status(400).json({ error: 'Invalid field type' });
      return;
    }

    const db = readDb();
    if (!db.applications.find((a) => a.id === applicationId)) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    const field = { id: nextId('fld'), applicationId, name, type, createdAt: new Date().toISOString() };
    withDb((current) => {
      current.fields.push(field);
      return current;
    });

    res.status(201).json(field);
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

  server.get('/api/browse', authRequired, (req, res) => {
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
