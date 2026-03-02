'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';

export default function DashboardPage() {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [application, setApplication] = useState('');
  const [results, setResults] = useState([]);
  const [imagePreview, setImagePreview] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const validateSession = async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.replace('/login?portal=user');
        return;
      }

      const user = await response.json();
      if (user.role === 'admin') {
        router.replace('/admin');
        return;
      }
      setCheckingSession(false);
    };

    validateSession();
  }, [router]);

  const search = async () => {
    const query = new URLSearchParams({ company, application }).toString();
    const response = await fetch(`/api/browse?${query}`);
    if (response.ok) setResults(await response.json());
  };

  useEffect(() => {
    if (checkingSession) return;
    search();
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
      router.replace('/login?portal=user');
      router.refresh();
    }
  };

  const stats = useMemo(() => ({
    companies: results.length,
    apps: results.reduce((sum, entry) => sum + entry.applications.length, 0)
  }), [results]);

  if (checkingSession) {
    return (
      <main className="page-center">
        <Card>Validating session...</Card>
      </main>
    );
  }

  return (
    <main className="user-wrap">
      <header>
        <div className="dashboard-header">
          <div>
            <h1 className="title">User Dashboard</h1>
            <p className="subtitle">Search, filter, and browse structured application records.</p>
          </div>
          <Button variant="secondary" onClick={() => setLogoutConfirmOpen(true)}>Logout</Button>
        </div>
      </header>

      <Card className="stack">
        <div className="row">
          <Input placeholder="Search company" value={company} onChange={(event) => setCompany(event.target.value)} />
          <Input placeholder="Search application" value={application} onChange={(event) => setApplication(event.target.value)} />
          <Button onClick={search}>Search</Button>
        </div>
        <p className="subtitle">{stats.companies} companies · {stats.apps} applications</p>
      </Card>

      <div className="stack section-gap">
        {results.map((companyEntry) => (
          <Card key={companyEntry.id}>
            <h2>{companyEntry.name}</h2>
            <div className="app-grid">
              {companyEntry.applications.map((applicationEntry) => (
                <article key={applicationEntry.id} className="record">
                  <h3>{applicationEntry.name}</h3>
                  {applicationEntry.records.length === 0 ? <p className="subtitle">No records available.</p> : applicationEntry.records.map((record) => (
                    <div key={record.id} className="record">
                      {applicationEntry.fields.map((field) => {
                        const value = record.values?.[field.id];
                        if (!value) return null;

                        return (
                          <div key={field.id} className="field-row">
                            <span>{field.name}</span>
                            {field.type === 'text' ? <span>{value}</span> : field.type === 'pdf' ? <a href={value.url} target="_blank" className="link">Preview PDF</a> : <button className="button secondary" onClick={() => setImagePreview(value.url)}>Preview Image</button>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(imagePreview)} onClose={() => setImagePreview('')} title="Image Preview">
        {imagePreview ? <img src={imagePreview} alt="Record preview" className="preview-image" /> : null}
      </Modal>

      <Modal open={logoutConfirmOpen} onClose={() => !isLoggingOut && setLogoutConfirmOpen(false)} title="Confirm Logout">
        <p className="subtitle">Are you sure you want to logout?</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setLogoutConfirmOpen(false)} disabled={isLoggingOut}>Cancel</Button>
          <Button onClick={onLogout} disabled={isLoggingOut}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Button>
        </div>
      </Modal>
    </main>
  );
}
