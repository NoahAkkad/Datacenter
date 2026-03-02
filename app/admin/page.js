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
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedApp, setSelectedApp] = useState('');
  const [selectedFieldApp, setSelectedFieldApp] = useState('');
  const [recordTextValues, setRecordTextValues] = useState({});
  const [recordFiles, setRecordFiles] = useState({});
  const [statusMessage, setStatusMessage] = useState('');

  const [companyModal, setCompanyModal] = useState(false);
  const [appModal, setAppModal] = useState(false);
  const [fieldModal, setFieldModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, type: '', id: '', label: '' });
  const [editing, setEditing] = useState({ open: false, type: '', id: '', payload: {}, title: '' });

  const [companyName, setCompanyName] = useState('');
  const [appName, setAppName] = useState('');
  const [fieldForm, setFieldForm] = useState({ name: '', type: 'text' });
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  const [checkingSession, setCheckingSession] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');

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
      setCurrentUserId(user.id || '');
      setCheckingSession(false);
    };

    validateSession();
  }, [router]);

  const applications = useMemo(
    () => data.flatMap((company) => company.applications.map((app) => ({ ...app, companyName: company.name }))),
    [data]
  );

  const fields = useMemo(
    () => applications
      .flatMap((app) => app.fields || [])
      .map((field) => ({ ...field, appName: applications.find((app) => app.id === field.applicationId)?.name || '-' })),
    [applications]
  );

  const records = useMemo(
    () => applications.flatMap((app) => (app.records || []).map((record) => ({ ...record, appName: app.name }))),
    [applications]
  );

  const applicationRecords = useMemo(
    () => (selectedApp ? records.filter((record) => record.applicationId === selectedApp) : records),
    [records, selectedApp]
  );

  const selectedApplication = useMemo(
    () => applications.find((entry) => entry.id === selectedApp),
    [applications, selectedApp]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const applicationId = params.get('applicationId') || '';
    const allowedTabs = ['home', 'companies', 'applications', 'fields', 'users', 'upload'];
    setActive(allowedTabs.includes(tab) ? tab : 'home');
    setSelectedApp(applicationId);
  }, []);

  const refresh = async () => {
    const [companyResponse, userResponse] = await Promise.all([
      fetch('/api/companies'),
      fetch('/api/users')
    ]);

    if (companyResponse.ok) setData(await companyResponse.json());
    if (userResponse.ok) setUsers(await userResponse.json());
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
    const isBulkCreate = selectedFieldApp === '__all__';
    const endpoint = isBulkCreate ? '/api/applications/all/fields' : `/api/applications/${selectedFieldApp}/fields`;
    const payload = isBulkCreate
      ? { ...fieldForm, applicationIds: applications.map((application) => application.id) }
      : fieldForm;

    setStatusMessage('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const responsePayload = await response.json();
      if (!response.ok) {
        setStatusMessage(responsePayload.error || 'Field creation failed.');
        return;
      }

      setFieldModal(false);
      setSelectedFieldApp('');
      setFieldForm({ name: '', type: 'text' });
      setStatusMessage(isBulkCreate ? 'Field successfully added to all applications' : 'Field successfully added');
      refresh();
    } catch {
      setStatusMessage('Field creation request failed. Please retry.');
    }
  };

  const createUser = async () => {
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, role: 'user' }) });
    setUserModal(false);
    setUserForm({ username: '', password: '' });
    refresh();
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

  const openEdit = (type, row) => {
    if (type === 'company') setEditing({ open: true, type, id: row.id, payload: { name: row.name }, title: 'Edit Company' });
    if (type === 'application') setEditing({ open: true, type, id: row.id, payload: { name: row.name }, title: 'Edit Application' });
    if (type === 'field') setEditing({ open: true, type, id: row.id, payload: { name: row.name, label: row.label || '', order: row.order ?? '' }, title: 'Edit Field' });
    if (type === 'data') setEditing({ open: true, type, id: row.id, payload: { values: row.values || {} }, title: `Edit Record ${row.id}` });
    if (type === 'user') setEditing({ open: true, type, id: row.id, payload: { username: row.username, password: '' }, title: 'Edit User' });
  };

  const applyOptimisticEdit = (type, id, updatedEntity) => {
    if (type === 'company') {
      setData((current) => current.map((company) => (company.id === id ? { ...company, ...updatedEntity } : company)));
      return;
    }

    if (type === 'application') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((application) => (application.id === id ? { ...application, ...updatedEntity } : application))
      })));
      return;
    }

    if (type === 'field') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((application) => ({
          ...application,
          fields: (application.fields || []).map((field) => (field.id === id ? { ...field, ...updatedEntity } : field))
        }))
      })));
      return;
    }

    if (type === 'data') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((application) => ({
          ...application,
          records: (application.records || []).map((record) => (record.id === id ? { ...record, ...updatedEntity } : record))
        }))
      })));
      return;
    }

    if (type === 'user') {
      setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...updatedEntity } : user)));
    }
  };

  const executeEdit = async () => {
    const endpointMap = {
      company: `/api/companies/${editing.id}`,
      application: `/api/applications/${editing.id}`,
      field: `/api/fields/${editing.id}`,
      data: `/api/records/${editing.id}`,
      user: `/api/users/${editing.id}`
    };

    if (!endpointMap[editing.type] || !editing.id) {
      setStatusMessage('Unable to submit edit: missing entity type or ID.');
      return;
    }

    const payload = { ...editing.payload };
    if (editing.type === 'user' && !payload.password) delete payload.password;
    if (editing.type === 'field' && payload.order === '') delete payload.order;

    if ((editing.type === 'company' || editing.type === 'application') && !String(payload.name || '').trim()) {
      setStatusMessage('Name is required.');
      return;
    }

    if (editing.type === 'user' && !String(payload.username || '').trim()) {
      setStatusMessage('Username is required.');
      return;
    }

    setSavingEdit(true);
    setStatusMessage('');
    try {
      const response = await fetch(endpointMap[editing.type], {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const responseText = await response.text();
      let payload = {};
      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = { error: responseText };
        }
      }
      if (!response.ok) {
        setStatusMessage(payload.error || 'Update failed.');
        return;
      }

      if (payload.success !== undefined && !payload.success) {
        setStatusMessage(payload.error || 'Update failed.');
        return;
      }

      applyOptimisticEdit(editing.type, editing.id, payload.data || {});
      setEditing({ open: false, type: '', id: '', payload: {}, title: '' });
      setStatusMessage(payload.message || 'Update completed successfully.');
      await refresh();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[admin:update] request failed', {
        type: editing.type,
        id: editing.id,
        error: error?.message
      });
      setStatusMessage('Update request failed. Please retry.');
    } finally {
      setSavingEdit(false);
    }
  };

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
      return;
    }

    if (type === 'user') {
      setUsers((current) => current.filter((user) => user.id !== id));
    }
  };

  const executeDelete = async () => {
    const { type, id } = confirmModal;
    const endpointMap = {
      company: `/api/company/${id}`,
      application: `/api/application/${id}`,
      field: `/api/field/${id}`,
      data: `/api/data/${id}`,
      user: `/api/users/${id}`
    };

    if (type === 'user') {
      setDeletingUserId(id);
    }

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
      setStatusMessage(payload.message || 'Deletion completed successfully.');
      refresh();
    } catch {
      setStatusMessage('Delete request failed. Please retry.');
    } finally {
      setDeleting(false);
      setDeletingUserId('');
    }
  };

  const filteredCompanies = data.filter((company) => company.name.toLowerCase().includes(search.toLowerCase()));

  const onSidebarNavigate = (tab, applicationId = '') => {
    setActive(tab);
    if (tab === 'applications') {
      setSelectedApp(applicationId);
    }
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
        applications={applications}
        selectedApplicationId={selectedApp}
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
            {profileMenuOpen ? <div className="profile-menu"><button className="menu-item danger" onClick={() => setLogoutConfirmOpen(true)}>Logout</button></div> : null}
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

        {active === 'home' || active === 'companies' ? <div className="grid-2 section-gap">
          <Card className="stack">
            <h2>Companies Management</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Company Name' },
                { key: 'apps', label: 'Applications', render: (row) => row.applications.length },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => <div className="row"><Button variant="secondary" onClick={() => openEdit('company', row)}>Edit</Button><Button onClick={() => openDelete('company', row.id, row.name)}>Delete</Button></div>
                }
              ]}
              data={filteredCompanies}
            />
          </Card>
          {active === 'home' ? <Card className="stack">
            <h2>Applications per Company</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Application' },
                { key: 'companyName', label: 'Company' },
                { key: 'fields', label: 'Fields', render: (row) => row.fields?.length || 0 },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => <div className="row"><Button variant="secondary" onClick={() => openEdit('application', row)}>Edit</Button><Button onClick={() => openDelete('application', row.id, row.name)}>Delete</Button></div>
                }
              ]}
              data={applications}
            />
          </Card> : null}
        </div> : null}

        {active === 'home' || active === 'applications' || active === 'fields' ? <div className="grid-2 section-gap">
          {active === 'home' || active === 'fields' ? <Card className="stack">
            <h2>Dynamic Fields Management</h2>
            {fields.map((field) => (
              <div className="row" key={field.id}>
                <Badge>{field.name} · {field.type} · {field.appName}</Badge>
                <div className="row"><Button variant="secondary" onClick={() => openEdit('field', field)}>Edit</Button><Button variant="secondary" onClick={() => openDelete('field', field.id, field.name)}>Delete</Button></div>
              </div>
            ))}
          </Card> : null}
          {active === 'home' || active === 'applications' ? <Card className="stack">
            <h2>Applications Management</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Application' },
                { key: 'companyName', label: 'Company' },
                { key: 'fields', label: 'Fields', render: (row) => row.fields?.length || 0 },
                { key: 'records', label: 'Records', render: (row) => row.records?.length || 0 },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => <div className="row"><Button variant="secondary" onClick={() => openEdit('application', row)}>Edit</Button><Button onClick={() => openDelete('application', row.id, row.name)}>Delete</Button></div>
                }
              ]}
              data={applications}
            />

            {active === 'applications' ? <>
              <h2 className="section-mini-gap">{selectedApplication?.name ? `${selectedApplication.name} Records` : 'Application Records'}</h2>
              <DataTable
                columns={[
                  { key: 'appName', label: 'Application' },
                  { key: 'id', label: 'Record ID' },
                  {
                    key: 'actions',
                    label: 'Actions',
                    render: (row) => <div className="row"><Button variant="secondary" onClick={() => openEdit('data', row)}>Edit</Button><Button variant="secondary" onClick={() => openDelete('data', row.id, `${row.appName} / ${row.id}`)}>Delete</Button></div>
                  }
                ]}
                data={applicationRecords}
              />
            </> : null}
          </Card> : null}
        </div> : null}

        {active === 'home' || active === 'upload' ? <div className="grid-2 section-gap"><Card className="stack">
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
        </Card></div> : null}

        {active === 'users' ? <div className="grid-2 section-gap">
          <Card className="stack">
            <h2>User Management</h2>
            <p className="subtitle">Create and manage normal users.</p>
            <Button onClick={() => setUserModal(true)}>New User</Button>
            <DataTable
              columns={[
                { key: 'username', label: 'Username' },
                { key: 'role', label: 'Role' },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <div className="row">
                      <Button variant="secondary" onClick={() => openEdit('user', row)}>Edit</Button>
                      {row.role === 'admin' || row.id === currentUserId
                        ? <Button disabled title="Protected account">🗑️ Delete</Button>
                        : <Button onClick={() => openDelete('user', row.id, row.username)} disabled={deletingUserId === row.id}>{deletingUserId === row.id ? 'Deleting...' : '🗑️ Delete'}</Button>}
                    </div>
                  )
                }
              ]}
              data={users}
            />
          </Card>
        </div> : null}
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
        <select className="select" value={selectedFieldApp} onChange={(event) => setSelectedFieldApp(event.target.value)}>
          <option value="">Select application</option>
          <option value="__all__">All Applications</option>
          {applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
        </select>
        <Input placeholder="Field name" value={fieldForm.name} onChange={(event) => setFieldForm({ ...fieldForm, name: event.target.value })} />
        <select className="select" value={fieldForm.type} onChange={(event) => setFieldForm({ ...fieldForm, type: event.target.value })}>
          <option value="text">Text</option>
          <option value="pdf">PDF</option>
          <option value="image">Image</option>
        </select>
        <Button onClick={createField} disabled={!selectedFieldApp || !fieldForm.name.trim()}>Create</Button>
      </Modal>

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Create Read-only User">
        <Input placeholder="Username" value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} />
        <Input type="password" placeholder="Password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
        <Button onClick={createUser} disabled={!userForm.username || !userForm.password}>Create User</Button>
      </Modal>

      <Modal open={editing.open} onClose={() => !savingEdit && setEditing({ open: false, type: '', id: '', payload: {}, title: '' })} title={editing.title}>
        {editing.type === 'company' || editing.type === 'application' ? <Input value={editing.payload.name || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, name: event.target.value } }))} /> : null}
        {editing.type === 'field' ? <>
          <Input placeholder="Field name" value={editing.payload.name || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, name: event.target.value } }))} />
          <Input placeholder="Field label" value={editing.payload.label || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, label: event.target.value } }))} />
          <Input placeholder="Field order" type="number" value={editing.payload.order} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, order: event.target.value } }))} />
        </> : null}
        {editing.type === 'user' ? <>
          <Input placeholder="Username" value={editing.payload.username || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, username: event.target.value } }))} />
          <Input placeholder="New password (optional)" type="password" value={editing.payload.password || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, password: event.target.value } }))} />
        </> : null}
        {editing.type === 'data' ? fields.filter((field) => records.find((record) => record.id === editing.id)?.applicationId === field.applicationId).map((field) => {
          const currentValue = editing.payload.values?.[field.id];
          if (field.type === 'text') {
            return <Input key={field.id} placeholder={field.name} value={currentValue || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, values: { ...current.payload.values, [field.id]: event.target.value } } }))} />;
          }
          return (
            <div key={field.id} className="stack">
              <strong>{field.name} metadata</strong>
              <Input placeholder="File display name" value={currentValue?.originalname || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, values: { ...current.payload.values, [field.id]: { ...current.payload.values[field.id], originalname: event.target.value } } } }))} />
              <Input placeholder="Description" value={currentValue?.description || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, values: { ...current.payload.values, [field.id]: { ...current.payload.values[field.id], description: event.target.value } } } }))} />
            </div>
          );
        }) : null}
        <div className="row">
          <Button variant="secondary" onClick={() => setEditing({ open: false, type: '', id: '', payload: {}, title: '' })} disabled={savingEdit}>Cancel</Button>
          <Button onClick={executeEdit} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save changes'}</Button>
        </div>
      </Modal>

      <Modal open={confirmModal.open} onClose={() => !deleting && setConfirmModal({ open: false, type: '', id: '', label: '' })} title="Confirm Deletion">
        <p className="subtitle">{confirmModal.type === 'user' ? 'Are you sure you want to delete this user? This action cannot be undone.' : 'This action is destructive and cannot be undone.'}</p>
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
