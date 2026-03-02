'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { DataTable } from '../../components/ui/table';
import { AdminSidebar } from '../../components/AdminSidebar';

export default function AdminPage() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState('home');
  const [data, setData] = useState([]);
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

  useEffect(() => {
    const validateSession = async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.replace('/login?portal=admin');
        return;
      }

      const user = await response.json();
      if (user.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }
      setCheckingSession(false);
    };

    validateSession();
  }, [router]);

  const applications = useMemo(
    () => data.flatMap((company) => company.applications.map((app) => ({ ...app, companyName: company.name }))),
    [data]
  );
  const fields = useMemo(() => applications.flatMap((app) => app.fields || []).map((field) => ({ ...field, appName: applications.find((app) => app.id === field.applicationId)?.name || '-' })), [applications]);
  const records = useMemo(
    () => applications.flatMap((app) => (app.records || []).map((record) => ({ ...record, appName: app.name }))),
    [applications]
  );
  const selectedApplication = useMemo(
    () => applications.find((entry) => entry.id === selectedApp),
    [applications, selectedApp]
  );

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    const allowedTabs = ['home', 'companies', 'applications', 'fields', 'users', 'upload'];
    setActive(allowedTabs.includes(tab) ? tab : 'home');
  }, []);

  const refresh = async () => {
    const response = await fetch('/api/companies');
    if (response.ok) setData(await response.json());
  };

  useEffect(() => {
    if (checkingSession) return;
    refresh();
  }, [checkingSession]);

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
    refresh();
  };

  const createApp = async () => {
    await fetch(`/api/companies/${selectedCompany}/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: appName }) });
    setAppModal(false);
    setAppName('');
    refresh();
  };

  const createField = async () => {
    await fetch(`/api/applications/${selectedApp}/fields`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fieldForm) });
    setFieldModal(false);
    setFieldForm({ name: '', type: 'text' });
    refresh();
  };

  const createUser = async () => {
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, role: 'user' }) });
    setUserModal(false);
    setUserForm({ username: '', password: '' });
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
    refresh();
  };

  const openDelete = (type, id, label) => setConfirmModal({ open: true, type, id, label });

  const optimisticDelete = (type, id) => {
    if (type === 'company') {
      setData((current) => current.filter((entry) => entry.id !== id));
      return;
    }

    if (type === 'application') {
      setData((current) => current.map((company) => ({ ...company, applications: company.applications.filter((app) => app.id !== id) })));
      return;
    }

    if (type === 'field') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((app) => ({ ...app, fields: (app.fields || []).filter((field) => field.id !== id) }))
      })));
      return;
    }

    if (type === 'data') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((app) => ({ ...app, records: (app.records || []).filter((record) => record.id !== id) }))
      })));
    }
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
      refresh();
    } catch {
      setStatusMessage('Delete request failed. Please retry.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredCompanies = data.filter((company) => company.name.toLowerCase().includes(search.toLowerCase()));

  const onSidebarNavigate = (tab) => {
    setActive(tab);
    if (tab === 'home') {
      setSearch('');
      setSelectedCompany('');
      setSelectedApp('');
      setRecordTextValues({});
      setRecordFiles({});
      setStatusMessage('');
    }
  };

  if (checkingSession) {
    return (
      <main className="page-center">
        <Card>Validating session...</Card>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <AdminSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        activeTab={active}
        onNavigate={onSidebarNavigate}
      />

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
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies" />
            <Button onClick={() => setCompanyModal(true)}>New Company</Button>
            <Button variant="secondary" onClick={() => setAppModal(true)}>New Application</Button>
            <Button variant="secondary" onClick={() => setFieldModal(true)}>New Field</Button>
            <Button variant="secondary" onClick={() => setUserModal(true)}>New User</Button>
          </div>
        </Card>

        {active === 'home' || active === 'companies' ? (
        <div className="grid-2 section-gap">
          <Card className="stack">
            <h2>Companies Management</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Company Name' },
                { key: 'apps', label: 'Applications', render: (row) => row.applications.length },
                { key: 'actions', label: 'Actions', render: (row) => <Button onClick={() => openDelete('company', row.id, row.name)}>Delete</Button> }
              ]}
              data={filteredCompanies}
            />
          </Card>
          {active === 'home' ? (
          <Card className="stack">
            <h2>Applications per Company</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Application' },
                { key: 'companyName', label: 'Company' },
                { key: 'fields', label: 'Fields', render: (row) => row.fields?.length || 0 },
                { key: 'actions', label: 'Actions', render: (row) => <Button onClick={() => openDelete('application', row.id, row.name)}>Delete</Button> }
              ]}
              data={applications}
            />
          </Card>
          ) : null}
        </div>
        ) : null}

        {active === 'home' || active === 'applications' || active === 'fields' ? (
        <div className="grid-2 section-gap">
          {active === 'home' || active === 'fields' ? (
          <Card className="stack">
            <h2>Dynamic Fields Management</h2>
            {fields.map((field) => (
              <div className="row" key={field.id}>
                <Badge>{field.name} · {field.type} · {field.appName}</Badge>
                <Button variant="secondary" onClick={() => openDelete('field', field.id, field.name)}>Delete</Button>
              </div>
            ))}
          </Card>
          ) : null}
          {active === 'home' || active === 'applications' ? (
          <Card className="stack">
            <h2>Data Listing</h2>
            <DataTable
              columns={[
                { key: 'appName', label: 'Application' },
                { key: 'id', label: 'Record ID' },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => <Button variant="secondary" onClick={() => openDelete('data', row.id, `${row.appName} / ${row.id}`)}>Delete</Button>
                }
              ]}
              data={records}
            />
          </Card>
          ) : null}
        </div>
        ) : null}

        {active === 'home' || active === 'upload' ? (
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
                {field.type === 'text' ? <Input onChange={(event) => setRecordTextValues({ ...recordTextValues, [field.id]: event.target.value })} /> : <Input type="file" accept={field.type === 'pdf' ? 'application/pdf' : 'image/*'} onChange={(event) => setRecordFiles({ ...recordFiles, [field.id]: event.target.files?.[0] })} />}
              </div>
            ))}
            <Button onClick={createRecord} disabled={!selectedApp}>Upload Record</Button>
          </Card>
        </div>
        ) : null}

        {active === 'users' ? (
        <div className="grid-2 section-gap">
          <Card className="stack">
            <h2>User Management</h2>
            <p className="subtitle">Create and manage normal users.</p>
            <Button onClick={() => setUserModal(true)}>New User</Button>
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
          {data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
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
