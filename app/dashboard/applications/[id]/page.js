'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Modal } from '../../../../components/ui/modal';

function formatDate(value) {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ApplicationDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState('');

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

  if (loading) {
    return (
      <main className="page-center">
        <Card>Loading application...</Card>
      </main>
    );
  }

  return (
    <main className="user-wrap">
      <div className="dashboard-header">
        <div>
          <h1 className="title">{application?.name || 'Application Details'}</h1>
          <p className="subtitle">{application?.companyName ? `Company: ${application.companyName}` : 'Read-only application data.'}</p>
          <p className="subtitle">Created: {formatDate(application?.createdAt)}</p>
          <p className="subtitle">Last modified: {formatDate(application?.updatedAt)}</p>
        </div>
        <Link href="/dashboard"><Button variant="secondary">Back to Applications</Button></Link>
      </div>

      {error ? (
        <Card><p className="error">{error}</p></Card>
      ) : null}

      {application?.records?.length === 0 ? (
        <Card><p className="subtitle">No records available.</p></Card>
      ) : (
        <Card>
          <div className="stack section-mini-gap">
            {application.records[0].fields.map((field) => (
              <div key={`${field.label}-${field.type}`} className="field-row">
                <strong>{field.label}</strong>
                {field.type === 'text' ? (
                  <span>{field.value}</span>
                ) : field.type === 'pdf' ? (
                  <a className="link" href={field.fileUrl} target="_blank" rel="noreferrer">Open PDF</a>
                ) : (
                  <button className="button secondary" onClick={() => setImagePreview(field.fileUrl)}>Preview Image</button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={Boolean(imagePreview)} onClose={() => setImagePreview('')} title="Image Preview">
        {imagePreview ? <img src={imagePreview} alt="Application image" className="preview-image" /> : null}
      </Modal>
    </main>
  );
}
