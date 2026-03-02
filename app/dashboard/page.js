'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { ApplicationList } from '../../components/ApplicationList';

export default function DashboardPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [applications, setApplications] = useState([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (checkingSession) return;

    const loadApplications = async () => {
      setError('');
      const params = new URLSearchParams();
      if (query.trim()) params.set('search', query.trim());
      const response = await fetch(`/api/applications?${params.toString()}`);
      if (!response.ok) {
        setError('Unable to load applications.');
        return;
      }

      const payload = await response.json();
      setApplications(payload.applications || []);
    };

    loadApplications();
  }, [checkingSession, query]);

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

  const filteredCountLabel = useMemo(() => `${applications.length} application${applications.length === 1 ? '' : 's'}`, [applications]);

  if (checkingSession) {
    return (
      <main className="page-center">
        <Card>Validating session...</Card>
      </main>
    );
  }

  return (
    <main className="user-wrap">
      <header className="dashboard-header">
        <div>
          <h1 className="title">Applications</h1>
          <p className="subtitle">View available applications and open details.</p>
        </div>
        <Button variant="secondary" onClick={() => setLogoutConfirmOpen(true)}>Logout</Button>
      </header>

      <Card className="stack">
        <Input
          placeholder="Search applications"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="subtitle">{filteredCountLabel}</p>
        {error ? <p className="error">{error}</p> : null}
      </Card>

      <Card className="section-gap">
        <ApplicationList applications={applications} />
      </Card>

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
