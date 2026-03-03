import Link from 'next/link';

export function ApplicationList({ applications }) {
  if (!applications.length) {
    return <p className="text-sm text-slate-500">No applications found.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {applications.map((application) => (
        <Link key={application.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href={`/dashboard/applications/${application.id}`}>
          <h3 className="text-base font-semibold text-slate-900">{application.name}</h3>
          <p className="mt-1 text-sm text-slate-500">Open secure fields and credentials</p>
        </Link>
      ))}
    </div>
  );
}
