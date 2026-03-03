'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Modal } from '../../../../components/ui/modal';
import { Icon, icons } from '../../../../components/ui/icons';

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toISOString().slice(0, 10);
}

export default function ApplicationDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [revealedFields, setRevealedFields] = useState({});
  const [toast, setToast] = useState('');

  useEffect(() => {
    const loadApplication = async () => {
      const meResponse = await fetch('/api/auth/me');
      if (!meResponse.ok) return router.replace('/login?portal=user');
      const me = await meResponse.json();
      if (me.role === 'admin') return router.replace('/admin');

      const response = await fetch(`/api/applications/${id}`);
      if (response.status === 404) {
        setError('Application not found.');
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError('Failed to load application details.');
        setLoading(false);
        return;
      }

      const payload = await response.json();
      setApplication(payload);
      setLoading(false);
    };

    if (id) loadApplication();
  }, [id, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const groupedFields = useMemo(() => {
    const groups = application?.groupedFields || {};
    if (Object.keys(groups).length) return groups;
    if (!application?.fields?.length) return {};
    return { 'General Information': application.fields };
  }, [application]);

  const toggleSection = (name) => setCollapsedSections((s) => ({ ...s, [name]: !s[name] }));
  const toggleReveal = (key) => setRevealedFields((s) => ({ ...s, [key]: !s[key] }));

  const copyValue = async (value) => {
    if (!value) return;
    await navigator.clipboard.writeText(String(value));
    setToast('Copied to clipboard');
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center"><div className="h-10 w-64 skeleton" /></main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{application?.name || 'Application Details'}</h1>
          <p className="text-sm text-slate-500">{application?.companyName ? `Company: ${application.companyName}` : 'Read-only application data.'}</p>
          <p className="text-xs text-slate-400">Created: {formatDate(application?.createdAt)} · Updated: {formatDate(application?.updatedAt)}</p>
        </div>
        <Link href="/dashboard"><Button variant="secondary">Back to Applications</Button></Link>
      </div>

      {error ? <Card><p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p></Card> : null}

      {Object.keys(groupedFields).length === 0 ? (
        <Card><p className="text-sm text-slate-500">No records available.</p></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedFields).map(([tagName, tagFields]) => {
            const collapsed = collapsedSections[tagName];
            return (
              <Card key={tagName} className="p-0">
                <button className="flex w-full items-center justify-between rounded-xl px-5 py-4 text-left hover:bg-slate-50" onClick={() => toggleSection(tagName)}>
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon path={icons.tags} className="h-4 w-4" /> {tagName || 'General Information'}</span>
                  <span className="text-xs text-slate-500">{collapsed ? 'Expand' : 'Collapse'}</span>
                </button>
                {!collapsed && (
                  <div className="grid gap-3 border-t border-slate-200 p-5 md:grid-cols-2">
                    {tagFields.map((field) => {
                      const fkey = `${tagName}-${field.label}`;
                      const isPassword = /password/i.test(field.label || '');
                      const textValue = field.value || '—';
                      const masked = isPassword && !revealedFields[fkey];
                      return (
                        <div key={fkey} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{field.label}</p>
                          <div className="mt-1 flex items-center justify-between gap-2 text-sm text-slate-800">
                            {field.type === 'text' ? <span>{masked ? '••••••••' : textValue}</span> : null}
                            {field.type === 'pdf' ? (field.fileUrl ? <a className="text-slate-700 underline" href={field.fileUrl} target="_blank" rel="noreferrer">Open PDF</a> : <span>—</span>) : null}
                            {field.type !== 'text' && field.type !== 'pdf' ? (field.fileUrl ? <button className="text-slate-700 underline" onClick={() => setImagePreview(field.fileUrl)}>Preview Image</button> : <span>—</span>) : null}
                            {field.type === 'text' && (
                              <div className="flex gap-1">
                                {isPassword ? <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => toggleReveal(fkey)}><Icon path={icons.eye} className="h-3.5 w-3.5" /></Button> : null}
                                <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => copyValue(textValue)}><Icon path={icons.copy} className="h-3.5 w-3.5" /></Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(imagePreview)} onClose={() => setImagePreview('')} title="Image Preview">
        {imagePreview ? <img src={imagePreview} alt="Application" className="max-h-[70vh] w-full rounded-lg object-contain" /> : null}
      </Modal>

      {toast ? <div className="fixed bottom-4 right-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div> : null}
    </main>
  );
}
