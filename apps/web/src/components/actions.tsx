'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, RefreshCw } from 'lucide-react';
import { apiSend } from '@/lib/api';

export function CheckMonitorButton({ id, size = 'sm' }: { id: string; size?: 'sm' | 'md' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    setBusy(true);
    setMessage(null);
    const response = await apiSend(`/api/v1/monitors/${id}/check`, 'POST');
    const result = response.data as { success?: boolean; latencyMs?: number; error?: string } | null;
    if (!response.ok) {
      setFailed(true);
      setMessage(
        (result && 'message' in result ? String((result as { message?: string }).message) : null) ??
          `Check failed (HTTP ${response.status}).`,
      );
    } else {
      setFailed(!result?.success);
      setMessage(
        result?.success
          ? `Check succeeded in ${result.latencyMs ?? '—'} ms.`
          : `Check completed with failure: ${result?.error ?? 'unknown error'}`,
      );
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <span className="row" style={{ gap: 8 }}>
      <button
        className={`btn ${size === 'md' ? '' : 'btn-sm'} btn-ghost`}
        type="button"
        onClick={() => void run()}
        disabled={busy}
        title="Run one explicit endpoint check now"
      >
        {busy ? <Loader2 size={12} className="spin" /> : <Play size={12} />}
        {busy ? 'Checking' : 'Run check'}
      </button>
      {message ? (
        <span className="tiny" style={{ color: failed ? '#eda5a1' : '#9fd3b9', maxWidth: 320 }}>
          {message}
        </span>
      ) : null}
    </span>
  );
}

export function RunDueMonitorsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="row" style={{ gap: 8 }}>
      <button
        className="btn btn-sm"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const response = await apiSend('/api/v1/monitors/run-due', 'POST');
          setBusy(false);
          setMessage(
            response.ok
              ? 'Due monitors executed. Checks written to history.'
              : `Run failed (HTTP ${response.status}).`,
          );
          router.refresh();
        }}
      >
        {busy ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
        {busy ? 'Running' : 'Run due checks'}
      </button>
      {message ? <span className="tiny muted">{message}</span> : null}
    </span>
  );
}

export function CollectNowButton({ networkId }: { networkId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="row" style={{ gap: 8 }}>
      <button
        className="btn btn-sm"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const response = await apiSend(
            '/api/v1/collect',
            'POST',
            networkId ? { networkIds: [networkId] } : {},
          );
          setBusy(false);
          setMessage(
            response.ok
              ? 'Collection completed. Source observations were written.'
              : `Collection failed (HTTP ${response.status}).`,
          );
          router.refresh();
        }}
      >
        {busy ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
        {busy ? 'Collecting' : networkId ? 'Collect this source' : 'Collect all sources'}
      </button>
      {message ? <span className="tiny muted">{message}</span> : null}
    </span>
  );
}

export function AlertRuleToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);
  const [busy, setBusy] = useState(false);
  return (
    <label className="row tiny muted" style={{ gap: 7, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={busy}
        onChange={async (event) => {
          const next = event.target.checked;
          setChecked(next);
          setBusy(true);
          const response = await apiSend(`/api/v1/alert-rules/${id}`, 'PATCH', { enabled: next });
          if (!response.ok) setChecked(!next);
          setBusy(false);
          router.refresh();
        }}
        style={{ accentColor: '#42B8C5' }}
      />
      {checked ? 'Enabled' : 'Disabled'}
    </label>
  );
}
