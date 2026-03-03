'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { UserSidebar } from '../../components/UserSidebar';
import { useAuth } from '../../components/AuthProvider';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, clearUser } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState('home');
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [applications, setApplications] = useState([]);
  const [applicationsError, setApplicationsError] = useState('');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login?portal=user');
      return;
    }

    if (user.role === 'admin') {
      router.replace('/admin');
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (authLoading || !user || user.role === 'admin') return;

    const loadApplications = async () => {
      setLoadingApplications(true);
      setApplicationsError('');

      try {
        const response = await fetch('/api/applications', { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('Failed to load applications');
        }

        const payload = await response.json();
        setApplications(Array.isArray(payload.applications) ? payload.applications : []);
      } catch (error) {
        setApplications([]);
        setApplicationsError(error instanceof Error ? error.message : 'Unable to load applications');
      } finally {
        setLoadingApplications(false);
      }
    };

    loadApplications();
  }, [authLoading, user]);

  const onLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      window.localStorage.removeItem('authToken');
      window.sessionStorage.removeItem('authToken');
      clearUser();
      setIsLoggingOut(false);
      setLogoutConfirmOpen(false);
      router.replace('/login?portal=user');
      router.refresh();
    }
  };

  const formatDisplayName = (username = '') => {
    const cleanedName = String(username || '').trim();
    if (!cleanedName) return 'User';
    return cleanedName
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  };

  const displayName = formatDisplayName(user?.username);
  const displayEmail = user?.email?.trim() || 'Email unavailable';

  if (authLoading) {
    return (
      <main className="page-center">
        <Card>Validating session...</Card>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <UserSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        activeTab={active}
        onNavigate={setActive}
      />

      <section className="main">
        <header className="dashboard-header">
          <div>
            <h1 className="title">User Dashboard</h1>
            <p className="subtitle">Browse applications and open details.</p>
          </div>
          <div className="profile">
            <button className="profile-trigger" onClick={() => setLogoutConfirmOpen(true)}>
              <strong>{displayName}</strong>
              <p className="subtitle">{displayEmail}</p>
            </button>
          </div>
        </header>

        {applicationsError ? <Card className="error">{applicationsError}</Card> : null}

        {loadingApplications ? (
          <Card>Loading applications...</Card>
        ) : (
          <section className="app-list-stack">
            <h2 className="section-title">Applications</h2>
            {applications.length ? (
              <div className="application-grid">
                {applications.map((application) => (
                  <Link
                    key={application.id}
                    href={`/dashboard/application/${application.id}`}
                    className="application-card-link"
                  >
                    <Card className="application-card stack">
                      <h3 className="application-card-title">{application.name}</h3>
                      {application.companyName ? <p className="application-card-company">{application.companyName}</p> : null}
                      {application.description ? <p className="subtitle">{application.description}</p> : null}
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card>
                <p className="subtitle">No applications are currently available.</p>
              </Card>
            )}
          </section>
        )}
      </section>

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
