import Link from 'next/link';
import { BellRing, Clock3, Filter, ShieldAlert, TriangleAlert } from 'lucide-react';
import { apiGet, type AlertRule } from '@/lib/api';
import { formatAge, formatDateTime, formatDuration, formatNumber, titleCase } from '@/lib/format';
import { AlertRuleToggle } from '@/components/actions';
import {
  Callout,
  DataNote,
  PageHead,
  SeverityBadge,
  StatCard,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AlertRulesPage() {
  const { data, error } = await apiGet<{ data: AlertRule[] }>('/api/v1/alert-rules');
  const rules = data?.data ?? [];
  const enabled = rules.filter((rule) => rule.enabled);
  const deliveries = rules.reduce((total, rule) => total + rule.deliveries, 0);
  const failed = rules.reduce((total, rule) => total + rule.failed_deliveries, 0);

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Alert rules</strong></>}
        title="Alert rules"
        description="Deterministic thresholds evaluated against persisted observations and monitor checks. Rules open incidents; they do not send speculative notifications when evidence is missing."
        meta={
          <>
            <span><BellRing size={11} /> {enabled.length} of {rules.length} enabled</span>
            <span><Filter size={11} /> {formatNumber(deliveries)} recorded deliveries</span>
            <span><ShieldAlert size={11} /> {formatNumber(failed)} failed deliveries</span>
          </>
        }
        actions={<Link href="/app/integrations" className="btn btn-sm">Delivery channels</Link>}
      />

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid grid-4">
        <StatCard
          label="Rules configured"
          value={rules.length}
          sub={`${rules.filter((rule) => !rule.enabled).length} disabled by default`}
          icon="alert"
        />
        <StatCard
          label="Enabled rules"
          value={enabled.length}
          sub="Evaluated by the incident lifecycle"
          icon="check"
          accent={enabled.length ? 'green' : 'amber'}
        />
        <StatCard
          label="Deliveries recorded"
          value={formatNumber(deliveries)}
          sub="Across every configured channel"
          icon="radio"
        />
        <StatCard
          label="Failed deliveries"
          value={formatNumber(failed)}
          sub={failed ? 'Inspect webhook configuration' : 'No failed delivery recorded'}
          icon="shield"
          accent={failed ? 'red' : 'green'}
        />
      </div>

      <section className="panel mt-24">
        <div className="panel-head">
          <div>
            <h2>Configured rules</h2>
            <div className="tiny muted" style={{ marginTop: 3 }}>
              Toggling a rule takes effect immediately. Threshold, severity and window edits require
              the API admin token when one is configured.
            </div>
          </div>
          <span className="mono-label">evaluation order</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Condition</th>
                <th>Window</th>
                <th>Severity</th>
                <th>Scope</th>
                <th>Deliveries</th>
                <th>Last fired</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td style={{ maxWidth: 330 }}>
                    <div className="cell-title">{rule.name}</div>
                    <div className="cell-sub">{rule.description ?? 'No description supplied.'}</div>
                    <div className="cell-id">{rule.id}</div>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 10.5 }}>{rule.metric_key}</span>
                    <div className="cell-sub">
                      {rule.comparator.toUpperCase()} <strong>{rule.threshold}</strong>
                    </div>
                  </td>
                  <td className="num tiny">{formatDuration(rule.window_seconds)}</td>
                  <td><SeverityBadge severity={rule.severity} /></td>
                  <td className="tiny">
                    {rule.network_name ?? 'All networks'}
                    {rule.provider_id ? <div className="cell-sub">{rule.provider_id}</div> : null}
                  </td>
                  <td className="num">
                    {rule.deliveries > 0 ? formatNumber(rule.deliveries) : '—'}
                    {rule.failed_deliveries > 0 ? (
                      <div className="cell-sub" style={{ color: 'var(--red)' }}>
                        {rule.failed_deliveries} failed
                      </div>
                    ) : null}
                  </td>
                  <td className="num tiny">
                    {rule.last_fired_at
                      ? formatAge((Date.now() - new Date(rule.last_fired_at).getTime()) / 1000)
                      : <span className="muted">never</span>}
                  </td>
                  <td><AlertRuleToggle id={rule.id} enabled={rule.enabled} /></td>
                </tr>
              ))}
              {!rules.length ? (
                <tr>
                  <td colSpan={8}>
                    <div className="table-empty">
                      No alert rules are configured. Absence of rules is not an all-clear.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Seeded rule behaviour</h2>
              <TriangleAlert size={13} style={{ color: 'var(--amber)' }} />
            </div>
            <div className="panel-pad stack">
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge badge-down">CRITICAL</span>
                  <strong style={{ fontSize: 12.5 }}>Monitored endpoint failing</strong>
                </div>
                <p className="tiny muted mt-8">
                  Fires when <span className="mono">monitor.consecutive_failures</span> is greater than
                  or equal to two inside a five-minute window. A single transient failure does not
                  open an incident. Checks are written before evaluation so the evidence exists even
                  when delivery fails.
                </p>
              </div>
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge badge-degraded">WARNING</span>
                  <strong style={{ fontSize: 12.5 }}>Provider source data stale</strong>
                </div>
                <p className="tiny muted mt-8">
                  Fires when a source has not completed a successful collection inside its freshness
                  threshold. Staleness is evaluated from the last success timestamp, never from cached
                  success state.
                </p>
              </div>
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge badge-unknown">DISABLED</span>
                  <strong style={{ fontSize: 12.5 }}>Watched provider reports offline</strong>
                </div>
                <p className="tiny muted mt-8">
                  Disabled by default to avoid thousands of correlated incidents from a public
                  provider index. Enable only after defining a watchlist. The rule reads the
                  source-reported state and marks the incident as reported evidence.
                </p>
              </div>
            </div>
          </section>

          <Callout tone="warn">
            <strong>Delivery is not diagnosis.</strong> A delivered alert proves the notification path
            worked. It does not prove an outage began at that moment, nor that the affected provider
            is unhealthy. Open the linked incident to inspect the underlying observation and source
            timestamps.
          </Callout>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Delivery path</h2>
              <Clock3 size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="panel-pad">
              <div className="timeline">
                <div className="timeline-item">
                  <div className="time">1</div>
                  <div className="event">
                    <strong>Observation or check persisted</strong>
                    <div className="tiny muted">A metric or monitor result is written with source and timestamps.</div>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="time">2</div>
                  <div className="event">
                    <strong>Rule evaluated</strong>
                    <div className="tiny muted">Comparator, threshold and window are applied to the stored evidence.</div>
                  </div>
                </div>
                <div className="timeline-item accent">
                  <div className="time">3</div>
                  <div className="event">
                    <strong>Incident opened or updated</strong>
                    <div className="tiny muted">Cooldown prevents duplicate incidents for the same source reference.</div>
                  </div>
                </div>
                <div className="timeline-item accent">
                  <div className="time">4</div>
                  <div className="event">
                    <strong>Signed delivery attempted</strong>
                    <div className="tiny muted">HMAC-SHA256 webhook or configured channel. Failures are recorded.</div>
                  </div>
                </div>
              </div>
              <Link href="/app/incidents" className="link-arrow mt-12">Review incident lifecycle</Link>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Audit</h2>
              <span className="mono-label">last writes</span>
            </div>
            <div className="panel-pad">
              <dl className="kv">
                {rules.map((rule) => (
                  <div key={`${rule.id}-audit`} style={{ display: 'contents' }}>
                    <dt style={{ fontSize: 10 }}>{rule.id}</dt>
                    <dd className="tiny muted" style={{ textAlign: 'left' }}>
                      {formatDateTime(rule.last_fired_at)} · {rule.enabled ? 'enabled' : 'disabled'}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>
      </div>

      <DataNote>
        Rules with zero deliveries have either never fired or fired before delivery was configured.
        This page does not claim notification coverage. A failed delivery is shown as failed; it is not
        retried indefinitely. Delivery history is readable in the operational report.
      </DataNote>

      <div className="row-between wrap mt-16">
        <span className="tiny muted">
          {enabled.length} active of {rules.length} total · {titleCase('threshold')} evaluation is
          deterministic
        </span>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/app/reports" className="link-arrow">Open reports</Link>
          <Link href="/app/settings" className="link-arrow">Retention settings</Link>
        </div>
      </div>
    </>
  );
}
