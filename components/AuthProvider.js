'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'include'
      });

      if (!response.ok) {
        setUser(null);
        return null;
      }

      const payload = await response.json();
      const normalizedUser = {
        id: payload?.id || payload?.user?.id || '',
        username: String(payload?.username || payload?.user?.username || '').trim(),
        email: String(payload?.email || payload?.user?.email || '').trim(),
        role: String(payload?.role || payload?.user?.role || '').trim()
      };

      setUser(normalizedUser);
      return normalizedUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const clearUser = useCallback(() => {
    setUser(null);
    setLoading(false);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    refreshUser,
    clearUser
  }), [clearUser, loading, refreshUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
