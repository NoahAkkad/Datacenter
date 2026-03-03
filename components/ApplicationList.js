import Link from 'next/link';

export function ApplicationList({ applications }) {
  if (!applications.length) {
    return <p className="subtitle">No applications found.</p>;
  }

  return (
    <div className="app-card-grid">
      {applications.map((application) => (
        <Link key={application.id} className="app-card" href={`/dashboard/applications/${application.id}`}>
          <h3>{application.name}</h3>
          <p className="subtitle">Open details</p>
        </Link>
      ))}
    </div>
  );
}
