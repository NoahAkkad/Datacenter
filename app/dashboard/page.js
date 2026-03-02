'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [company, setCompany] = useState('');
  const [application, setApplication] = useState('');
  const [results, setResults] = useState([]);

  const search = async () => {
    const query = new URLSearchParams({ company, application }).toString();
    const res = await fetch(`/api/browse?${query}`);
    if (res.ok) setResults(await res.json());
  };

  useEffect(() => {
    search();
  }, []);

  return (
    <div className="stack">
      <h1>User Dashboard</h1>
      <section className="card row">
        <input placeholder="Search company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input placeholder="Search application" value={application} onChange={(e) => setApplication(e.target.value)} />
        <button className="button" onClick={search}>Search</button>
      </section>

      {results.map((c) => (
        <section key={c.id} className="card stack">
          <h2>{c.name}</h2>
          {c.applications.map((a) => (
            <article key={a.id} className="stack nested">
              <h3>{a.name}</h3>
              {a.records.length === 0 && <p className="hint">No records yet.</p>}
              {a.records.map((r) => (
                <div key={r.id} className="record">
                  {a.fields.map((f) => {
                    const val = r.values?.[f.id];
                    if (!val) return null;
                    return (
                      <div key={f.id}>
                        <strong>{f.name}: </strong>
                        {f.type === 'text' ? (
                          <span>{val}</span>
                        ) : (
                          <a href={val.url} target="_blank">Open {f.type.toUpperCase()}</a>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
