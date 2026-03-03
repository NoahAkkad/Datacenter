'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Modal } from '../../../../components/ui/modal';
import { UserSidebar } from '../../../../components/UserSidebar';
import { GroupedFieldsView } from '../../../../components/GroupedFieldsView';
import { useAuth } from '../../../../components/AuthProvider';
import { HeaderProfile } from '../../../../components/HeaderProfile';

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
      setLogoutConfirmOpen(false);
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
          <div className="profile">
            <HeaderProfile user={user} loading={authLoading} onClick={() => setLogoutConfirmOpen(true)} />
          </div>
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
