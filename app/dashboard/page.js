'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { UserSidebar } from '../../components/UserSidebar';

export default function DashboardPage() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState('home');
  const [checkingSession, setCheckingSession] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  useEffect(() => {
    const validateSession = async () => {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!response.ok) {
        router.replace('/login?portal=user');
        return;
      }

      const user = await response.json();
      if (user.role === 'admin') {
        router.replace('/admin');
        return;
      }
      setCurrentUserProfile(user);
      setCheckingSession(false);
    };

    validateSession();
  }, [router]);

  const onLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      window.localStorage.removeItem('authToken');
      window.sessionStorage.removeItem('authToken');
      setCurrentUserProfile(null);
      setIsLoggingOut(false);
      setLogoutConfirmOpen(false);
      router.replace('/login?portal=user');
      router.refresh();
    }
  };


  const formatDisplayName = (username = '') => {
    const cleanedName = String(username || '').trim();
    if (!cleanedName) return 'User';
    return cleanedName
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  };

  const displayName = formatDisplayName(currentUserProfile?.username);
  const displayEmail = currentUserProfile?.email || 'No email available';

  if (checkingSession) {
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
            <h1 className="title">User Dashboard</h1>
            <p className="subtitle">Welcome to the user panel.</p>
          </div>
          <div className="profile">
            <button className="profile-trigger" onClick={() => setLogoutConfirmOpen(true)}>
              <strong>{displayName}</strong>
              <p className="subtitle">{displayEmail}</p>
            </button>
          </div>
        </header>

        <Card className="stack">
          <h2>Welcome Home</h2>
          <p className="subtitle">Use this dashboard to access user features.</p>
        </Card>
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
