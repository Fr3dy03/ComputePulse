import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Check,
  Clock3,
  ExternalLink,
  Network,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { apiGet, type MonitorDetail } from '@/lib/api';
import { formatAge, formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import {
  Callout,
  DataNote,
  PageHead,
  SeverityBadge,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import { CheckMonitorButton } from '@/components/actions';

export const dynamic = 'force-dynamic';

export default async function MonitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: monitor, error } = await apiGet<MonitorDetail>(
    `/api/v1/monitors/${encodeURIComponent(id)}`,
  );
  if (!monitor) {
    if (error) {
      return <div className="error-banner">Monitor could not be loaded: {error}</div>;
    }
    notFound();
  }

  const successfulChecks = monitor.checks.filter((check) => check.success);
  const avgLatency =
    successfulChecks.length > 0
      ? successfulChecks.reduce((total, check) => total + (check.latency_ms ?? 0), 0) /
        successfulChecks.length
      : null;
  const chartChecks = successfulChecks
    .filter((check) => check.latency_ms !== null)
    .slice(-60)
    .map((check) => ({ at: check.checked_at, value: check.latency_ms as number }));

  return (
    <>
      <PageHead
        breadcrumb={<><Link href="/app/monitors">Monitors</Link> / <strong>{monitor.name}</strong></>}
        title={monitor.name}
        description={`${monitor.method} ${monitor.target_url}`}
        actions={
          <>
            <CheckMonitorButton id={monitor.id} size="md" />
            <a href={monitor.target_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
              Open target <ExternalLink size={11} />
            </a>
          </>
        }
        meta={
          <>
            <span><Network size={11} /> {monitor.network_name ?? 'Unscoped'}</span>
            <span><Clock3 size={11} /> Every {monitor.interval_seconds}s · timeout {monitor.timeout_ms}ms</span>
            <span><ShieldCheck size={11} /> {monitor.has_credentials ? 'credentials configured' : 'no credentials'}</span>
          </>
        }
      />

      <div className="row wrap mb-16" style={{ gap: 8 }}>
        <StatusBadge value={monitor.last_status} />
        <span className="badge badge-observed">OBSERVED</span>
        <span className="badge">{monitor.kind}</span>
        {monitor.enabled ? <span className="badge badge-healthy">enabled</span> : <span className="badge badge-unavailable">disabled</span>}
      </div>

      {monitor.last_error ? <div className="error-banner">Latest error: {monitor.last_error}</div> : null}

      <div className="grid grid-4">
        <StatCard label="Latest latency" value={monitor.last_latency_ms !== null ? `${formatNumber(monitor.last_latency_ms)} ms` : '—'} sub={monitor.last_status_code ? `HTTP ${monitor.last_status_code}` : 'no response'} icon="signal" />
        <StatCard label="24h availability" value={monitor.availability_24h !== null ? formatPercent(monitor.availability_24h) : '—'} sub={`${monitor.successful_24h}/${monitor.checks_24h} successful checks`} icon="gauge" accent={monitor.availability_24h !== null && monitor.availability_24h >= 0.99 ? 'green' : 'amber'} />
        <StatCard label="Consecutive failures" value={monitor.consecutive_failures} sub={`${monitor.retries} retries per check`} icon="alert" accent={monitor.consecutive_failures ? 'red' : 'green'} />
        <StatCard label="Last checked" value={monitor.last_checked_at ? formatAge((Date.now() - new Date(monitor.last_checked_at).getTime()) / 1000) : 'never'} sub={formatDateTime(monitor.last_checked_at)} icon="clock" />
      </div>

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Check latency</h2>
              <span className="mono-label">last {chartChecks.length} successful checks</span>
            </div>
            <div className="panel-pad">
              {chartChecks.length ? (
                <LatencyChart points={chartChecks} />
              ) : (
                <div className="chart-empty">No successful latency observations yet.</div>
              )}
              <div className="row-between mt-12">
                <span className="tiny muted">Average {avgLatency !== null ? `${formatNumber(avgLatency)} ms` : '—'}</span>
                <span className="tiny muted">Each point is an individual check, not a smoothed average.</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Check history</h2>
              <span className="mono-label">{monitor.total_checks} total</span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Checked at</th>
                    <th>Result</th>
                    <th>Latency</th>
                    <th>Status</th>
                    <th>Attempt</th>
                    <th>Trigger</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {monitor.checks.map((check) => (
                    <tr key={`${check.checked_at}-${check.attempt}`}>
                      <td className="num">{formatDateTime(check.checked_at)}</td>
                      <td>{check.success ? <span className="badge badge-healthy">UP</span> : <span className="badge badge-down">FAILED</span>}</td>
                      <td className="num">{check.latency_ms !== null ? `${check.latency_ms} ms` : '—'}</td>
                      <td className="num">{check.status_code ?? '—'}</td>
                      <td className="num">{check.attempt}</td>
                      <td className="tiny">{check.source}</td>
                      <td className="tiny" style={{ maxWidth: 300, color: check.error ? '#eda5a1' : undefined }}>{check.error ?? '—'}</td>
                    </tr>
                  ))}
                  {!monitor.checks.length ? (
                    <tr><td colSpan={7}><div className="table-empty">No checks recorded. Run a check or wait for the scheduler.</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Related incidents</h2><span className="tiny muted">correlated from monitor failure/recovery</span></div>
            <div className="stack-sm panel-pad">
              {monitor.incidents.length ? monitor.incidents.map((incident) => (
                <Link href={`/app/incidents/${incident.id}`} key={incident.id} className="panel panel-pad" style={{ background: 'var(--bg)', padding: 12 }}>
                  <div className="row-between">
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge value={incident.status} />
                  </div>
                  <div className="mt-8" style={{ fontSize: 12 }}>{incident.title}</div>
                  <div className="cell-sub">{formatDateTime(incident.detected_at)}</div>
                </Link>
              )) : <span className="tiny muted">No incident recorded for this monitor.</span>}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Configuration</h2><Timer size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              <dl className="kv">
                <dt>Monitor ID</dt><dd className="mono" style={{ fontSize: 10 }}>{monitor.id}</dd>
                <dt>Kind</dt><dd>{monitor.kind}</dd>
                <dt>Method</dt><dd>{monitor.method}</dd>
                <dt>Expected status</dt><dd>{monitor.expected_status}</dd>
                <dt>Body marker</dt><dd className="mono" style={{ fontSize: 10 }}>{monitor.expected_body_contains ?? 'none'}</dd>
                <dt>Interval</dt><dd>{monitor.interval_seconds}s</dd>
                <dt>Timeout</dt><dd>{monitor.timeout_ms}ms</dd>
                <dt>Retries</dt><dd>{monitor.retries}</dd>
                <dt>Auth</dt><dd>{monitor.auth_type}</dd>
                <dt>Created</dt><dd>{formatDateTime(monitor.created_at)}</dd>
              </dl>
              <Callout icon={false}>
                <strong>OBSERVED evidence.</strong> Status and latency describe this endpoint at the
                recorded check time. They do not establish provider capacity, workload execution or
                network-wide health.
              </Callout>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Protection</h2><ShieldCheck size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              <ul className="tiny muted" style={{ paddingLeft: 16 }}>
                <li>Public-address validation before each request</li>
                <li>Port allowlist enforced</li>
                <li>Redirects rejected</li>
                <li>Response size bounded</li>
                <li>Stored headers encrypted at rest</li>
                <li>Error text redacted for known secret patterns</li>
              </ul>
            </div>
          </section>

          <div className="panel panel-pad">
            <h3>Operational note</h3>
            <p className="tiny mt-8">
              Disabling this monitor stops new checks. Historical checks remain until retention
              removes them. Deleting monitors is intentionally not exposed in this reference UI.
            </p>
          </div>
        </div>
      </div>

      <DataNote>
        Availability is calculated from stored checks within the last 24 hours. Fewer than two checks
        can produce a misleading percentage, so read the check count alongside it. Failed checks are
        retained with the actual error, not overwritten by later successes.
      </DataNote>
    </>
  );
}

function LatencyChart({ points }: { points: Array<{ at: string; value: number }> }) {
  const width = 860;
  const height = 200;
  const padding = { left: 46, right: 12, top: 14, bottom: 24 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const low = Math.min(...points.map((point) => point.value));
  const high = Math.max(...points.map((point) => point.value));
  const min = low === high ? Math.max(0, low - 50) : low - (high - low) * 0.12;
  const max = low === high ? high + 50 : high + (high - low) * 0.12;
  const x = (index: number) =>
    padding.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => padding.top + (1 - (value - min) / (max - min)) * plotH;
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="chart-box" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monitor latency history">
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const value = min + (max - min) * ratio;
        return (
          <g key={ratio}>
            <line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} className="chart-grid" />
            <text x={padding.left - 8} y={y(value) + 3} textAnchor="end" className="chart-label">{Math.round(value)}ms</text>
          </g>
        );
      })}
      <path d={path} className="chart-line" />
      {points.map((point, index) => (
        <circle key={`${point.at}-${index}`} cx={x(index)} cy={y(point.value)} r={2.4} fill="var(--cyan)">
          <title>{point.at}: {point.value} ms</title>
        </circle>
      ))}
      <text x={padding.left} y={height - 6} className="chart-label">{points[0]?.at.slice(11, 16)}Z</text>
      <text x={width - padding.right} y={height - 6} textAnchor="end" className="chart-label">{points[points.length - 1]?.at.slice(11, 16)}Z</text>
    </svg>
  );
}
