import Link from 'next/link';
import { Card } from '../components/ui/card';

export default function Home() {
  return (
    <main className="page-center">
      <Card className="home fade-in home-card">
        <p className="home-kicker">Data Center Suite</p>
        <h1 className="title">Data Center Management Web Application</h1>
        <p className="subtitle">Professional interface for companies, applications, dynamic fields, and file-managed records.</p>
        <div className="row home-actions">
          <Link className="button primary" href="/login?portal=admin">Admin Portal</Link>
          <Link className="button secondary" href="/login?portal=user">User Portal</Link>
        </div>
        <p className="home-credentials">Default admin credentials: admin / admin123</p>
      </Card>
    </main>
  );
}
