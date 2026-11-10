'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { apiSend, type NetworkSummary } from '@/lib/api';

export function MonitorForm({ networks }: { networks: NetworkSummary[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    networkId: '',
    targetUrl: '',
    method: 'GET',
    requestBody: '',
    expectedStatus: '200',
    expectedBodyContains: '',
    intervalSeconds: '300',
    timeoutMs: '10000',
    retries: '2',
    headers: '',
    enabled: true,
  });

  const set = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    let headers: Record<string, string> | null = null;
    if (form.headers.trim()) {
      try {
        const parsed = JSON.parse(form.headers) as Record<string, string>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        headers = parsed;
      } catch {
        setError('Headers must be a JSON object with string values, for example {"Authorization":"Bearer …"}.');
        return;
      }
    }
    setSubmitting(true);
    const response = await apiSend('/api/v1/monitors', 'POST', {
      name: form.name,
      networkId: form.networkId || null,
      kind: form.method === 'POST' ? 'jsonrpc' : 'http',
      targetUrl: form.targetUrl,
      method: form.method,
      requestBody: form.requestBody || null,
      expectedStatus: Number(form.expectedStatus),
      expectedBodyContains: form.expectedBodyContains || null,
      intervalSeconds: Number(form.intervalSeconds),
      timeoutMs: Number(form.timeoutMs),
      retries: Number(form.retries),
      headers,
      enabled: form.enabled,
    });
    setSubmitting(false);
    if (!response.ok) {
      const payload = response.data as { message?: string; issues?: Array<{ path: string; message: string }> } | null;
      const issueText = payload?.issues?.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
      setError(payload?.message ?? issueText ?? `The monitor could not be created (HTTP ${response.status}).`);
      return;
    }
    const created = response.data as { id: string };
    router.push(`/app/monitors/${created.id}`);
  };

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-head">
        <h2>Endpoint monitor</h2>
        <span className="badge badge-observed"><ShieldCheck size={10} /> SSRF validated</span>
      </div>
      <div className="panel-pad stack">
        {error ? <div className="error-banner" style={{ margin: 0 }}>{error}</div> : null}
        <div className="form-grid">
          <label className="field full">
            <span>Name</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Akash provider endpoint — sjc1"
            />
          </label>
          <label className="field">
            <span>Associated network</span>
            <select value={form.networkId} onChange={(event) => set('networkId', event.target.value)}>
              <option value="">Unscoped monitor</option>
              {networks.map((network) => (
                <option key={network.id} value={network.id}>{network.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>HTTP method</span>
            <select value={form.method} onChange={(event) => set('method', event.target.value)}>
              <option value="GET">GET</option>
              <option value="HEAD">HEAD</option>
              <option value="POST">POST (JSON-RPC)</option>
            </select>
          </label>
          <label className="field full">
            <span>Target URL</span>
            <input
              required
              type="url"
              value={form.targetUrl}
              onChange={(event) => set('targetUrl', event.target.value)}
              placeholder="https://provider.example.com:8443/status"
            />
            <span className="hint">
              HTTPS is required for public targets. Private, loopback and link-local addresses are
              rejected; redirects are not followed. Ports must be in the server allowlist (80, 443,
              3000, 8000, 8080, 8443, 16127 by default).
            </span>
          </label>
          {form.method === 'POST' ? (
            <label className="field full">
              <span>JSON request body</span>
              <textarea
                value={form.requestBody}
                onChange={(event) => set('requestBody', event.target.value)}
                placeholder={'{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'}
              />
            </label>
          ) : null}
          <label className="field">
            <span>Expected HTTP status</span>
            <input type="number" min={100} max={599} value={form.expectedStatus} onChange={(event) => set('expectedStatus', event.target.value)} />
          </label>
          <label className="field">
            <span>Expected body marker (optional)</span>
            <input value={form.expectedBodyContains} onChange={(event) => set('expectedBodyContains', event.target.value)} placeholder='"result"' />
          </label>
          <label className="field">
            <span>Interval (seconds)</span>
            <input type="number" min={30} max={86400} value={form.intervalSeconds} onChange={(event) => set('intervalSeconds', event.target.value)} />
          </label>
          <label className="field">
            <span>Timeout (milliseconds)</span>
            <input type="number" min={1000} max={60000} value={form.timeoutMs} onChange={(event) => set('timeoutMs', event.target.value)} />
          </label>
          <label className="field">
            <span>Retries</span>
            <input type="number" min={0} max={5} value={form.retries} onChange={(event) => set('retries', event.target.value)} />
          </label>
          <label className="field">
            <span>Status after creation</span>
            <select value={form.enabled ? 'enabled' : 'disabled'} onChange={(event) => set('enabled', event.target.value === 'enabled')}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="field full">
            <span>Request headers (JSON object, optional)</span>
            <textarea
              value={form.headers}
              onChange={(event) => set('headers', event.target.value)}
              placeholder={'{"Authorization":"Bearer <token>"}'}
              style={{ minHeight: 74 }}
            />
            <span className="hint">
              Header values are encrypted with AES-256-GCM at rest and redacted from check errors.
              Authentication is explicit; no credentials are inferred.
            </span>
          </label>
        </div>
        <div className="callout">
          <strong>What this creates.</strong> An independently observed HTTP check with timestamp,
          latency, status code, attempts and error text. It does not turn source-reported provider
          health into a measured signal. Provider endpoint probing remains opt-in and per-endpoint.
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? <Loader2 size={13} className="spin" /> : null}
            {submitting ? 'Creating monitor…' : 'Create monitor'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => router.push('/app/monitors')}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
