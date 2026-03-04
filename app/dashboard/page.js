'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { UserSidebar } from '../../components/UserSidebar';
import { useAuth } from '../../components/AuthProvider';
import { HeaderMenu } from '../../components/HeaderMenu';
import { Skeleton } from '../../components/ui/skeleton';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, clearUser } = useAuth();
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [applications, setApplications] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [applicationsError, setApplicationsError] = useState('');
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

    const loadSidebarData = async () => {
      setLoadingApplications(true);
      setApplicationsError('');

      try {
        const [companiesResponse, applicationsResponse] = await Promise.all([
          fetch('/api/companies', { cache: 'no-store' }),
          fetch('/api/applications', { cache: 'no-store' })
        ]);

        if (!companiesResponse.ok || !applicationsResponse.ok) {
          throw new Error('Failed to load applications');
        }

        const [companiesPayload, applicationsPayload] = await Promise.all([
          companiesResponse.json(),
          applicationsResponse.json()
        ]);

        setCompanies(Array.isArray(companiesPayload.companies) ? companiesPayload.companies : []);
        setApplications(Array.isArray(applicationsPayload.applications) ? applicationsPayload.applications : []);
      } catch (error) {
        setApplications([]);
        setCompanies([]);
        setApplicationsError(error instanceof Error ? error.message : 'Unable to load applications');
      } finally {
        setLoadingApplications(false);
      }
    };

    loadSidebarData();
  }, [authLoading, user]);

  const onLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      clearUser();
      setIsLoggingOut(false);
      router.replace('/login?portal=user');
      router.refresh();
    }
  };

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
        onNavigate={() => {}}
        companies={companies}
        applications={applications}
      />

      <section className="main">
        <header className="dashboard-header">
          <div>
            <h1 className="title">User Dashboard</h1>
            <p className="subtitle">Browse applications and open details.</p>
          </div>
          <HeaderMenu onLogout={onLogout} loggingOut={isLoggingOut} />
        </header>

        {applicationsError ? <Card className="error">{applicationsError}</Card> : null}

        {loadingApplications ? (
          <Card className="stack">
            <Skeleton style={{ height: 24, width: '36%' }} />
            <Skeleton style={{ height: 68, width: '100%' }} />
            <Skeleton style={{ height: 68, width: '100%' }} />
          </Card>
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
              <Card className="empty-state-card">
                <h3 className="card-title">No applications yet</h3>
                <p className="subtitle">Once applications are assigned to your account, they will appear here.</p>
                <Button className="empty-cta" variant="secondary" onClick={() => window.location.reload()}>Refresh list</Button>
              </Card>
            )}
          </section>
        )}
      </section>

    </main>
  );
}
