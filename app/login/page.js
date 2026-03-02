'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const params = useSearchParams();
  const router = useRouter();
  const portal = params.get('portal') || 'user';
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, portal })
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Login failed');
      return;
    }

    router.push(portal === 'admin' ? '/admin' : '/dashboard');
  };

  return (
    <section className="card">
      <h1>{portal === 'admin' ? 'Admin Portal' : 'User Portal'} Login</h1>
      <form onSubmit={onSubmit} className="stack">
        <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="button">Login</button>
      </form>
    </section>
  );
}
