'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../components/ui/card';
import { UserSidebar } from '../../../components/UserSidebar';
import { HeaderMenu } from '../../../components/HeaderMenu';
import { useAuth } from '../../../components/AuthProvider';
import { Skeleton } from '../../../components/ui/skeleton';

function toTagSlug(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '-');
}

export default function TagDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const requestedTag = params?.tagName;
  const { user, loading: authLoading, clearUser } = useAuth();

  const [loadingPageData, setLoadingPageData] = useState(false);
  const [loadingTagResults, setLoadingTagResults] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedTagName, setSelectedTagName] = useState('');
  const [results, setResults] = useState([]);
  const [pageError, setPageError] = useState('');

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

    const loadNavigationData = async () => {
      setLoadingPageData(true);
      setPageError('');

      try {
        const [companiesResponse, applicationsResponse, tagsResponse] = await Promise.all([
          fetch('/api/companies', { cache: 'no-store' }),
          fetch('/api/applications', { cache: 'no-store' }),
          fetch('/api/tags', { cache: 'no-store' })
        ]);

        if (!companiesResponse.ok || !applicationsResponse.ok || !tagsResponse.ok) {
          throw new Error('Failed to load tag details.');
        }

        const [companiesPayload, applicationsPayload, tagsPayload] = await Promise.all([
          companiesResponse.json(),
          applicationsResponse.json(),
          tagsResponse.json()
        ]);

        const nextTags = Array.isArray(tagsPayload.tags) ? tagsPayload.tags : [];
        const matchedTag = nextTags.find((tag) => toTagSlug(tag) === requestedTag);

        setCompanies(Array.isArray(companiesPayload.companies) ? companiesPayload.companies : []);
        setApplications(Array.isArray(applicationsPayload.applications) ? applicationsPayload.applications : []);
        if (!matchedTag) {
          setSelectedTagName('');
          setResults([]);
          setPageError('Tag not found.');
          return;
        }

        setSelectedTagName(matchedTag);
      } catch (error) {
        setCompanies([]);
        setApplications([]);
        setSelectedTagName('');
        setResults([]);
        setPageError(error instanceof Error ? error.message : 'Unable to load tag details.');
      } finally {
        setLoadingPageData(false);
      }
    };

    loadNavigationData();
  }, [authLoading, requestedTag, user]);

  useEffect(() => {
    if (!selectedTagName || authLoading || !user || user.role === 'admin') return;

    const loadResults = async () => {
      setLoadingTagResults(true);
      setPageError('');

      try {
        const response = await fetch(`/api/tags/search?name=${encodeURIComponent(selectedTagName)}`, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('Failed to load tag records.');
        }

        const payload = await response.json();
        setResults(Array.isArray(payload.results) ? payload.results : []);
      } catch (error) {
        setResults([]);
        setPageError(error instanceof Error ? error.message : 'Unable to load tag records.');
      } finally {
        setLoadingTagResults(false);
      }
    };

    loadResults();
  }, [authLoading, selectedTagName, user]);

  const groupedLabel = useMemo(() => {
    if (!selectedTagName) return 'Tag details';
    return `Records tagged: ${selectedTagName}`;
  }, [selectedTagName]);

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
      <UserSidebar onNavigate={() => {}} companies={companies} applications={applications} />

      <section className="main">
        <header className="dashboard-header">
          <div>
            <h1 className="title">{selectedTagName || 'Tag details'}</h1>
            <p className="subtitle">{groupedLabel}</p>
          </div>
          <HeaderMenu onLogout={onLogout} loggingOut={isLoggingOut} />
        </header>

        {pageError ? <Card className="error section-gap">{pageError}</Card> : null}

        {loadingPageData || loadingTagResults ? (
          <Card className="stack section-gap">
            <Skeleton style={{ height: 20, width: '40%' }} />
            <Skeleton style={{ height: 58, width: '100%' }} />
            <Skeleton style={{ height: 58, width: '100%' }} />
          </Card>
        ) : results.length ? (
          <div className="stack section-gap">
            {results.map((result) => (
              <details key={`${result.company}-${result.application}`} className="tag-result-card" open>
                <summary>
                  <span>Company: {result.company}</span>
                  <span>Application: {result.application}</span>
                </summary>
                <div className="tag-result-fields">
                  {result.fields.map((field) => (
                    <div key={`${result.company}-${result.application}-${field.name}`} className="tag-result-field-row">
                      <strong>{field.name}</strong>
                      <span>{field.value || '—'}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <Card className="empty-state-card section-gap">
            <p className="subtitle">No matching entries found for this tag.</p>
          </Card>
        )}
      </section>
    </main>
  );
}
