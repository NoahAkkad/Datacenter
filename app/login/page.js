'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const PREVIOUS_USERS_KEY = 'previousUsers';
const MAX_SUGGESTIONS = 5;

function LoginContent() {
  const params = useSearchParams();
  const router = useRouter();
  const portal = params.get('portal') || 'user';
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedUsers, setSavedUsers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const storedUsers = window.localStorage.getItem(PREVIOUS_USERS_KEY);
    if (!storedUsers) return;

    try {
      const parsedUsers = JSON.parse(storedUsers);
      if (!Array.isArray(parsedUsers)) return;
      setSavedUsers(parsedUsers.filter((user) => typeof user === 'string' && user.trim()).slice(0, MAX_SUGGESTIONS));
    } catch {
      window.localStorage.removeItem(PREVIOUS_USERS_KEY);
    }
  }, []);

  const saveUsername = (username) => {
    const cleanedUsername = username.trim();
    if (!cleanedUsername) return;

    const nextUsers = [
      cleanedUsername,
      ...savedUsers.filter((user) => user.toLowerCase() !== cleanedUsername.toLowerCase())
    ].slice(0, MAX_SUGGESTIONS);

    setSavedUsers(nextUsers);
    window.localStorage.setItem(PREVIOUS_USERS_KEY, JSON.stringify(nextUsers));
  };

  const suggestions = useMemo(() => {
    const usernameInput = form.username.trim().toLowerCase();
    if (!usernameInput) return savedUsers;
    return savedUsers.filter((user) => user.toLowerCase().includes(usernameInput));
  }, [form.username, savedUsers]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, portal })
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error || 'Login failed');
      setLoading(false);
      return;
    }

    const payload = await response.json();
    saveUsername(form.username);
    const destination = payload.role === 'admin' ? '/admin' : '/dashboard';
    router.push(destination);
    router.refresh();
  };

  const isAdmin = portal === 'admin';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{isAdmin ? 'Admin Portal Login' : 'User Portal Login'}</h1>
            <p className="mt-1 text-sm text-slate-500">Welcome back. Sign in to continue.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            <button className={`rounded-md px-3 py-2 text-sm font-medium transition ${isAdmin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`} onClick={() => router.push('/login?portal=admin')}>Admin</button>
            <button className={`rounded-md px-3 py-2 text-sm font-medium transition ${!isAdmin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`} onClick={() => router.push('/login?portal=user')}>User</button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="username-autocomplete">
              <Input required placeholder="Username" value={form.username} autoComplete="username" onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 120)} onChange={(event) => {
                setForm({ ...form, username: event.target.value });
                setShowSuggestions(true);
              }} />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="username-suggestions" role="listbox" aria-label="Previous usernames">
                  {suggestions.map((user) => (
                    <li key={user}>
                      <button type="button" className="username-suggestion-btn" onMouseDown={() => {
                        setForm((current) => ({ ...current, username: user }));
                        setShowSuggestions(false);
                      }}>{user}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Input required type="password" placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center">Loading login...</main>}>
      <LoginContent />
    </Suspense>
  );
}
