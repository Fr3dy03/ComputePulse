import Link from 'next/link';
import {
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock3,
  Database,
  Radio,
  Server,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { API_URL, apiGet, type Overview } from '@/lib/api';
import { formatAge, formatDateTime, formatNumber, formatPercent, titleCase } from '@/lib/format';
import {
  Callout,
  DataNote,
  EvidenceBadge,
  FreshnessBadge,
  HealthBadge,
  LiveLabel,
  NetworkDot,
  PageHead,
  SeverityBadge,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import { CollectNowButton, RunDueMonitorsButton } from '@/components/actions';

export const dynamic = 'force-dynamic';

export default async function AppOverviewPage() {
  const { data, error } = await apiGet<Overview>('/api/v1/overview');

  if (!data) {
    return (
      <>
        <PageHead title="Operations overview" description="Cross-network provider observability." />
        <div className="error-banner">
          The ComputePulse API is unreachable{error ? ` (${error})` : ''}. No cached or fabricated
          values are shown. Start the API with <code>npm run dev -w @computepulse/api</code> and
          reload.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Overview</strong></>}
        title="Operations overview"
        description="Live provider estate, source collection health and active investigations. Every figure is tied to an observation or explicitly marked unavailable."
        actions={
          <>
            <RunDueMonitorsButton />
            <CollectNowButton />
          </>
        }
        meta={
          <>
            <span><Clock3 size={11} /> Snapshot {formatDateTime(data.generatedAt)}</span>
            <span><Radio size={11} /> {data.networks.length} configured sources</span>
            <span><Database size={11} /> {formatNumber(data.observations.total)} stored observations</span>
            <span><ShieldCheck size={11} /> {data.disclaimer ? 'Evidence-first aggregation' : 'Evidence-first'}</span>
          </>
        }
      />

      <div className="grid grid-4">
        <StatCard
          label="Indexed providers"
          value={formatNumber(data.providerCounts.total)}
          sub={`${formatNumber(data.providerCounts.healthy)} healthy · ${formatNumber(data.providerCounts.degraded)} degraded · ${formatNumber(data.providerCounts.down)} down · ${formatNumber(data.providerCounts.unknown)} unknown`}
          icon="server"
        />
        <StatCard
          label="Endpoint monitors"
          value={`${data.monitors.up}/${data.monitors.total}`}
          sub={
            data.monitors.availability24h !== null
              ? `${formatPercent(data.monitors.availability24h)} observed availability · 24h`
              : `${data.monitors.pending} pending first check`
          }
          icon="gauge"
          accent={data.monitors.down > 0 ? 'amber' : 'green'}
        />
        <StatCard
          label="Active incidents"
          value={data.incidents.active}
          sub={`${data.incidents.critical} critical · ${data.incidents.total} total recorded`}
          icon="alert"
          accent={data.incidents.active > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Observations / 24h"
          value={formatNumber(data.observations.last24h, { compact: true })}
          sub={`${formatNumber(data.observations.providersWithMetrics)} providers with metric evidence`}
          icon="database"
        />
      </div>

      {data.collection.failed > 0 ? (
        <div className="error-banner mt-16">
          {data.collection.failed} collection run{data.collection.failed === 1 ? '' : 's'} failed in the
          last {data.collection.windowHours}h. Source freshness below reflects the failure, not cached
          success.
        </div>
      ) : null}

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Source collection</h2>
            <Link href="/app/networks" className="link-arrow">All networks</Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Network</th>
                  <th>Source state</th>
                  <th>Freshness</th>
                  <th>Providers</th>
                  <th>API latency</th>
                  <th>Last success</th>
                  <th>Incidents</th>
                </tr>
              </thead>
              <tbody>
                {data.networks.map((network) => (
                  <tr key={network.id}>
                    <td>
                      <Link href={`/app/networks/${network.id}`} className="row" style={{ gap: 7 }}>
                        <NetworkDot colour={network.brandColor} />
                        <span className="cell-title">{network.name}</span>
                      </Link>
                      <div className="cell-sub">{network.sourceAdapter}</div>
                    </td>
                    <td><HealthBadge value={network.healthState} evidence="source collection" /></td>
                    <td><FreshnessBadge freshness={network.sourceFreshness} /></td>
                    <td className="num">{network.providerCount ? formatNumber(network.providerCount) : '—'}</td>
                    <td className="num">{network.source?.latencyMs ? `${formatNumber(network.source.latencyMs)} ms` : '—'}</td>
                    <td className="num">{network.source?.lastSuccessAt ? formatAge((Date.now() - new Date(network.source.lastSuccessAt).getTime()) / 1000) : 'never'}</td>
                    <td className="num">
                      {network.activeIncidents ? (
                        <span className="badge badge-down">{network.activeIncidents}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-toolbar" style={{ borderBottom: 0 }}>
            <span className="tiny muted">
              Source API latency is the collection request duration, not provider endpoint latency.
            </span>
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Evidence mix</h2>
              <span className="mono-label">{formatNumber(data.observations.total)} obs</span>
            </div>
            <div className="panel-pad stack-sm">
              {data.evidenceMix.map((item) => {
                const percent = (item.count / Math.max(1, data.observations.total)) * 100;
                return (
                  <div className="bar-item" key={item.evidence}>
                    <div className="bar-top">
                      <EvidenceBadge value={item.evidence} />
                      <span className="mono">{formatNumber(item.count)} · {percent.toFixed(1)}%</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${item.evidence === 'observed' ? 'green' : item.evidence === 'reported' ? 'blue' : item.evidence === 'estimated' ? 'amber' : ''}`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {!data.evidenceMix.length ? <span className="tiny muted">No observation evidence recorded yet.</span> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Provider health</h2>
              <span className="tiny muted">source-reported</span>
            </div>
            <div className="panel-pad stack-sm">
              {(['healthy', 'degraded', 'down', 'unknown'] as const).map((state) => {
                const count = data.providerCounts[state];
                const percent = (count / Math.max(1, data.providerCounts.total)) * 100;
                return (
                  <div className="bar-item" key={state}>
                    <div className="bar-top">
                      <span className="row" style={{ gap: 7 }}>
                        <span className={`status-dot ${state}`} /> {titleCase(state)}
                      </span>
                      <span className="mono">{formatNumber(count)} · {percent.toFixed(1)}%</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${state === 'healthy' ? 'green' : state === 'degraded' ? 'amber' : state === 'down' ? 'red' : ''}`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="panel-pad" style={{ paddingTop: 0 }}>
              <DataNote>{data.providerCounts.note}</DataNote>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Alert delivery</h2>
              <span className={`badge ${Object.values(data.alertDeliveries).some((state) => state === 'failed') ? 'badge-down' : 'badge-unavailable'}`}>
                {Object.values(data.alertDeliveries).filter((state) => state === 'sent').length} sent
              </span>
            </div>
            <div className="panel-pad">
              <dl className="kv">
                {Object.entries(data.alertDeliveries).map(([channel, state]) => (
                  <div key={channel} style={{ display: 'contents' }}>
                    <dt>{channel}</dt>
                    <dd><StatusBadge value={state} /></dd>
                  </div>
                ))}
              </dl>
              <Link href="/app/integrations" className="link-arrow mt-12">Configure delivery</Link>
            </div>
          </section>
        </div>
      </div>

      <div className="grid split-1-2 mt-24" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Latest incidents</h2>
            <Link href="/app/incidents" className="link-arrow">All incidents</Link>
          </div>
          {data.latestIncidents.length ? (
            <div className="stack-sm" style={{ padding: 16 }}>
              {data.latestIncidents.slice(0, 5).map((incident) => (
                <Link
                  href={`/app/incidents/${incident.id}`}
                  key={incident.id}
                  className="panel panel-pad"
                  style={{ background: 'var(--bg)', padding: 14 }}
                >
                  <div className="row-between wrap" style={{ gap: 8 }}>
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge value={incident.status} />
                  </div>
                  <div style={{ fontWeight: 500, marginTop: 8, fontSize: 12.5 }}>{incident.title}</div>
                  <div className="cell-sub">
                    {incident.network_name ?? 'Unscoped'} · detected {formatAge((Date.now() - new Date(incident.detected_at).getTime()) / 1000)} · {incident.source}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="table-empty">No incidents recorded. This is an observed absence, not an assumed all-clear.</div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Recent collection runs</h2>
            <span className="mono-label">last {data.collection.windowHours}h</span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Providers</th>
                  <th>Observations</th>
                  <th>Latency</th>
                  <th>Finished</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {data.collectionStatus.recentRuns.slice(0, 12).map((run, index) => {
                  const row = run as Record<string, unknown>;
                  return (
                    <tr key={String(row.id ?? index)}>
                      <td className="mono" style={{ fontSize: 10.5 }}>{String(row.network_id ?? '—')}</td>
                      <td><StatusBadge value={String(row.status ?? 'unknown')} /></td>
                      <td className="num">{formatNumber(row.providers_seen as number | null)}</td>
                      <td className="num">{formatNumber(row.observations_written as number | null)}</td>
                      <td className="num">{row.source_latency_ms ? `${formatNumber(row.source_latency_ms as number)} ms` : '—'}</td>
                      <td className="num">{row.finished_at ? formatAge((Date.now() - new Date(String(row.finished_at)).getTime()) / 1000) : '—'}</td>
                      <td className="tiny" style={{ maxWidth: 220 }}>{row.error ? <span style={{ color: '#eda5a1' }}>{String(row.error)}</span> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="panel-pad row-between wrap" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="row wrap" style={{ gap: 14 }}>
              <span className="tiny muted"><CircleCheck size={11} style={{ display: 'inline' }} /> {data.collection.succeeded} succeeded</span>
              <span className="tiny muted"><TriangleAlert size={11} style={{ display: 'inline' }} /> {data.collection.degraded} degraded</span>
              <span className="tiny muted"><CircleAlert size={11} style={{ display: 'inline' }} /> {data.collection.failed} failed</span>
            </div>
            <span className="tiny muted">Avg collection {data.collection.avgLatencyMs ? `${formatNumber(data.collection.avgLatencyMs)} ms` : '—'}</span>
          </div>
        </section>
      </div>

      <div className="grid grid-3 mt-24">
        <section className="panel panel-pad">
          <div className="row-between">
            <h3>Monitored endpoints</h3>
            <LiveLabel>checks</LiveLabel>
          </div>
          <p className="tiny mt-8">
            {data.monitors.total} endpoint monitors configured. {data.monitors.up} up, {data.monitors.down} down, {data.monitors.pending} pending.
          </p>
          <div className="mt-12"><Link href="/app/monitors" className="link-arrow">Manage monitors</Link></div>
        </section>
        <section className="panel panel-pad">
          <div className="row-between">
            <h3>Capacity</h3>
            <CircleDashed size={14} style={{ color: 'var(--secondary)' }} />
          </div>
          <p className="tiny mt-8">
            Capacity exists only where a source reports it. {data.networks.filter((network) => network.capacityProviders > 0).length} network(s) expose provider capacity evidence.
          </p>
          <div className="mt-12"><Link href="/app/capacity" className="link-arrow">Inspect capacity</Link></div>
        </section>
        <section className="panel panel-pad">
          <div className="row-between">
            <h3>Reports</h3>
            <Clock3 size={14} style={{ color: 'var(--secondary)' }} />
          </div>
          <p className="tiny mt-8">
            Generate a 7- or 30-day operational report from stored observations, checks, incidents and alert deliveries.
          </p>
          <div className="mt-12"><Link href="/app/reports" className="link-arrow">Open reports</Link></div>
        </section>
      </div>

      <div className="callout mt-24">
        <strong>What this overview does not do:</strong> it does not calculate a cross-network health
        percentage, does not treat source-reported provider state as measured endpoint availability,
        and does not fill missing capacity with estimates. {data.disclaimer}
      </div>

      <div className="row-between wrap mt-16">
        <span className="tiny muted">
          PGlite local mode · {data.collectionStatus.sources.length} sources · {formatNumber(data.observations.providersWithMetrics)} providers with metrics
        </span>
        <div className="row" style={{ gap: 8 }}>
          <a href={`${API_URL}/api/docs`} target="_blank" rel="noreferrer" className="tiny muted" style={{ textDecoration: 'underline' }}>API docs</a>
          <span className="tiny muted">·</span>
          <Link href="/metric-methodology" className="tiny muted" style={{ textDecoration: 'underline' }}>Methodology</Link>
          <span className="tiny muted">·</span>
          <a href="https://www.botchain.ai/en/" target="_blank" rel="noreferrer" className="tiny muted" style={{ textDecoration: 'underline' }}>
            BOT Chain <ArrowUpRight size={9} style={{ display: 'inline' }} />
          </a>
        </div>
      </div>
    </>
  );
}
