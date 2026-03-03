'use client';

function formatDisplayName(username = '') {
  const cleanedName = String(username || '').trim();
  if (!cleanedName) return 'User';

  return cleanedName
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function HeaderProfile({ user, loading = false, onClick, fallbackEmail = 'Email unavailable' }) {
  if (loading) {
    return (
      <button className="profile-trigger" type="button" disabled>
        <strong>Loading profile...</strong>
        <p className="subtitle">Fetching authenticated user</p>
      </button>
    );
  }

  const displayName = formatDisplayName(user?.username);
  const sanitizedEmail = String(user?.email || '').trim();
  const displayEmail = sanitizedEmail || fallbackEmail;

  return (
    <button className="profile-trigger" type="button" onClick={onClick}>
      <strong>{displayName}</strong>
      <p className="subtitle">{displayEmail}</p>
    </button>
  );
}
