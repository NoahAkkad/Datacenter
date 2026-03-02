import Link from 'next/link';

export default function Home() {
  return (
    <section className="card">
      <h1>Data Center Management System</h1>
      <p>Securely store and browse company application data.</p>
      <div className="row">
        <Link className="button" href="/login?portal=admin">Admin Login</Link>
        <Link className="button outline" href="/login?portal=user">User Login</Link>
      </div>
      <p className="hint">Default admin credentials: <code>admin / admin123</code></p>
    </section>
  );
}
