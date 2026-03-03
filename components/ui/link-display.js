'use client';

import { useEffect, useMemo, useState } from 'react';

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function normalizeLinkHref(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function LinkDisplay({ value, emptyPlaceholder = '—' }) {
  const [copied, setCopied] = useState(false);
  const displayValue = useMemo(() => String(value || '').trim(), [value]);
  const href = useMemo(() => normalizeLinkHref(displayValue), [displayValue]);

  useEffect(() => {
    if (!copied) return undefined;

    const timeoutId = window.setTimeout(() => setCopied(false), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleCopy = async () => {
    if (!displayValue) return;

    try {
      await navigator.clipboard.writeText(displayValue);
      setCopied(true);
    } catch (_error) {
      const helperInput = document.createElement('textarea');
      helperInput.value = displayValue;
      document.body.appendChild(helperInput);
      helperInput.select();
      document.execCommand('copy');
      document.body.removeChild(helperInput);
      setCopied(true);
    }
  };

  if (!displayValue) {
    return <span>{emptyPlaceholder}</span>;
  }

  return (
    <div className="link-display-wrap">
      <a className="link-display-anchor" href={href} target="_blank" rel="noopener noreferrer">{displayValue}</a>
      <button
        type="button"
        className={`action-icon-btn action-icon-btn--blue ${copied ? 'is-success' : ''}`}
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy'}
        title={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      {copied ? <span className="sr-only" role="status">Copied</span> : null}
    </div>
  );
}
