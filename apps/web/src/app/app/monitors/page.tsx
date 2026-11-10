import Link from 'next/link';
import { Activity, Clock3, Plus, Radio, ShieldCheck } from 'lucide-react';
import { apiGet, type MonitorSummary } from '@/lib/api';
import { formatAge, formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import {
  DataNote,
  PageHead,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import { CheckMonitorButton, RunDueMonitorsButton } from '@/components/actions';

export const dynamic = 'force-dynamic';

export default async function MonitorsPage() {
  const { data, error } = await apiGet<{ data: MonitorSummary[] }>('/api/v1/monitors');
  const monitors = data?.data ?? [];
  const up = monitors.filter((monitor) => monitor.last_status === 'up').length;
  const down = monitors.filter((monitor) => monitor.last_status === 'down').length;
  const pending = monitors.filter((monitor) => monitor.last_status === 'pending').length;
  const avgAvailability =
    monitors.filter((monitor) => monitor.availability_24h !== null).length > 0
      ? monitors
          .filter((monitor) => monitor.availability_24h !== null)
          .reduce((total, monitor) => total + (monitor.availability_24h ?? 0), 0) /
        monitors.filter((monitor) => monitor.availability_24h !== null).length
      : null;

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Monitors</strong></>}
        title="Endpoint monitors"
        description="Opt-in direct observations of HTTP and JSON-RPC endpoints. Checks are SSRF-validated, timestamped and retained separately from source-reported provider health."
        actions={
          <>
            <RunDueMonitorsButton />
            <Link href="/app/monitors/new" className="btn btn-primary btn-sm">
              <Plus size={13} /> New monitor
            </Link>
          </>
        }
        meta={
          <>
            <span><Activity size={11} /> {monitors.length} configured</span>
            <span><ShieldCheck size={11} /> observed checks only</span>
            <span><Clock3 size={11} /> scheduler + manual checks</span>
          </>
        }
      />

      {error ? <div className="error-banner">Monitors could not be loaded: {error}</div> : null}

      <div className="grid grid-4 mb-24">
        <StatCard label="Monitors" value={monitors.length} sub="Explicit endpoint checks" icon="gauge" />
        <StatCard label="Up" value={up} sub="latest check succeeded" icon="check" accent="green" />
        <StatCard label="Down" value={down} sub="latest check failed" icon="alert" accent={down ? 'red' : 'green'} />
        <StatCard label="24h availability" value={avgAvailability !== null ? formatPercent(avgAvailability) : '—'} sub={`${pending} pending first check`} icon="clock" />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Monitor inventory</h2>
          <span className="tiny muted">Targets are explicit; no implicit probing</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Monitor</th>
                <th>Network</th>
                <th>Target</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Availability 24h</th>
                <th>Last check</th>
                <th>Interval</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((monitor) => (
                <tr key={monitor.id}>
                  <td>
                    <Link href={`/app/monitors/${monitor.id}`} className="cell-title">{monitor.name}</Link>
                    <div className="cell-sub">{monitor.kind.toUpperCase()} · {monitor.method} · expected {monitor.expected_status}</div>
                  </td>
                  <td className="tiny">{monitor.network_name ?? 'Unscoped'}</td>
                  <td style={{ maxWidth: 260 }}>
                    <div className="mono" style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={monitor.target_url}>
                      {monitor.target_url.replace(/^https?:\/\//, '')}
                    </div>
                    {monitor.expected_body_contains ? <div className="cell-sub">expects body marker</div> : null}
                  </td>
                  <td><StatusBadge value={monitor.last_status} /></td>
                  <td className="num">{monitor.last_latency_ms !== null ? `${formatNumber(monitor.last_latency_ms)} ms` : '—'}</td>
                  <td className="num">{monitor.availability_24h !== null ? formatPercent(monitor.availability_24h) : '—'}<div className="cell-sub">{monitor.successful_24h}/{monitor.checks_24h} checks</div></td>
                  <td className="num">{monitor.last_checked_at ? formatAge((Date.now() - new Date(monitor.last_checked_at).getTime()) / 1000) : 'never'}<div className="cell-sub">{formatDateTime(monitor.last_checked_at)}</div></td>
                  <td className="num">{monitor.interval_seconds}s</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <CheckMonitorButton id={monitor.id} />
                      <Link href={`/app/monitors/${monitor.id}`} className="btn btn-sm btn-ghost">Open</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!monitors.length ? (
                <tr><td colSpan={9}><div className="table-empty">No monitors configured. Seed the source monitors or create an endpoint monitor.</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="table-toolbar" style={{ borderBottom: 0 }}>
          <span className="tiny muted">
            Four seeded monitors cover documented source APIs: Akash Console, Flux daemon, BOT Chain
            RPC and Bohr testnet RPC.
          </span>
          <Link href="/app/integrations" className="link-arrow">Delivery integrations</Link>
        </div>
      </div>

      <DataNote>
        A successful check is OBSERVED evidence: the endpoint returned the expected status and body
        marker within the timeout. It is not proof that the provider serves workloads, that a chain is
        finalising, or that an upstream source is healthy. A failed check is recorded with the actual
        error; it is never smoothed into a green uptime bar.
      </DataNote>
    </>
  );
}
