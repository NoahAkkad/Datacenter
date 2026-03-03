'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';

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
