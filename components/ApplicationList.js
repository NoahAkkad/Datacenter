import Link from 'next/link';

export function ApplicationList({ applications }) {
  if (!applications.length) {
    return <p className="subtitle">No application selected or no data available.</p>;
  }

  return (
    <div className="application-card-grid">
      {applications.map((application) => (
        <Link key={application.id} className="application-card" href={`/dashboard/applications/${application.id}`}>
          <p className="field-label">Application</p>
          <h3 className="application-card-title">{application.name}</h3>
        </Link>
      ))}
    </div>
  );
}
