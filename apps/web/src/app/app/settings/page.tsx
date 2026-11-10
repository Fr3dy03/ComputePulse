import Link from 'next/link';
import {
  Clock3,
  Database,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { apiGet, type SettingsPayload } from '@/lib/api';
import { formatAge, formatDateTime, formatDuration, formatNumber, titleCase } from '@/lib/format';
import { SettingsForm } from '@/components/AdminForms';
import { Callout, DataNote, PageHead, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { data, error } = await apiGet<SettingsPayload>('/api/v1/settings');
  if (!data) {
    return (
      <>
        <PageHead title="Settings" description="Environment, retention and source freshness policy." />
        <div className="error-banner">Settings could not be loaded: {error}</div>
      </>
    );
  }

  const org = data.organisation as
    | { id?: string; name?: string; slug?: string; plan?: string; created_at?: string }
    | null;
  const environment = data.environment as Record<string, unknown>;
  const retention = data.retention as Record<string, unknown>;
  const values = Object.fromEntries(data.settings.map((item) => [item.key, item.value]));

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Settings</strong></>}
        title="Workspace settings"
        description="Organisation, collection environment, freshness policy and data retention. Values below are reported by the running API."
        meta={
          <>
            <span><ServerCog size={11} /> {String(environment.database ?? 'unknown')} storage</span>
            <span><RefreshCw size={11} /> Collector {environment.collectorEnabled ? 'enabled' : 'disabled'}</span>
            <span><ShieldCheck size={11} /> {String(environment.credentialEncryption ?? '—')}</span>
          </>
        }
      />

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid grid-4">
        <StatCard
          label="Organisation"
          value={org?.name ?? '—'}
          sub={`${org?.slug ?? '—'} · ${titleCase(org?.plan ?? 'unknown')} plan`}
          icon="shield"
        />
        <StatCard
          label="Observations retained"
          value={`${formatNumber(retention.observationsDays as number)}d`}
          sub="Raw metric history"
          icon="database"
        />
        <StatCard
          label="Monitor checks retained"
          value={`${formatNumber(retention.monitorChecksDays as number)}d`}
          sub="Endpoint check history"
          icon="clock"
        />
        <StatCard
          label="Sources monitored"
          value={data.sourceFreshnessPolicy.length}
          sub="Each with its own stale threshold"
          icon="radio"
          accent="green"
        />
      </div>

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <div className="stack">
          <SettingsForm payload={data} />

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Source freshness policy</h2>
                <div className="tiny muted" style={{ marginTop: 3 }}>
                  Per-adapter thresholds override the workspace default. A source beyond its threshold
                  is marked STALE, never treated as healthy.
                </div>
              </div>
              <SlidersHorizontal size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>State</th>
                    <th>Expected interval</th>
                    <th>Stale after</th>
                    <th>Last success</th>
                    <th>Failures</th>
                    <th>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sourceFreshnessPolicy.map((source) => {
                    const row = source as Record<string, unknown>;
                    const lastSuccess = row.last_success_at ? String(row.last_success_at) : null;
                    const failures = Number(row.consecutive_failures ?? 0);
                    return (
                      <tr key={String(row.network_id)}>
                        <td>
                          <div className="cell-title">{String(row.network_name ?? row.network_id)}</div>
                          <div className="cell-id">{String(row.network_id)}</div>
                        </td>
                        <td>
                          <span className={`badge ${row.state === 'active' ? 'badge-healthy' : 'badge-degraded'}`}>
                            {String(row.state ?? 'unknown').toUpperCase()}
                          </span>
                        </td>
                        <td className="num tiny">{formatDuration(Number(row.expected_interval_seconds ?? 0))}</td>
                        <td className="num tiny">{formatDuration(Number(row.stale_after_seconds ?? 0))}</td>
                        <td className="num tiny">
                          {lastSuccess
                            ? <>{formatAge((Date.now() - new Date(lastSuccess).getTime()) / 1000)}</>
                            : <span className="badge badge-unavailable">NEVER</span>}
                        </td>
                        <td className="num" style={{ color: failures ? 'var(--red)' : undefined }}>{failures}</td>
                        <td className="num tiny">
                          {row.source_latency_ms ? `${formatNumber(Number(row.source_latency_ms))} ms` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {!data.sourceFreshnessPolicy.length ? (
                    <tr><td colSpan={7}><div className="table-empty">No data source status rows exist.</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="table-toolbar" style={{ borderBottom: 0 }}>
              <span className="tiny muted">
                Last error: {data.sourceFreshnessPolicy
                  .map((source) => (source as Record<string, unknown>).last_error)
                  .filter(Boolean)
                  .join(' · ') || 'none recorded'}
              </span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Stored workspace values</h2>
              <Fingerprint size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Key</th><th>Value</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {data.settings.map((setting) => (
                    <tr key={setting.key}>
                      <td className="mono" style={{ fontSize: 10.5 }}>{setting.key}</td>
                      <td className="mono tiny">
                        {typeof setting.value === 'object'
                          ? JSON.stringify(setting.value)
                          : String(setting.value)}
                      </td>
                      <td className="num tiny muted">{formatDateTime(setting.updated_at)}</td>
                    </tr>
                  ))}
                  {!data.settings.length ? (
                    <tr><td colSpan={3}><div className="table-empty">No workspace settings have been written.</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Environment</h2>
              <ServerCog size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="panel-pad">
              <dl className="kv">
                <dt>Database</dt>
                <dd>{titleCase(String(environment.database))}</dd>
                <dt>Collector</dt>
                <dd>{environment.collectorEnabled ? 'Enabled' : 'Disabled'}</dd>
                <dt>Monitor scheduler</dt>
                <dd>{environment.monitorSchedulerEnabled ? 'Enabled' : 'Disabled'}</dd>
                <dt>OpenTelemetry</dt>
                <dd>{environment.otelEnabled ? 'Enabled' : 'Disabled'}</dd>
                <dt>Webhook secret</dt>
                <dd>{environment.webhookSecretConfigured ? 'Configured' : 'Not configured'}</dd>
                <dt>SMTP</dt>
                <dd>{environment.smtpConfigured ? 'Configured' : 'Not configured'}</dd>
                <dt>Incident registry</dt>
                <dd>{environment.registryAddressConfigured ? 'Address configured' : 'No address configured'}</dd>
                <dt>Credentials</dt>
                <dd style={{ textAlign: 'left' }}>{String(environment.credentialEncryption)}</dd>
                <dt>SSRF policy</dt>
                <dd style={{ textAlign: 'left' }}>{String(environment.ssrfProtection)}</dd>
              </dl>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Access and safety</h2>
              <LockKeyhole size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="panel-pad stack">
              <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                <KeyRound size={14} style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ fontSize: 12 }}>Admin token</strong>
                  <p className="tiny muted" style={{ marginTop: 4 }}>
                    Mutating routes require <span className="mono">ADMIN_API_TOKEN</span> when it is
                    configured. Local mode permits mutations without a token so the seeded workflow can
                    be evaluated; production deployment must set one.
                  </p>
                </div>
              </div>
              <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                <LockKeyhole size={14} style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ fontSize: 12 }}>Encrypted credentials</strong>
                  <p className="tiny muted" style={{ marginTop: 4 }}>
                    Monitor headers and webhook secrets are encrypted with AES-256-GCM before storage.
                    Responses expose only a boolean presence flag.
                  </p>
                </div>
              </div>
              <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                <ShieldCheck size={14} style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ fontSize: 12 }}>Outbound request policy</strong>
                  <p className="tiny muted" style={{ marginTop: 4 }}>
                    Monitors and webhooks reject loopback, private, link-local and metadata targets
                    after DNS resolution and revalidate the resolved address. Redirects are not
                    followed.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Retention policy</h2>
              <Database size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="panel-pad">
              <div className="metric-grid">
                <div className="metric-cell">
                  <div className="label">Observations</div>
                  <div className="value">{formatNumber(values['retention.observations_days'] as number)}d</div>
                </div>
                <div className="metric-cell">
                  <div className="label">Monitor checks</div>
                  <div className="value">{formatNumber(values['retention.monitor_checks_days'] as number)}d</div>
                </div>
                <div className="metric-cell">
                  <div className="label">Stale default</div>
                  <div className="value">{formatDuration(Number(values['freshness.default_stale_seconds'] ?? 0))}</div>
                </div>
                <div className="metric-cell">
                  <div className="label">Timezone</div>
                  <div className="value" style={{ fontSize: 15 }}>{String(values['collector.timezone'] ?? 'UTC')}</div>
                </div>
              </div>
              <Callout tone="warn" icon={false}>
                {String(retention.note ?? '')} Shortening retention deletes history permanently and
                cannot be undone from this interface.
              </Callout>
            </div>
          </section>

          <section className="panel panel-pad">
            <h3>Deployment notes</h3>
            <p className="tiny muted mt-8">
              Local mode stores data in PGlite under <span className="mono">apps/api/.data/pglite</span>.
              Set <span className="mono">DATABASE_URL</span> to use PostgreSQL. Production is
              documented with TimescaleDB, Redis/BullMQ and OpenTelemetry; those services are not
              required for local evaluation.
            </p>
            <div className="row wrap mt-12" style={{ gap: 8 }}>
              <Link href="/documentation" className="link-arrow">Deployment documentation</Link>
              <Link href="/app/integrations" className="link-arrow">Delivery integrations</Link>
            </div>
          </section>
        </div>
      </div>

      <DataNote>
        Settings are stored per organisation and written through the audit log. Source freshness
        policies are owned by each adapter and cannot be shortened below its expected collection
        interval from this form. Environment values are read-only snapshots of the running API
        process; changing them requires a restart with the corresponding variables.
      </DataNote>

      <div className="row-between wrap mt-16">
        <span className="tiny muted">
          <Clock3 size={10} style={{ display: 'inline' }} /> Admin mutations are audited with actor,
          action and timestamp.
        </span>
        <span className="tiny muted">ComputePulse operator workspace · {org?.id ?? '—'}</span>
      </div>
    </>
  );
}
