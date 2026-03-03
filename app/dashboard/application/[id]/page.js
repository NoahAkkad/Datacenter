'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { UserSidebar } from '../../../../components/UserSidebar';
import { GroupedFieldsView } from '../../../../components/GroupedFieldsView';
import { useAuth } from '../../../../components/AuthProvider';
import { HeaderMenu } from '../../../../components/HeaderMenu';

export default function ApplicationDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params?.id;
  const { user, loading: authLoading, clearUser } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState('home');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [applicationDetails, setApplicationDetails] = useState(null);
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
    if (authLoading || !user || user.role === 'admin' || !applicationId) return;

    const loadApplicationDetails = async () => {
      setLoadingDetails(true);
      setDetailsError('');

      try {
        const response = await fetch(`/api/applications/${applicationId}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Application not found.' : 'Failed to load application details.');
        }

        const payload = await response.json();
        setApplicationDetails(payload);
      } catch (error) {
        setApplicationDetails(null);
        setDetailsError(error instanceof Error ? error.message : 'Unable to load application details');
      } finally {
        setLoadingDetails(false);
      }
    };

    loadApplicationDetails();
  }, [applicationId, authLoading, user]);

  const onLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      window.localStorage.removeItem('authToken');
      window.sessionStorage.removeItem('authToken');
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
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        activeTab={active}
        onNavigate={setActive}
      />

      <section className="main">
        <header className="dashboard-header">
          <div>
            <h1 className="title">{applicationDetails?.name || 'Application Details'}</h1>
            <p className="subtitle">{applicationDetails?.companyName || 'Structured application information'}</p>
          </div>
          <HeaderMenu onLogout={onLogout} loggingOut={isLoggingOut} />
        </header>

        <div className="row section-mini-gap">
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>← Back to applications</Button>
        </div>

        {detailsError ? <Card className="error section-gap">{detailsError}</Card> : null}

        {loadingDetails ? (
          <Card className="section-gap">Loading application details...</Card>
        ) : (
          <div className="section-gap">
            <GroupedFieldsView groupedFields={applicationDetails?.groupedFields || []} />
          </div>
        )}
      </section>

    </main>
  );
}
