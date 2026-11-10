import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Clock3,
  Database,
  FileText,
  Radio,
  TriangleAlert,
} from 'lucide-react';
import { apiGet, type Report } from '@/lib/api';
import { formatAge, formatDateTime, formatNumber, formatPercent, titleCase } from '@/lib/format';
import {
  Callout,
  DataNote,
  EvidenceBadge,
  FreshnessBadge,
  HealthBadge,
  NetworkDot,
  PageHead,
  StatCard,
  StatusBadge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

const WINDOWS = [7, 30] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.days);
  const days = WINDOWS.includes(requested as (typeof WINDOWS)[number]) ? requested : 7;
  const { data, error } = await apiGet<Report>(`/api/v1/reports?days=${days}`);

  if (!data) {
    return (
      <>
        <PageHead
          title="Operational reports"
          description="Evidence reports generated from persisted observations."
        />
        <div className="error-banner">The report could not be generated: {error}</div>
      </>
    );
  }

  const allRuns = data.networks.flatMap((network) =>
    network.runs.map((run) => ({ ...run, network })),
  );
  const succeededRuns = allRuns.filter((run) => run.status === 'success').length;
  const failedRuns = allRuns.filter((run) => run.status === 'failed').length;
  const totalChecks = data.monitors.reduce((total, monitor) => total + monitor.checks, 0);
  const successfulChecks = data.monitors.reduce((total, monitor) => total + monitor.successful, 0);
  const totalIncidents = data.incidents.reduce((total, row) => total + Number(row.count ?? 0), 0);
  const totalDeliveries = data.alertDeliveries.reduce(
    (total, row) => total + Number(row.count ?? 0),
    0,
  );
  const failedDeliveries = data.alertDeliveries
    .filter((row) => row.status === 'failed')
    .reduce((total, row) => total + Number(row.count ?? 0), 0);

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Reports</strong></>}
        title={data.title}
        description="A point-in-time operational evidence report. Every count is generated from stored observations, monitor checks, incidents or audit rows — not from cached marketing metrics."
        meta={
          <>
            <span><CalendarDays size={11} /> Window {days} days</span>
            <span><ClipboardList size={11} /> Generated {formatDateTime(data.generatedAt)}</span>
            <span><Database size={11} /> {formatNumber(allRuns.length)} collection runs</span>
            <span><Radio size={11} /> {formatNumber(totalChecks)} monitor checks</span>
          </>
        }
        actions={
          <div className="window-tabs">
            {WINDOWS.map((option) => (
              <Link
                key={option}
                href={`/app/reports?days=${option}`}
                className={option === days ? 'active' : ''}
              >
                {option}d
              </Link>
            ))}
          </div>
        }
      />

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid grid-4">
        <StatCard
          label="Collection runs"
          value={formatNumber(allRuns.length)}
          sub={`${formatNumber(succeededRuns)} succeeded · ${formatNumber(failedRuns)} failed`}
          icon="database"
          accent={failedRuns ? 'amber' : 'green'}
        />
        <StatCard
          label="Monitor checks"
          value={formatNumber(totalChecks)}
          sub={totalChecks ? `${formatPercent(successfulChecks / totalChecks)} successful` : 'No checks recorded'}
          icon="gauge"
        />
        <StatCard
          label="Incident rows"
          value={formatNumber(totalIncidents)}
          sub={`${data.incidents.length} severity/status groups`}
          icon="alert"
          accent={totalIncidents ? 'red' : 'green'}
        />
        <StatCard
          label="Alert deliveries"
          value={formatNumber(totalDeliveries)}
          sub={failedDeliveries ? `${failedDeliveries} failed` : 'No recorded failures'}
          icon="radio"
          accent={failedDeliveries ? 'red' : 'green'}
        />
      </div>

      <Callout tone="info">
        <strong>Report scope.</strong> This report describes what ComputePulse persisted during the
        selected window. A missing row means no observation or event was recorded — it is not evidence
        that an incident did not occur. Read each source&apos;s freshness before drawing conclusions.
      </Callout>

      <section className="panel mt-24">
        <div className="panel-head">
          <div>
            <h2>Network collection coverage</h2>
            <div className="tiny muted" style={{ marginTop: 3 }}>
              Runs grouped by status · provider and observation totals are source-reported write counts
            </div>
          </div>
          <span className="mono-label">{days}d window</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Network</th>
                <th>Health / freshness</th>
                <th>Runs</th>
                <th>Succeeded</th>
                <th>Failed</th>
                <th>Providers seen</th>
                <th>Observations written</th>
                <th>Avg source latency</th>
              </tr>
            </thead>
            <tbody>
              {data.networks.map((network) => {
                const success = network.runs
                  .filter((run) => run.status === 'success')
                  .reduce((total, run) => total + Number(run.count ?? 0), 0);
                const failed = network.runs
                  .filter((run) => run.status === 'failed')
                  .reduce((total, run) => total + Number(run.count ?? 0), 0);
                const providers = network.runs.reduce(
                  (total, run) => total + Number(run.providers_seen ?? 0),
                  0,
                );
                const observations = network.runs.reduce(
                  (total, run) => total + Number(run.observations_written ?? 0),
                  0,
                );
                const latencies = network.runs
                  .map((run) => Number(run.avg_latency))
                  .filter((value) => Number.isFinite(value));
                const averageLatency = latencies.length
                  ? latencies.reduce((total, value) => total + value, 0) / latencies.length
                  : null;
                return (
                  <tr key={network.id}>
                    <td>
                      <Link href={`/app/networks/${network.id}`} className="row" style={{ gap: 7 }}>
                        <NetworkDot colour={network.brandColor} />
                        <span className="cell-title">{network.name}</span>
                      </Link>
                      <div className="cell-sub">{titleCase(network.kind)}</div>
                    </td>
                    <td>
                      <div className="stack-sm" style={{ gap: 4 }}>
                        <HealthBadge value={network.healthState} evidence="source collection" />
                        <FreshnessBadge freshness={network.freshness} />
                      </div>
                    </td>
                    <td className="num">{formatNumber(network.runs.reduce((total, run) => total + Number(run.count ?? 0), 0))}</td>
                    <td className="num" style={{ color: 'var(--green)' }}>{formatNumber(success)}</td>
                    <td className="num" style={{ color: failed ? 'var(--red)' : undefined }}>{formatNumber(failed)}</td>
                    <td className="num">{formatNumber(providers)}</td>
                    <td className="num">{formatNumber(observations)}</td>
                    <td className="num">{averageLatency !== null ? `${formatNumber(averageLatency)} ms` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!allRuns.length ? (
          <div className="table-toolbar" style={{ borderBottom: 0 }}>
            <span className="tiny muted">No collection runs occurred inside this window. That is a coverage gap, not a healthy estate.</span>
          </div>
        ) : null}
      </section>

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Monitor availability</h2>
            <span className="mono-label">observed checks</span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Monitor</th>
                  <th>Checks</th>
                  <th>Successful</th>
                  <th>Availability</th>
                  <th>Avg latency</th>
                </tr>
              </thead>
              <tbody>
                {data.monitors.map((monitor) => (
                  <tr key={monitor.id}>
                    <td>
                      <div className="cell-title">{monitor.name}</div>
                      <div className="cell-sub">{monitor.network_id ?? 'unscoped'}</div>
                    </td>
                    <td className="num">{formatNumber(monitor.checks)}</td>
                    <td className="num">{formatNumber(monitor.successful)}</td>
                    <td className="num">
                      {monitor.availability === null ? (
                        <span className="badge badge-unavailable">NO CHECKS</span>
                      ) : (
                        formatPercent(monitor.availability)
                      )}
                    </td>
                    <td className="num">
                      {monitor.avg_latency === null ? '—' : `${formatNumber(monitor.avg_latency)} ms`}
                    </td>
                  </tr>
                ))}
                {!data.monitors.length ? (
                  <tr><td colSpan={5}><div className="table-empty">No monitors are configured.</div></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="table-toolbar" style={{ borderBottom: 0 }}>
            <span className="tiny muted">
              Availability is successful checks divided by total checks inside the window. It is not a
              provider network SLA.
            </span>
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Incidents</h2>
              <TriangleAlert size={13} style={{ color: 'var(--amber)' }} />
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Severity</th><th>Status</th><th>Count</th></tr>
                </thead>
                <tbody>
                  {data.incidents.map((row, index) => (
                    <tr key={`${row.severity}-${row.status}-${index}`}>
                      <td className="tiny">{titleCase(String(row.severity))}</td>
                      <td><StatusBadge value={String(row.status)} /></td>
                      <td className="num">{formatNumber(Number(row.count ?? 0))}</td>
                    </tr>
                  ))}
                  {!data.incidents.length ? (
                    <tr><td colSpan={3}><div className="table-empty">No incident rows in this window.</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="panel-pad" style={{ paddingTop: 0 }}>
              <Link href="/app/incidents" className="link-arrow">Open incident register</Link>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Alert delivery</h2>
              <Radio size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Channel</th><th>Status</th><th>Count</th></tr>
                </thead>
                <tbody>
                  {data.alertDeliveries.map((row, index) => (
                    <tr key={`${row.channel}-${row.status}-${index}`}>
                      <td className="tiny">{titleCase(String(row.channel))}</td>
                      <td><StatusBadge value={String(row.status)} /></td>
                      <td className="num">{formatNumber(Number(row.count ?? 0))}</td>
                    </tr>
                  ))}
                  {!data.alertDeliveries.length ? (
                    <tr><td colSpan={3}><div className="table-empty">No alert deliveries were attempted in this window.</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <div className="grid split-1-2 mt-24" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Audit activity</h2>
            <Clock3 size={13} style={{ color: 'var(--secondary)' }} />
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Action</th><th>Count</th></tr>
              </thead>
              <tbody>
                {data.auditActivity.map((row, index) => (
                  <tr key={`${row.action}-${index}`}>
                    <td className="mono" style={{ fontSize: 10.5 }}>{String(row.action)}</td>
                    <td className="num">{formatNumber(Number(row.count ?? 0))}</td>
                  </tr>
                ))}
                {!data.auditActivity.length ? (
                  <tr><td colSpan={2}><div className="table-empty">No audited mutations in this window.</div></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Report notes and export</h2>
            <FileText size={13} style={{ color: 'var(--secondary)' }} />
          </div>
          <div className="panel-pad stack">
            <ul className="tiny muted" style={{ paddingLeft: 16, margin: 0, lineHeight: 1.9 }}>
              {data.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
            <div className="callout warn" style={{ margin: 0 }}>
              <strong>No PDF or CSV export.</strong> No document generator is bundled, so this page
              does not offer a download that would imply one. The underlying report is available as
              JSON from the API, and the browser print dialog can produce a local copy.
            </div>
            <div className="btn-row">
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'}/api/v1/reports?days=${days}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-ghost"
              >
                Open report JSON <ArrowUpRight size={11} />
              </a>
              <Link href="/app/benchmarks" className="btn btn-sm btn-ghost">
                Benchmark methodology
              </Link>
            </div>
            <div className="tiny muted">
              Generated {formatAge((Date.now() - new Date(data.generatedAt).getTime()) / 1000)}. Refresh
              the page to regenerate from the latest persisted evidence.
            </div>
          </div>
        </section>
      </div>

      <DataNote>
        Counts are string-typed aggregates from the API and are converted for display. They are not
        extrapolated. Where a metric has no values, this report shows a dash or an explicit badge
        instead of a zero. {failedRuns > 0 ? `${failedRuns} collection run(s) failed in this window.` : 'No collection runs failed in this window.'}
      </DataNote>

      <div className="row-between wrap mt-16">
        <span className="tiny muted">
          <EvidenceBadge value="observed" /> Collection and monitor evidence ·{' '}
          <EvidenceBadge value="reported" /> Incidents sourced from upstream state
        </span>
        <Link href="/app/settings" className="link-arrow">Retention and freshness</Link>
      </div>
    </>
  );
}
