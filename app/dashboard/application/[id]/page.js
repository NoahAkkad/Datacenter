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
  const [activeView, setActiveView] = useState('information');
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagsError, setTagsError] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [tagResults, setTagResults] = useState([]);
  const [loadingTagResults, setLoadingTagResults] = useState(false);

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

  useEffect(() => {
    if (authLoading || !user || user.role === 'admin') return;
    if (activeView !== 'tags') return;
    if (availableTags.length > 0) return;

    const loadTags = async () => {
      setLoadingTags(true);
      setTagsError('');

      try {
        const response = await fetch('/api/tags/search', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load tags.');
        }

        const payload = await response.json();
        setAvailableTags(Array.isArray(payload.tags) ? payload.tags : []);
      } catch (error) {
        setAvailableTags([]);
        setTagsError(error instanceof Error ? error.message : 'Unable to load tags.');
      } finally {
        setLoadingTags(false);
      }
    };

    loadTags();
  }, [activeView, authLoading, availableTags.length, user]);

  const onSelectTag = async (tagName) => {
    setSelectedTag(tagName);
    setLoadingTagResults(true);
    setTagsError('');

    try {
      const response = await fetch(`/api/tags/search?name=${encodeURIComponent(tagName)}`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Failed to load tag results.');
      }

      const payload = await response.json();
      const nextResults = Array.isArray(payload.results) ? payload.results : [];
      setTagResults(nextResults);
    } catch (error) {
      setTagResults([]);
      setTagsError(error instanceof Error ? error.message : 'Unable to load tag results.');
    } finally {
      setLoadingTagResults(false);
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

        <div className="section-gap tab-switcher" role="tablist" aria-label="Application section switcher">
          <button
            type="button"
            className={`tab-switcher-btn ${activeView === 'information' ? 'active' : ''}`}
            onClick={() => setActiveView('information')}
            role="tab"
            aria-selected={activeView === 'information'}
          >
            Information
          </button>
          <button
            type="button"
            className={`tab-switcher-btn ${activeView === 'tags' ? 'active' : ''}`}
            onClick={() => setActiveView('tags')}
            role="tab"
            aria-selected={activeView === 'tags'}
          >
            Tags
          </button>
        </div>

        {activeView === 'information' ? (loadingDetails ? (
          <Card className="section-gap stack">
            <Skeleton style={{ height: 24, width: '35%' }} />
            <Skeleton style={{ height: 52, width: '100%' }} />
            <Skeleton style={{ height: 52, width: '100%' }} />
          </Card>
        ) : (
          <div className="section-gap">
            <GroupedFieldsView groupedFields={applicationDetails?.groupedFields || []} />
          </div>
        )) : (
          <div className="section-gap stack">
            {tagsError ? <Card className="error">{tagsError}</Card> : null}
            {loadingTags ? (
              <Card className="stack">
                <Skeleton style={{ height: 24, width: '25%' }} />
                <Skeleton style={{ height: 80, width: '100%' }} />
              </Card>
            ) : (
              <Card className="stack">
                <h2 className="section-title">All tags</h2>
                {availableTags.length ? (
                  <div className="tag-chip-grid">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`tag-chip-btn ${selectedTag === tag ? 'active' : ''}`}
                        onClick={() => onSelectTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : <p className="subtitle">No tags available.</p>}
              </Card>
            )}

            {selectedTag ? (
              <div className="stack">
                <h2 className="section-title">{selectedTag}</h2>
                {loadingTagResults ? (
                  <Card className="stack">
                    <Skeleton style={{ height: 22, width: '50%' }} />
                    <Skeleton style={{ height: 42, width: '100%' }} />
                  </Card>
                ) : tagResults.length ? (
                  <div className="stack">
                    {tagResults.map((result) => (
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
                  <Card className="empty-state-card">
                    <p className="subtitle">No matching entries found for this tag.</p>
                  </Card>
                )}
              </div>
            ) : null}
          </div>
        )}
      </section>

    </main>
  );
}
