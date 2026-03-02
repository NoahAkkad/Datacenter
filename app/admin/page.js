'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { DataTable } from '../../components/ui/table';

const navItems = [
  { key: 'companies', label: '🏢 Companies', endpoint: '/api/companies' },
  { key: 'applications', label: '🧩 Applications', endpoint: '/api/applications' },
  { key: 'fields', label: '🏷️ Dynamic Fields', endpoint: '/api/fields' },
  { key: 'users', label: '👥 Users', endpoint: '/api/users' },
  { key: 'upload', label: '📁 File Upload', endpoint: '/api/files' }
];

const initialTabState = { data: [], loading: false, error: '' };

export default function AdminPage() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState('companies');
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedApp, setSelectedApp] = useState('');
  const [recordTextValues, setRecordTextValues] = useState({});
  const [recordFiles, setRecordFiles] = useState({});
  const [statusMessage, setStatusMessage] = useState('');

  const [companyModal, setCompanyModal] = useState(false);
  const [appModal, setAppModal] = useState(false);
  const [fieldModal, setFieldModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, type: '', id: '', label: '' });

  const [companyName, setCompanyName] = useState('');
  const [appName, setAppName] = useState('');
  const [fieldForm, setFieldForm] = useState({ name: '', type: 'text' });
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  const [checkingSession, setCheckingSession] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [tabData, setTabData] = useState({
    companies: initialTabState,
    applications: initialTabState,
    fields: initialTabState,
    users: initialTabState,
    upload: initialTabState
  });

  useEffect(() => {
    const validateSession = async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.replace('/login?portal=admin');
        return;
      }

      const payload = await response.json();
      const user = payload.data;
      if (user?.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }
      setCheckingSession(false);
    };

    validateSession();
  }, [router]);

  const fetchTab = async (tabKey, force = false) => {
    const item = navItems.find((entry) => entry.key === tabKey);
    if (!item) return;

    if (!force && tabData[tabKey].data.length) return;

    setTabData((current) => ({
      ...current,
      [tabKey]: { ...current[tabKey], loading: true, error: '' }
    }));

    try {
      const response = await fetch(item.endpoint);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || `Unable to load ${tabKey}.`);
      }

      const normalized = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.data?.applications)
          ? payload.data.applications
          : Array.isArray(payload.data?.users)
            ? payload.data.users
            : [];

      setTabData((current) => ({
        ...current,
        [tabKey]: { data: normalized, loading: false, error: '' }
      }));
    } catch (error) {
      setTabData((current) => ({
        ...current,
        [tabKey]: { ...current[tabKey], loading: false, error: error.message || 'Unexpected error' }
      }));
    }
  };

  useEffect(() => {
    if (checkingSession) return;
    fetchTab(active);
  }, [checkingSession, active]);

  const refreshAll = async () => {
    await Promise.all(navItems.map((item) => fetchTab(item.key, true)));
  };

  const companies = tabData.companies.data;
  const applications = tabData.applications.data;
  const fields = tabData.fields.data;
  const users = tabData.users.data;
  const files = tabData.upload.data;

  const selectedApplication = useMemo(
    () => applications.find((entry) => entry.id === selectedApp),
    [applications, selectedApp]
  );

  const onLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      window.localStorage.removeItem('authToken');
      window.sessionStorage.removeItem('authToken');
      setIsLoggingOut(false);
      setLogoutConfirmOpen(false);
      setProfileMenuOpen(false);
      router.replace('/login?portal=admin');
      router.refresh();
    }
  };

  const createCompany = async () => {
    await fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: companyName }) });
    setCompanyModal(false);
    setCompanyName('');
    refreshAll();
  };

  const createApp = async () => {
    await fetch(`/api/companies/${selectedCompany}/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: appName }) });
    setAppModal(false);
    setAppName('');
    refreshAll();
  };

  const createField = async () => {
    await fetch(`/api/applications/${selectedApp}/fields`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fieldForm) });
    setFieldModal(false);
    setFieldForm({ name: '', type: 'text' });
    refreshAll();
  };

  const createUser = async () => {
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, role: 'user' }) });
    setUserModal(false);
    setUserForm({ username: '', password: '' });
    fetchTab('users', true);
  };

  const createRecord = async () => {
    const formData = new FormData();
    formData.append('values', JSON.stringify(recordTextValues));
    Object.entries(recordFiles).forEach(([fieldId, file]) => {
      if (file) formData.append(fieldId, file);
    });
    await fetch(`/api/applications/${selectedApp}/records`, { method: 'POST', body: formData });
    setRecordTextValues({});
    setRecordFiles({});
    fetchTab('upload', true);
  };

  const openDelete = (type, id, label) => setConfirmModal({ open: true, type, id, label });

  const optimisticDelete = (type, id) => {
    if (type === 'company') setTabData((current) => ({ ...current, companies: { ...current.companies, data: current.companies.data.filter((entry) => entry.id !== id) } }));
    if (type === 'application') setTabData((current) => ({ ...current, applications: { ...current.applications, data: current.applications.data.filter((entry) => entry.id !== id) } }));
    if (type === 'field') setTabData((current) => ({ ...current, fields: { ...current.fields, data: current.fields.data.filter((entry) => entry.id !== id) } }));
    if (type === 'data') setTabData((current) => ({ ...current, upload: { ...current.upload, data: current.upload.data.filter((entry) => entry.id !== id) } }));
  };

  const executeDelete = async () => {
    const { type, id } = confirmModal;
    const endpointMap = {
      company: `/api/company/${id}`,
      application: `/api/application/${id}`,
      field: `/api/field/${id}`,
      data: `/api/data/${id}`
    };

    setDeleting(true);
    setStatusMessage('');
    try {
      const response = await fetch(endpointMap[type], {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error || 'Delete failed.');
        return;
      }
      optimisticDelete(type, id);
      setConfirmModal({ open: false, type: '', id: '', label: '' });
      setStatusMessage('Deletion completed successfully.');
      refreshAll();
    } catch {
      setStatusMessage('Delete request failed. Please retry.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return { companies, applications, fields, users, files };

    return {
      companies: companies.filter((entry) => entry.name.toLowerCase().includes(q)),
      applications: applications.filter((entry) => `${entry.name} ${entry.companyName || ''}`.toLowerCase().includes(q)),
      fields: fields.filter((entry) => `${entry.name} ${entry.type} ${entry.applicationName || ''} ${entry.companyName || ''}`.toLowerCase().includes(q)),
      users: users.filter((entry) => `${entry.username} ${entry.role}`.toLowerCase().includes(q)),
      files: files.filter((entry) => `${entry.fileName} ${entry.applicationName || ''} ${entry.companyName || ''} ${entry.fieldName || ''}`.toLowerCase().includes(q))
    };
  }, [applications, companies, fields, files, search, users]);

  if (checkingSession) {
    return (
      <main className="page-center">
        <Card>Validating session...</Card>
      </main>
    );
  }

  const activeState = tabData[active];

  return (
    <main className="admin-shell">
      <aside className={`sidebar ${collapsed ? 'compact' : ''}`}>
        <Button variant="secondary" onClick={() => setCollapsed((value) => !value)}>{collapsed ? '➡️' : '⬅️'}</Button>
        <div className="stack sidebar-nav">
          {navItems.map((item) => (
            <button key={item.key} onClick={() => setActive(item.key)} className={`nav-btn ${active === item.key ? 'active' : ''}`}>
              {collapsed ? item.label.split(' ')[0] : item.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div>
            <h1 className="login-title">Admin Dashboard</h1>
            <p className="subtitle">Structured management for all data center entities.</p>
          </div>
          <div className="profile">
            <button className="profile-trigger" onClick={() => setProfileMenuOpen((value) => !value)}>
              <strong>Administrator</strong>
              <p className="subtitle">admin@datacenter.io</p>
            </button>
            {profileMenuOpen ? (
              <div className="profile-menu">
                <button className="menu-item danger" onClick={() => setLogoutConfirmOpen(true)}>Logout</button>
              </div>
            ) : null}
          </div>
        </header>

        {statusMessage ? <p className="error">{statusMessage}</p> : null}

        <Card>
          <div className="row">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${active}`} />
            <Button onClick={() => setCompanyModal(true)}>New Company</Button>
            <Button variant="secondary" onClick={() => setAppModal(true)}>New Application</Button>
            <Button variant="secondary" onClick={() => setFieldModal(true)}>New Field</Button>
            <Button variant="secondary" onClick={() => setUserModal(true)}>New User</Button>
          </div>
        </Card>

        {activeState.error ? <p className="error section-gap">{activeState.error}</p> : null}
        {activeState.loading ? <Card className="section-gap">Loading {active}...</Card> : null}

        {!activeState.loading && active === 'companies' ? (
          <Card className="stack section-gap">
            <h2>Companies Management</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Company Name' },
                { key: 'apps', label: 'Applications', render: (row) => row.applications?.length || 0 },
                { key: 'actions', label: 'Actions', render: (row) => <Button onClick={() => openDelete('company', row.id, row.name)}>Delete</Button> }
              ]}
              data={filteredRows.companies}
            />
          </Card>
        ) : null}

        {!activeState.loading && active === 'applications' ? (
          <Card className="stack section-gap">
            <h2>Applications per Company</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Application' },
                { key: 'companyName', label: 'Company' },
                { key: 'fieldCount', label: 'Fields' },
                { key: 'actions', label: 'Actions', render: (row) => <Button onClick={() => openDelete('application', row.id, row.name)}>Delete</Button> }
              ]}
              data={filteredRows.applications}
            />
          </Card>
        ) : null}

        {!activeState.loading && active === 'fields' ? (
          <Card className="stack section-gap">
            <h2>Dynamic Fields Management</h2>
            {filteredRows.fields.map((field) => (
              <div className="row" key={field.id}>
                <Badge>{field.name} · {field.type} · {field.applicationName} · {field.companyName}</Badge>
                <Button variant="secondary" onClick={() => openDelete('field', field.id, field.name)}>Delete</Button>
              </div>
            ))}
          </Card>
        ) : null}

        {!activeState.loading && active === 'users' ? (
          <Card className="stack section-gap">
            <h2>Users</h2>
            <DataTable
              columns={[
                { key: 'username', label: 'Username' },
                { key: 'role', label: 'Role' },
                { key: 'createdAt', label: 'Created At', render: (row) => new Date(row.createdAt).toLocaleString() }
              ]}
              data={filteredRows.users}
            />
          </Card>
        ) : null}

        {!activeState.loading && active === 'upload' ? (
          <div className="grid-2 section-gap">
            <Card className="stack">
              <h2>File Upload (PDF & Images)</h2>
              <select className="select" value={selectedApp} onChange={(event) => setSelectedApp(event.target.value)}>
                <option value="">Select application</option>
                {applications.map((app) => <option key={app.id} value={app.id}>{app.name} · {app.companyName}</option>)}
              </select>
              {selectedApplication?.fields?.map((field) => (
                <div key={field.id}>
                  <strong>{field.name}</strong>
                  {field.type === 'text'
                    ? <Input onChange={(event) => setRecordTextValues({ ...recordTextValues, [field.id]: event.target.value })} />
                    : <Input type="file" accept={field.type === 'pdf' ? 'application/pdf' : 'image/*'} onChange={(event) => setRecordFiles({ ...recordFiles, [field.id]: event.target.files?.[0] })} />}
                </div>
              ))}
              <Button onClick={createRecord} disabled={!selectedApp}>Upload Record</Button>
            </Card>
            <Card className="stack">
              <h2>Uploaded Files by Association</h2>
              <DataTable
                columns={[
                  { key: 'fileName', label: 'File' },
                  { key: 'fieldName', label: 'Field' },
                  { key: 'applicationName', label: 'Application' },
                  { key: 'companyName', label: 'Company' },
                  { key: 'createdAt', label: 'Uploaded At', render: (row) => new Date(row.createdAt).toLocaleString() }
                ]}
                data={filteredRows.files}
              />
            </Card>
          </div>
        ) : null}
      </section>

      <Modal open={companyModal} onClose={() => setCompanyModal(false)} title="Create Company">
        <Input placeholder="Company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        <Button onClick={createCompany} disabled={!companyName.trim()}>Create</Button>
      </Modal>

      <Modal open={appModal} onClose={() => setAppModal(false)} title="Create Application">
        <select className="select" value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)}>
          <option value="">Select company</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        <Input placeholder="Application name" value={appName} onChange={(event) => setAppName(event.target.value)} />
        <Button onClick={createApp} disabled={!selectedCompany || !appName.trim()}>Create</Button>
      </Modal>

      <Modal open={fieldModal} onClose={() => setFieldModal(false)} title="Create Dynamic Field">
        <select className="select" value={selectedApp} onChange={(event) => setSelectedApp(event.target.value)}>
          <option value="">Select application</option>
          {applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
        </select>
        <Input placeholder="Field name" value={fieldForm.name} onChange={(event) => setFieldForm({ ...fieldForm, name: event.target.value })} />
        <select className="select" value={fieldForm.type} onChange={(event) => setFieldForm({ ...fieldForm, type: event.target.value })}>
          <option value="text">Text</option>
          <option value="pdf">PDF</option>
          <option value="image">Image</option>
        </select>
        <Button onClick={createField} disabled={!selectedApp || !fieldForm.name.trim()}>Create</Button>
      </Modal>

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Create Read-only User">
        <Input placeholder="Username" value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} />
        <Input type="password" placeholder="Password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
        <Button onClick={createUser} disabled={!userForm.username || !userForm.password}>Create User</Button>
      </Modal>

      <Modal open={confirmModal.open} onClose={() => !deleting && setConfirmModal({ open: false, type: '', id: '', label: '' })} title="Confirm Deletion">
        <p className="subtitle">This action is destructive and cannot be undone.</p>
        <p><strong>Target:</strong> {confirmModal.label}</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setConfirmModal({ open: false, type: '', id: '', label: '' })} disabled={deleting}>Cancel</Button>
          <Button onClick={executeDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete now'}</Button>
        </div>
      </Modal>

      <Modal open={logoutConfirmOpen} onClose={() => !isLoggingOut && setLogoutConfirmOpen(false)} title="Confirm Logout">
        <p className="subtitle">Are you sure you want to logout from the admin dashboard?</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setLogoutConfirmOpen(false)} disabled={isLoggingOut}>Cancel</Button>
          <Button onClick={onLogout} disabled={isLoggingOut}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Button>
        </div>
      </Modal>
    </main>
  );
}
