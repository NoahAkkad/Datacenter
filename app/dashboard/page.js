'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';

export default function DashboardPage() {
  const [company, setCompany] = useState('');
  const [application, setApplication] = useState('');
  const [results, setResults] = useState([]);
  const [imagePreview, setImagePreview] = useState('');

  const search = async () => {
    const query = new URLSearchParams({ company, application }).toString();
    const response = await fetch(`/api/browse?${query}`);
    if (response.ok) setResults(await response.json());
  };

  useEffect(() => {
    search();
  }, []);

  const stats = useMemo(() => ({
    companies: results.length,
    apps: results.reduce((sum, entry) => sum + entry.applications.length, 0)
  }), [results]);

  return (
    <main className="user-wrap">
      <header>
        <h1 className="title">User Dashboard</h1>
        <p className="subtitle">Search, filter, and browse structured application records.</p>
      </header>

      <Card className="stack">
        <div className="row">
          <Input placeholder="Search company" value={company} onChange={(event) => setCompany(event.target.value)} />
          <Input placeholder="Search application" value={application} onChange={(event) => setApplication(event.target.value)} />
          <Button onClick={search}>Search</Button>
        </div>
        <p className="subtitle">{stats.companies} companies · {stats.apps} applications</p>
      </Card>

      <div className="stack section-gap">
        {results.map((companyEntry) => (
          <Card key={companyEntry.id}>
            <h2>{companyEntry.name}</h2>
            <div className="app-grid">
              {companyEntry.applications.map((applicationEntry) => (
                <article key={applicationEntry.id} className="record">
                  <h3>{applicationEntry.name}</h3>
                  {applicationEntry.records.length === 0 ? <p className="subtitle">No records available.</p> : applicationEntry.records.map((record) => (
                    <div key={record.id} className="record">
                      {applicationEntry.fields.map((field) => {
                        const value = record.values?.[field.id];
                        if (!value) return null;

                        return (
                          <div key={field.id} className="field-row">
                            <span>{field.name}</span>
                            {field.type === 'text' ? <span>{value}</span> : field.type === 'pdf' ? <a href={value.url} target="_blank" className="link">Preview PDF</a> : <button className="button secondary" onClick={() => setImagePreview(value.url)}>Preview Image</button>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(imagePreview)} onClose={() => setImagePreview('')} title="Image Preview">
        {imagePreview ? <img src={imagePreview} alt="Record preview" className="preview-image" /> : null}
      </Modal>
    </main>
  );
}
