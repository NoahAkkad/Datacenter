import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const port = 3111;
const baseUrl = `http://127.0.0.1:${port}`;
const dbPath = path.join(process.cwd(), 'data', 'db.json');
const hadDb = fs.existsSync(dbPath);
const originalDb = hadDb ? fs.readFileSync(dbPath, 'utf-8') : '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(pathname, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(cookie ? { Cookie: cookie } : {})
    }
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  return { response, payload };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: String(port), NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', () => {});
server.stderr.on('data', () => {});

try {
  for (let i = 0; i < 120; i += 1) {
    try {
      const probe = await fetch(`${baseUrl}/api/auth/me`);
      if (probe.status === 401) break;
    } catch {}
    await sleep(200);
  }

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123', portal: 'admin' })
  });
  assert(adminLogin.response.ok, 'Admin login failed');
  const adminCookie = adminLogin.response.headers.get('set-cookie')?.split(';')[0] || '';
  assert(adminCookie, 'Missing admin cookie');

  const companyCreate = await request('/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Company' })
  }, adminCookie);
  assert(companyCreate.response.ok, 'Create company failed');
  const companyId = companyCreate.payload.id;

  const appCreate = await request(`/api/companies/${companyId}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Initial Application' })
  }, adminCookie);
  assert(appCreate.response.ok, 'Create application failed');
  const appId = appCreate.payload.id;

  const textFieldCreate = await request(`/api/applications/${appId}/fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Title', type: 'text' })
  }, adminCookie);
  assert(textFieldCreate.response.ok, 'Create text field failed');

  const fileFieldCreate = await request(`/api/applications/${appId}/fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Spec PDF', type: 'pdf' })
  }, adminCookie);
  assert(fileFieldCreate.response.ok, 'Create file field failed');

  const textFieldId = textFieldCreate.payload.id;
  const fileFieldId = fileFieldCreate.payload.id;

  const formData = new FormData();
  formData.append('values', JSON.stringify({
    [textFieldId]: 'Before Edit',
    [fileFieldId]: {
      filename: 'dummy.pdf',
      originalname: 'Original Spec',
      mimetype: 'application/pdf',
      url: '/uploads/dummy.pdf'
    }
  }));

  const recordCreate = await request(`/api/applications/${appId}/records`, {
    method: 'POST',
    body: formData
  }, adminCookie);
  assert(recordCreate.response.ok, 'Create record failed');
  const recordId = recordCreate.payload.id;

  const userCreate = await request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'readonly_tester', password: 'password1', role: 'user' })
  }, adminCookie);
  assert(userCreate.response.ok, 'Create user failed');
  const userId = userCreate.payload.id;

  const updates = [
    request(`/api/companies/${companyId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Updated Company' }) }, adminCookie),
    request(`/api/applications/${appId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Updated Application' }) }, adminCookie),
    request(`/api/fields/${textFieldId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Updated Label', label: 'UI Label' }) }, adminCookie),
    request(`/api/records/${recordId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: { [textFieldId]: 'After Edit', [fileFieldId]: { originalname: 'Updated Spec', description: 'latest' } } }) }, adminCookie),
    request(`/api/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'readonly_renamed', password: 'password2' }) }, adminCookie)
  ];

  const [companyUpdate, appUpdate, fieldUpdate, recordUpdate, userUpdate] = await Promise.all(updates);
  [companyUpdate, appUpdate, fieldUpdate, recordUpdate, userUpdate].forEach((entry, index) => {
    assert(entry.response.ok, `Update request ${index + 1} failed`);
    assert(entry.payload.success === true, `Update request ${index + 1} did not return success payload`);
  });

  const invalidId = await request('/api/companies/does_not_exist', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Nope' })
  }, adminCookie);
  assert(invalidId.response.status === 404, 'Invalid ID should return 404');

  const missingField = await request(`/api/companies/${companyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '' })
  }, adminCookie);
  assert(missingField.response.status === 400, 'Missing required field should return 400');

  const userLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'readonly_renamed', password: 'password2', portal: 'user' })
  });
  assert(userLogin.response.ok, 'User login failed');
  const userCookie = userLogin.response.headers.get('set-cookie')?.split(';')[0] || '';

  const forbiddenUpdate = await request(`/api/companies/${companyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Forbidden Attempt' })
  }, userCookie);
  assert(forbiddenUpdate.response.status === 403, 'Non-admin update should return 403');

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  assert(db.companies.find((c) => c.id === companyId)?.name === 'Updated Company', 'Company not persisted in DB');
  assert(db.applications.find((a) => a.id === appId)?.name === 'Updated Application', 'Application not persisted in DB');
  assert(db.fields.find((f) => f.id === textFieldId)?.name === 'Updated Label', 'Field not persisted in DB');
  const savedRecord = db.records.find((r) => r.id === recordId);
  assert(savedRecord?.values?.[textFieldId] === 'After Edit', 'Text record value not persisted in DB');
  assert(savedRecord?.values?.[fileFieldId]?.originalname === 'Updated Spec', 'File metadata not persisted in DB');
  assert(db.users.find((u) => u.id === userId)?.username === 'readonly_renamed', 'User rename not persisted in DB');

  console.log('All update route scenarios passed.');
} finally {
  server.kill('SIGTERM');
  if (hadDb) {
    fs.writeFileSync(dbPath, originalDb);
  } else if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}
