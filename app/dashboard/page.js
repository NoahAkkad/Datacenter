'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { ApplicationList } from '../../components/ApplicationList';
import { AppLayout } from '../../components/AppLayout';

const userNav = [
  { key: 'home', label: 'Home', href: '/dashboard', icon: '🏠' },
  { key: 'applications', label: 'Applications', href: '/dashboard?tab=applications', icon: '🧩' }
];

export default function DashboardPage() {
  const router = useRouter();
  const [active, setActive] = useState('home');
  const [query, setQuery] = useState('');
  const [applications, setApplications] = useState([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    setActive(tab === 'applications' ? 'applications' : 'home');
  }, []);

  useEffect(() => {
    const validateSession = async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) return router.replace('/login?portal=user');
      const user = await response.json();
      if (user.role === 'admin') return router.replace('/admin');
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
      if (!response.ok) return setError('Unable to load applications.');
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

  if (checkingSession) return <main className="page-center"><Card>Validating session...</Card></main>;

  return (
    <>
      <AppLayout
        title="User Dashboard"
        subtitle="View available applications and open details."
        navigationItems={userNav}
        activeTab={active}
        onNavigate={(tab) => {
          setActive(tab);
          if (tab === 'home') {
            setQuery('');
            setError('');
          }
        }}
        actions={<Button variant="secondary" onClick={() => setLogoutConfirmOpen(true)}>Logout</Button>}
      >
        {active === 'home' ? (
          <Card className="stack">
            <h2>Welcome Home</h2>
            <p className="subtitle">Use the sidebar to jump to applications.</p>
          </Card>
        ) : null}

        <Card className="stack section-gap">
          <Input placeholder="Search applications" value={query} onChange={(event) => setQuery(event.target.value)} />
          <p className="subtitle">{filteredCountLabel}</p>
          {error ? <p className="error">{error}</p> : null}
        </Card>

        <Card className="section-gap">
          <ApplicationList applications={applications} />
        </Card>
      </AppLayout>

      <Modal open={logoutConfirmOpen} onClose={() => !isLoggingOut && setLogoutConfirmOpen(false)} title="Confirm Logout">
        <p className="subtitle">Are you sure you want to logout?</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setLogoutConfirmOpen(false)} disabled={isLoggingOut}>Cancel</Button>
          <Button onClick={onLogout} disabled={isLoggingOut}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Button>
        </div>
      </Modal>
    </>
  );
}
