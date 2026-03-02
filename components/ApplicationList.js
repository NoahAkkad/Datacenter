import Link from 'next/link';

export function ApplicationList({ applications }) {
  if (!applications.length) {
    return <p className="subtitle">No applications found.</p>;
  }

  return (
    <div className="stack">
      {applications.map((application) => (
        <Link key={application.id} className="record" href={`/dashboard/applications/${application.id}`}>
          <h3>{application.name}</h3>
        </Link>
      ))}
    </div>
  );
}
