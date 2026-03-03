'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { ApplicationList } from '../../components/ApplicationList';
import { UserSidebar } from '../../components/UserSidebar';
import { Icon, icons } from '../../components/ui/icons';

export default function DashboardPage() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState('home');
  const [query, setQuery] = useState('');
  const [applications, setApplications] = useState([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    setActive(tab === 'applications' ? 'applications' : 'home');
  }, []);

  useEffect(() => {
    const validateSession = async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.replace('/login?portal=user');
        return;
      }

      const user = await response.json();
      if (user.role === 'admin') {
        router.replace('/admin');
        return;
      }
      setCheckingSession(false);
    };

    validateSession();
  }, [router]);

  useEffect(() => {
    if (checkingSession) return;

    const loadApplications = async () => {
      setError('');
      const params = new URLSearchParams();
      if (query.trim()) params.set('search', query.trim());
      const response = await fetch(`/api/applications?${params.toString()}`);
      if (!response.ok) {
        setError('Unable to load applications.');
        return;
      }

      const payload = await response.json();
      setApplications(payload.applications || []);
    };

    loadApplications();
  }, [checkingSession, query]);

  const onLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      window.localStorage.removeItem('authToken');
      window.sessionStorage.removeItem('authToken');
      setIsLoggingOut(false);
      setLogoutConfirmOpen(false);
      router.replace('/login?portal=user');
      router.refresh();
    }
  };

  const filteredCountLabel = useMemo(() => `${applications.length} application${applications.length === 1 ? '' : 's'}`, [applications]);

  if (checkingSession) {
    return <main className="flex min-h-screen items-center justify-center"><div className="h-10 w-56 skeleton" /></main>;
  }

  return (
    <main className="flex min-h-screen bg-slate-100">
      <UserSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} activeTab={active} onNavigate={setActive} />

      <section className="flex-1 p-4 md:p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">User Dashboard</h1>
            <p className="text-sm text-slate-500">Secure access to your application data</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Icon path={icons.search} className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="w-64 pl-9" placeholder="Search applications" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <button className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Icon path={icons.bell} className="h-5 w-5" /></button>
            <Button variant="secondary" onClick={() => setLogoutConfirmOpen(true)}><Icon path={icons.user} className="mr-1 h-4 w-4" />Logout</Button>
          </div>
        </header>

        {active === 'home' && (
          <Card className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Welcome</h2>
            <p className="mt-1 text-sm text-slate-500">Use the sidebar for navigation. Applications are grouped and searchable.</p>
          </Card>
        )}

        <Card className="mb-4 space-y-3 sm:hidden">
          <Input placeholder="Search applications" value={query} onChange={(event) => setQuery(event.target.value)} />
        </Card>

        <Card className="space-y-4">
          <p className="text-sm text-slate-500">{filteredCountLabel}</p>
          {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
          <ApplicationList applications={applications} />
        </Card>
      </section>

      <Modal open={logoutConfirmOpen} onClose={() => !isLoggingOut && setLogoutConfirmOpen(false)} title="Confirm Logout">
        <p className="text-sm text-slate-500">Are you sure you want to logout?</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setLogoutConfirmOpen(false)} disabled={isLoggingOut}>Cancel</Button>
          <Button variant="danger" onClick={onLogout} disabled={isLoggingOut}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Button>
        </div>
      </Modal>
    </main>
  );
}
