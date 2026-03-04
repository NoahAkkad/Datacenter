'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { UserSidebar } from '../../components/UserSidebar';
import { HeaderMenu } from '../../components/HeaderMenu';
import { useAuth } from '../../components/AuthProvider';
import { Skeleton } from '../../components/ui/skeleton';

function toTagPath(tagName) {
  return `/tags/${encodeURIComponent(tagName.toLowerCase().replace(/\s+/g, '-'))}`;
}

export default function TagsPage() {
  const router = useRouter();
  const { user, loading: authLoading, clearUser } = useAuth();
  const [loadingSidebarData, setLoadingSidebarData] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [tags, setTags] = useState([]);
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

    const loadPageData = async () => {
      setLoadingSidebarData(true);
      setLoadingTags(true);
      setPageError('');

      try {
        const [companiesResponse, applicationsResponse, tagsResponse] = await Promise.all([
          fetch('/api/companies', { cache: 'no-store' }),
          fetch('/api/applications', { cache: 'no-store' }),
          fetch('/api/tags', { cache: 'no-store' })
        ]);

        if (!companiesResponse.ok || !applicationsResponse.ok || !tagsResponse.ok) {
          throw new Error('Failed to load tag navigation.');
        }

        const [companiesPayload, applicationsPayload, tagsPayload] = await Promise.all([
          companiesResponse.json(),
          applicationsResponse.json(),
          tagsResponse.json()
        ]);

        setCompanies(Array.isArray(companiesPayload.companies) ? companiesPayload.companies : []);
        setApplications(Array.isArray(applicationsPayload.applications) ? applicationsPayload.applications : []);
        setTags(Array.isArray(tagsPayload.tags) ? tagsPayload.tags : []);
      } catch (error) {
        setCompanies([]);
        setApplications([]);
        setTags([]);
        setPageError(error instanceof Error ? error.message : 'Unable to load tags.');
      } finally {
        setLoadingSidebarData(false);
        setLoadingTags(false);
      }
    };

    loadPageData();
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
      <UserSidebar onNavigate={() => {}} companies={companies} applications={applications} />

      <section className="main">
        <header className="dashboard-header">
          <div>
            <h1 className="title">All tags</h1>
            <p className="subtitle">Browse records by tag across all accessible applications.</p>
          </div>
          <HeaderMenu onLogout={onLogout} loggingOut={isLoggingOut} />
        </header>

        {pageError ? <Card className="error section-gap">{pageError}</Card> : null}

        {loadingSidebarData || loadingTags ? (
          <Card className="stack section-gap">
            <Skeleton style={{ height: 24, width: '30%' }} />
            <Skeleton style={{ height: 42, width: '100%' }} />
            <Skeleton style={{ height: 42, width: '100%' }} />
          </Card>
        ) : (
          <Card className="stack section-gap">
            {tags.length ? (
              <div className="tag-chip-grid">
                {tags.map((tag) => (
                  <Link key={tag} href={toTagPath(tag)} className="tag-chip-btn">
                    {tag}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="subtitle">No tags available.</p>
            )}
          </Card>
        )}
      </section>
    </main>
  );
}
