'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { UserSidebar } from '../../../../components/UserSidebar';
import { GroupedFieldsView } from '../../../../components/GroupedFieldsView';
import { useAuth } from '../../../../components/AuthProvider';
import { HeaderMenu } from '../../../../components/HeaderMenu';
import { Skeleton } from '../../../../components/ui/skeleton';

export default function ApplicationDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params?.id;
  const { user, loading: authLoading, clearUser } = useAuth();

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [applications, setApplications] = useState([]);
  const [companies, setCompanies] = useState([]);
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

    const loadDashboardData = async () => {
      setLoadingDetails(true);
      setDetailsError('');

      try {
        const [companiesResponse, applicationsResponse, detailsResponse] = await Promise.all([
          fetch('/api/companies', { cache: 'no-store' }),
          fetch('/api/applications', { cache: 'no-store' }),
          fetch(`/api/applications/${applicationId}`, { cache: 'no-store' })
        ]);

        if (!companiesResponse.ok || !applicationsResponse.ok) {
          throw new Error('Failed to load application details.');
        }

        if (!detailsResponse.ok) {
          throw new Error(detailsResponse.status === 404 ? 'Application not found.' : 'Failed to load application details.');
        }

        const [companiesPayload, applicationsPayload, detailsPayload] = await Promise.all([
          companiesResponse.json(),
          applicationsResponse.json(),
          detailsResponse.json()
        ]);

        setCompanies(Array.isArray(companiesPayload.companies) ? companiesPayload.companies : []);
        setApplications(Array.isArray(applicationsPayload.applications) ? applicationsPayload.applications : []);
        setApplicationDetails(detailsPayload);
      } catch (error) {
        setApplicationDetails(null);
        setApplications([]);
        setCompanies([]);
        setDetailsError(error instanceof Error ? error.message : 'Unable to load application details');
      } finally {
        setLoadingDetails(false);
      }
    };

    loadDashboardData();
  }, [applicationId, authLoading, user]);

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
          <Card className="section-gap stack">
            <Skeleton style={{ height: 24, width: '35%' }} />
            <Skeleton style={{ height: 52, width: '100%' }} />
            <Skeleton style={{ height: 52, width: '100%' }} />
          </Card>
        ) : (
          <div className="section-gap">
            <GroupedFieldsView groupedFields={applicationDetails?.groupedFields || []} />
          </div>
        )}
      </section>

    </main>
  );
}
