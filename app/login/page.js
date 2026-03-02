'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export default function LoginPage() {
  const params = useSearchParams();
  const router = useRouter();
  const portal = params.get('portal') || 'user';
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, portal })
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error || 'Login failed');
      return;
    }

    router.push(portal === 'admin' ? '/admin' : '/dashboard');
  };

  const isAdmin = portal === 'admin';

  return (
    <main className="page-center">
      <div className="auth-wrap fade-in">
        <Card className="stack">
          <div>
            <h1 className="login-title">{isAdmin ? '🛡️ Admin Portal Login' : '👤 User Portal Login'}</h1>
            <p className="subtitle">Welcome back. Sign in to continue.</p>
          </div>

          <div className="pill-switch">
            <button className={isAdmin ? 'active' : ''} onClick={() => router.push('/login?portal=admin')}>Admin</button>
            <button className={!isAdmin ? 'active' : ''} onClick={() => router.push('/login?portal=user')}>User</button>
          </div>

          <form className="stack" onSubmit={onSubmit}>
            <Input required placeholder="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            <Input required type="password" placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            {error && <p className="error">{error}</p>}
            <Button type="submit">Sign In</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
