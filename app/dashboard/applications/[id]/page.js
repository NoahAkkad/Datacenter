'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { GroupedFieldsView } from '../../../../components/GroupedFieldsView';
import { formatDateOnly } from '../../../../lib/formatDate';

export default function ApplicationDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadApplication = async () => {
      const meResponse = await fetch('/api/auth/me');
      if (!meResponse.ok) {
        router.replace('/login?portal=user');
        return;
      }

      const me = await meResponse.json();
      if (me.role === 'admin') {
        router.replace('/admin');
        return;
      }

      const response = await fetch(`/api/applications/${id}`);
      if (response.status === 404) {
        setError('Application not found.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError('Failed to load application details.');
        setLoading(false);
        return;
      }

      const payload = await response.json();
      setApplication(payload);
      setLoading(false);
    };

    if (id) {
      loadApplication();
    }
  }, [id, router]);

  const createdDate = formatDateOnly(application?.createdAt);
  const updatedDate = formatDateOnly(application?.updatedAt);
  const hasMetadata = Boolean(createdDate || updatedDate);

  if (loading) {
    return (
      <main className="page-center">
        <Card>Loading application...</Card>
      </main>
    );
  }

  return (
    <main className="user-wrap">
      <div className="dashboard-header details-header-card fade-in">
        <div>
          <h1 className="title">{application?.name || 'Application Details'}</h1>
          <p className="subtitle">{application?.companyName ? `Company: ${application.companyName}` : 'Read-only application data.'}</p>
          {hasMetadata ? (
            <div className="details-meta-row">
              {createdDate ? <p className="subtitle">Created: {createdDate}</p> : null}
              {updatedDate ? <p className="subtitle">Updated: {updatedDate}</p> : null}
            </div>
          ) : null}
        </div>
        <Link href="/dashboard"><Button variant="secondary">Back to Applications</Button></Link>
      </div>

      {error ? (
        <Card><p className="error">{error}</p></Card>
      ) : null}

      <GroupedFieldsView groupedFields={application?.groupedFields || []} />
    </main>
  );
}
