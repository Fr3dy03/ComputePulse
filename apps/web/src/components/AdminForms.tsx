'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { apiSend, type Integration, type SettingsPayload } from '@/lib/api';

export function WebhookEditor({ integration }: { integration: Integration }) {
  const router = useRouter();
  const config = integration.config as { webhook_url?: string; signature_header?: string };
  const [name, setName] = useState(integration.name);
  const [url, setUrl] = useState(config.webhook_url ?? '');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await apiSend(`/api/v1/integrations/${integration.id}`, 'PATCH', {
      name,
      webhookUrl: url || null,
      ...(secret ? { secret } : {}),
    });
    setBusy(false);
    setError(!response.ok);
    setMessage(
      response.ok
        ? 'Webhook configuration saved. Alert deliveries use HMAC-SHA256 signatures.'
        : `Save failed (HTTP ${response.status}).`,
    );
    if (response.ok) {
      setSecret('');
      router.refresh();
    }
  };

  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head">
        <div>
          <h2>{integration.name}</h2>
          <div className="tiny muted" style={{ marginTop: 3 }}>
            HMAC-SHA256 · header {config.signature_header ?? 'X-ComputePulse-Signature'}
          </div>
        </div>
        <span className={`badge ${integration.status === 'configured' ? 'badge-observed' : 'badge-unavailable'}`}>
          {integration.status}
        </span>
      </div>
      <div className="panel-pad stack">
        {message ? (
          <div className={error ? 'error-banner' : 'success-banner'} style={{ margin: 0 }}>{message}</div>
        ) : null}
        <label className="field">
          <span>Display name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </label>
        <label className="field">
          <span>Webhook URL</span>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://alerts.example.com/computepulse"
          />
          <span className="hint">
            Must be a public HTTPS destination. Private, loopback and link-local targets are rejected
            by the same SSRF policy as monitors. Leave empty to disable delivery.
          </span>
        </label>
        <label className="field">
          <span>Shared secret {integration.has_secret ? '(configured — enter to replace)' : ''}</span>
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="At least 16 characters recommended"
            autoComplete="new-password"
          />
          <span className="hint">Encrypted with AES-256-GCM at rest. The API never returns the secret.</span>
        </label>
        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            {busy ? 'Saving…' : 'Save webhook'}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            disabled={busy}
            onClick={() => {
              setUrl('');
              setSecret('');
              setMessage('Clear the URL and save to disable signed webhook delivery.');
            }}
          >
            Clear fields
          </button>
        </div>
        <div className="tiny muted">
          Delivery status appears in the alert rule table after an incident lifecycle action fires a
          rule. Failures are recorded, not retried indefinitely.
        </div>
      </div>
    </form>
  );
}

export function SettingsForm({ payload }: { payload: SettingsPayload }) {
  const router = useRouter();
  const values = Object.fromEntries(payload.settings.map((item) => [item.key, item.value]));
  const [form, setForm] = useState({
    staleSeconds: String(values['freshness.default_stale_seconds'] ?? 1800),
    observationsDays: String(values['retention.observations_days'] ?? 30),
    monitorChecksDays: String(values['retention.monitor_checks_days'] ?? 14),
    timezone: String(values['collector.timezone'] ?? 'UTC'),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await apiSend('/api/v1/settings', 'PATCH', {
      settings: [
        { key: 'freshness.default_stale_seconds', value: Number(form.staleSeconds) },
        { key: 'retention.observations_days', value: Number(form.observationsDays) },
        { key: 'retention.monitor_checks_days', value: Number(form.monitorChecksDays) },
        { key: 'collector.timezone', value: form.timezone },
      ],
    });
    setBusy(false);
    setError(!response.ok);
    setMessage(
      response.ok
        ? 'Operational settings saved. Retention is enforced by the next maintenance task.'
        : `Save failed (HTTP ${response.status}).`,
    );
    if (response.ok) router.refresh();
  };

  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head">
        <h2>Retention and freshness</h2>
        <span className="badge">UTC</span>
      </div>
      <div className="panel-pad stack">
        {message ? (
          <div className={error ? 'error-banner' : 'success-banner'} style={{ margin: 0 }}>{message}</div>
        ) : null}
        <div className="form-grid">
          <label className="field">
            <span>Default stale threshold (seconds)</span>
            <input
              type="number"
              min={60}
              max={604800}
              value={form.staleSeconds}
              onChange={(event) => setForm((current) => ({ ...current, staleSeconds: event.target.value }))}
            />
            <span className="hint">Source-specific policies take precedence over this default.</span>
          </label>
          <label className="field">
            <span>Collector timezone</span>
            <input value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} />
            <span className="hint">Display timezone. Stored timestamps remain UTC.</span>
          </label>
          <label className="field">
            <span>Retain observations (days)</span>
            <input
              type="number"
              min={1}
              max={3650}
              value={form.observationsDays}
              onChange={(event) => setForm((current) => ({ ...current, observationsDays: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Retain monitor checks (days)</span>
            <input
              type="number"
              min={1}
              max={3650}
              value={form.monitorChecksDays}
              onChange={(event) => setForm((current) => ({ ...current, monitorChecksDays: event.target.value }))}
            />
          </label>
        </div>
        <div className="callout warn">
          <strong>Retention warning.</strong> Deleting raw observations reduces history coverage and
          cannot be reversed. Export or back up data before shortening retention.
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </form>
  );
}
