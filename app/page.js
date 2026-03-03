import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

function readTokenPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export default function Home() {
  const token = cookies().get('auth')?.value;

  if (!token) {
    redirect('/login?portal=user');
  }

  const payload = readTokenPayload(token);
  const isExpired = payload?.exp ? payload.exp * 1000 <= Date.now() : true;
  if (isExpired) {
    redirect('/login?portal=user');
  }

  if (payload?.role === 'admin') {
    redirect('/admin');
  }

  redirect('/dashboard');
}
