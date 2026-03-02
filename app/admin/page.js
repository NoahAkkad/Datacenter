'use client';

import { useEffect, useMemo, useState } from 'react';

export default function AdminPage() {
  const [data, setData] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedApp, setSelectedApp] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [appName, setAppName] = useState('');
  const [fieldForm, setFieldForm] = useState({ name: '', type: 'text' });
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  const [recordTextValues, setRecordTextValues] = useState({});
  const [recordFiles, setRecordFiles] = useState({});

  const selectedApplication = useMemo(
    () => data.flatMap((c) => c.applications).find((a) => a.id === selectedApp),
    [data, selectedApp]
  );

  const refresh = async () => {
    const res = await fetch('/api/companies');
    if (res.ok) {
      const payload = await res.json();
      setData(payload);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const createCompany = async () => {
    await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: companyName })
    });
    setCompanyName('');
    refresh();
  };

  const createApp = async () => {
    await fetch(`/api/companies/${selectedCompany}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: appName })
    });
    setAppName('');
    refresh();
  };

  const createField = async () => {
    await fetch(`/api/applications/${selectedApp}/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fieldForm)
    });
    setFieldForm({ name: '', type: 'text' });
    refresh();
  };

  const createUser = async () => {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userForm, role: 'user' })
    });
    setUserForm({ username: '', password: '' });
  };

  const createRecord = async () => {
    const form = new FormData();
    form.append('values', JSON.stringify(recordTextValues));
    Object.entries(recordFiles).forEach(([fieldId, file]) => {
      if (file) form.append(fieldId, file);
    });

    await fetch(`/api/applications/${selectedApp}/records`, {
      method: 'POST',
      body: form
    });

    setRecordTextValues({});
    setRecordFiles({});
  };

  return (
    <div className="stack">
      <h1>Admin Dashboard</h1>
      <section className="card stack">
        <h2>1) Create Company</h2>
        <div className="row">
          <input value={companyName} placeholder="Company name" onChange={(e) => setCompanyName(e.target.value)} />
          <button className="button" onClick={createCompany}>Add Company</button>
        </div>
      </section>

      <section className="card stack">
        <h2>2) Create Application</h2>
        <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
          <option value="">Select Company</option>
          {data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        <div className="row">
          <input value={appName} placeholder="Application name" onChange={(e) => setAppName(e.target.value)} />
          <button className="button" onClick={createApp} disabled={!selectedCompany}>Add Application</button>
        </div>
      </section>

      <section className="card stack">
        <h2>3) Define Dynamic Fields</h2>
        <select value={selectedApp} onChange={(e) => setSelectedApp(e.target.value)}>
          <option value="">Select Application</option>
          {data.flatMap((c) => c.applications).map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
        </select>
        <div className="row">
          <input placeholder="Field name" value={fieldForm.name} onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })} />
          <select value={fieldForm.type} onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}>
            <option value="text">Text</option>
            <option value="pdf">PDF</option>
            <option value="image">Image</option>
          </select>
          <button className="button" onClick={createField} disabled={!selectedApp}>Add Field</button>
        </div>
      </section>

      {selectedApplication && (
        <section className="card stack">
          <h2>4) Insert Data</h2>
          {selectedApplication.fields?.map((field) => (
            <div key={field.id} className="stack">
              <label>{field.name} ({field.type})</label>
              {field.type === 'text' ? (
                <input onChange={(e) => setRecordTextValues({ ...recordTextValues, [field.id]: e.target.value })} />
              ) : (
                <input type="file" accept={field.type === 'pdf' ? 'application/pdf' : 'image/*'} onChange={(e) => setRecordFiles({ ...recordFiles, [field.id]: e.target.files?.[0] })} />
              )}
            </div>
          ))}
          <button className="button" onClick={createRecord}>Save Record</button>
        </section>
      )}

      <section className="card stack">
        <h2>5) Create Read-only User</h2>
        <input placeholder="Username" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
        <input type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
        <button className="button" onClick={createUser}>Create User</button>
      </section>
    </div>
  );
}
