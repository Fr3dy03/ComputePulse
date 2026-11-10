import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowUpRight,
  Clock3,
  Database,
  ExternalLink,
  Globe2,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import {
  apiGet,
  type History,
  type NetworkDetail,
} from '@/lib/api';import { formatAge, formatDateTime, formatNumber } from '@/lib/format';
import {
  DataNote,
  EvidenceBadge,
  FreshnessBadge,
  HealthBadge,
  NetworkDot,
  PageHead,
  SeverityBadge,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import { HistoryChart } from '@/components/HistoryChart';
import { ProvidersTable, type ProvidersResponse } from '@/components/ProvidersTable';
import { CollectNowButton } from '@/components/actions';

export const dynamic = 'force-dynamic';

export default async function NetworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const networkResponse = await apiGet<NetworkDetail>(`/api/v1/networks/${encodeURIComponent(id)}`);
  const network = networkResponse.data;
  if (!network) notFound();

  const [historyResponse, providersResponse] = await Promise.all([
    apiGet<History>(
      `/api/v1/networks/${encodeURIComponent(id)}/history?metricKey=network.source_latency_ms&window=24h`,
    ),
    apiGet<ProvidersResponse>(
      `/api/v1/providers?networkId=${encodeURIComponent(id)}&pageSize=10&availabilityWindow=24h&sort=name`,
    ),
  ]);

  const metricOptions = [
    { key: 'network.source_latency_ms', label: 'Source API latency', unit: 'ms' },
    ...network.latestMetrics
      .filter((metric) => metric.metric_key !== 'network.source_latency_ms')
      .map((metric) => ({
        key: metric.metric_key,
        label: metric.metric_key.replace(/[._]/g, ' '),
        unit: metric.unit,
      })),
  ];

  return (
    <>
      <PageHead
        breadcrumb={<><Link href="/app/networks">Networks</Link> / <strong>{network.name}</strong></>}
        title={network.name}
        description={network.description}
        actions={
          <>
            <CollectNowButton networkId={network.id} />
            <Link href={`/app/providers?networkId=${network.id}`} className="btn btn-primary btn-sm">
              Browse providers
            </Link>
          </>
        }
        meta={
          <>
            <span><NetworkDot colour={network.brandColor} /> {network.kind.replace(/_/g, ' ')}</span>
            <span><Radio size={11} /> {network.sourceAdapter}</span>
            <span><Database size={11} /> {formatNumber(network.providerCount)} provider records</span>
            <span><Clock3 size={11} /> Last success {network.source?.lastSuccessAt ? formatAge((Date.now() - new Date(network.source.lastSuccessAt).getTime()) / 1000) : 'never'}</span>
          </>
        }
      />

      <div className="row wrap mb-16" style={{ gap: 8 }}>
        <HealthBadge value={network.healthState} evidence="source collection" />
        <FreshnessBadge freshness={network.sourceFreshness} showMessage />
        <EvidenceBadge value={network.providerCount ? 'reported' : 'observed'} suffix="source collection" />
        {network.chainId ? <span className="badge">chain {network.chainId}</span> : null}
        {network.sourceFreshness.state === 'stale' ? <span className="badge badge-stale">STALE SOURCE</span> : null}
      </div>

      {network.source?.lastError ? (
        <div className="error-banner">Last source error: {network.source.lastError}</div>
      ) : null}

      <div className="grid grid-4">
        <StatCard label="Provider records" value={formatNumber(network.providerCount)} sub={`${formatNumber(network.healthCounts.healthy ?? 0)} healthy · ${formatNumber(network.healthCounts.down ?? 0)} down`} icon="server" />
        <StatCard label="Capacity evidence" value={network.capacityProviders ? formatNumber(network.capacityProviders) : 'UNAVAILABLE'} sub={network.capacityProviders ? 'providers reporting resources' : 'source does not expose capacity'} icon="database" accent={network.capacityProviders ? undefined : 'amber'} />
        <StatCard label="Endpoint monitors" value={network.monitoredEndpoints} sub={`${network.healthyEndpoints} up · ${network.failedEndpoints} failing`} icon="gauge" accent={network.failedEndpoints ? 'red' : 'green'} />
        <StatCard label="Active incidents" value={network.activeIncidents} sub="correlated from source state" icon="alert" accent={network.activeIncidents ? 'red' : 'green'} />
      </div>

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Source contract</h2>
              <a href={network.sourceUrl ?? '#'} className="link-arrow" target="_blank" rel="noreferrer">
                Open source
              </a>
            </div>
            <div className="panel-pad">
              <dl className="kv">
                <dt>Source endpoint</dt>
                <dd className="mono" style={{ fontSize: 10.5, textAlign: 'left' }}>{network.sourceUrl ?? '—'}</dd>
                <dt>Adapter</dt>
                <dd className="mono">{network.adapter?.version ?? network.sourceAdapter}</dd>
                <dt>Expected interval</dt>
                <dd>{network.source ? `${network.source.expectedIntervalSeconds}s` : '—'}</dd>
                <dt>Stale after</dt>
                <dd>{network.source ? `${network.source.staleAfterSeconds}s` : '—'}</dd>
                <dt>Consecutive failures</dt>
                <dd>{network.source?.consecutiveFailures ?? '—'}</dd>
                <dt>Source API latency</dt>
                <dd>{network.source?.latencyMs ? `${formatNumber(network.source.latencyMs)} ms` : '—'}</dd>
                <dt>Last attempt</dt>
                <dd>{formatDateTime(network.source?.lastAttemptAt)}</dd>
                <dt>Last success</dt>
                <dd>{formatDateTime(network.source?.lastSuccessAt)}</dd>
                <dt>Last observation</dt>
                <dd>{formatDateTime(network.lastObservedAt)}</dd>
              </dl>
              <div className="grid grid-2 mt-16">
                <div>
                  <div className="mono-label mb-8">Evidence the source supports</div>
                  <ul className="tiny muted" style={{ paddingLeft: 16, margin: 0 }}>
                    {network.supportedMetrics.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="mono-label mb-8">Limits you must read</div>
                  <ul className="tiny muted" style={{ paddingLeft: 16, margin: 0 }}>
                    {network.limitations.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
              <DataNote>{network.healthReason}</DataNote>
            </div>
          </section>

          {network.providerCount > 0 ? (
            <section>
              <div className="row-between mb-12">
                <div>
                  <div className="eyebrow">Provider estate</div>
                  <h2 style={{ fontSize: 20, marginTop: 6 }}>Recent provider records</h2>
                </div>
                <Link href={`/app/providers?networkId=${network.id}`} className="link-arrow">Full directory</Link>
              </div>
              <ProvidersTable
                initial={providersResponse.data}
                networks={[network]}
                fixedNetworkId={network.id}
                initialFilters={{ networkId: network.id }}
                compact
              />
            </section>
          ) : (
            <div className="panel panel-pad">
              <h3>No provider marketplace on this network</h3>
              <p className="mt-8">
                {network.name} is monitored as a {network.kind.replace(/_/g, ' ')}. Its chain evidence
                is stored against the network, not presented as a provider directory. This is a
                structural fact about the source, not missing data.
              </p>
            </div>
          )}

          <HistoryChart
            scope="networks"
            id={network.id}
            metricKeys={metricOptions}
            initialHistory={historyResponse.data}
            initialMetric="network.source_latency_ms"
          />
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Latest network metrics</h2><span className="mono-label">provider_id null</span></div>
            <div className="panel-pad">
              {network.latestMetrics.length ? (
                <dl className="kv">
                  {network.latestMetrics.map((metric) => (
                    <div key={metric.metric_key} style={{ display: 'contents' }}>
                      <dt className="mono" style={{ fontSize: 10, textAlign: 'left' }}>{metric.metric_key}</dt>
                      <dd>
                        <span className="mono">{formatNumber(metric.value, { maximumFractionDigits: 3 })} {metric.unit}</span>
                        <div><EvidenceBadge value={metric.status} /></div>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : <span className="tiny muted">No network-scoped observations.</span>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Endpoint monitors</h2><Link href="/app/monitors" className="link-arrow">All</Link></div>
            <div className="stack-sm panel-pad">
              {network.monitors.map((monitor) => {
                const row = monitor as Record<string, unknown>;
                return (
                  <Link key={String(row.id)} href={`/app/monitors/${row.id}`} className="panel panel-pad" style={{ background: 'var(--bg)', padding: 12 }}>
                    <div className="row-between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 12 }}>{String(row.name)}</span>
                      <StatusBadge value={String(row.last_status ?? 'pending')} />
                    </div>
                    <div className="cell-sub">
                      {row.last_latency_ms ? `${row.last_latency_ms} ms` : 'No latency'} · every {String(row.interval_seconds)}s
                    </div>
                  </Link>
                );
              })}
              {!network.monitors.length ? <span className="tiny muted">No endpoint monitor configured for this network.</span> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Recent incidents</h2><Link href={`/app/incidents?networkId=${network.id}`} className="link-arrow">All</Link></div>
            <div className="stack-sm panel-pad">
              {network.recentIncidents.map((incident) => {
                const row = incident as Record<string, unknown>;
                return (
                  <Link key={String(row.id)} href={`/app/incidents/${row.id}`} className="panel panel-pad" style={{ background: 'var(--bg)', padding: 12 }}>
                    <div className="row-between" style={{ gap: 8 }}>
                      <SeverityBadge severity={String(row.severity ?? 'info')} />
                      <StatusBadge value={String(row.status ?? 'open')} />
                    </div>
                    <div className="mt-8" style={{ fontSize: 12 }}>{String(row.title)}</div>
                    <div className="cell-sub">{formatAge((Date.now() - new Date(String(row.detected_at)).getTime()) / 1000)}</div>
                  </Link>
                );
              })}
              {!network.recentIncidents.length ? <span className="tiny muted">No incident records on this network.</span> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Source links</h2><ShieldAlert size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad stack-sm">
              {network.docsUrl ? (
                <a className="row-between tiny" href={network.docsUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
                  Documentation <ExternalLink size={11} />
                </a>
              ) : null}
              {network.explorerUrl ? (
                <a className="row-between tiny" href={network.explorerUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
                  Explorer <Globe2 size={11} />
                </a>
              ) : null}
              <Link className="row-between tiny" href={`/metric-methodology?network=${network.id}`} style={{ color: 'var(--cyan)' }}>
                Measurement method <ArrowUpRight size={11} />
              </Link>
            </div>
          </section>
        </div>
      </div>

      <section className="panel mt-24">
        <div className="panel-head">
          <h2>Recent collection runs</h2>
          <span className="tiny muted">Diagnostics — status, counts and errors</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Started</th>
                <th>Status</th>
                <th>Adapter</th>
                <th>Providers seen</th>
                <th>Observations written</th>
                <th>Source latency</th>
                <th>Worker</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {network.recentRuns.slice(0, 10).map((run, index) => (
                <tr key={String(run.id ?? index)}>
                  <td className="num">{formatDateTime(String(run.started_at ?? ''))}</td>
                  <td><StatusBadge value={String(run.status ?? 'unknown')} /></td>
                  <td className="mono" style={{ fontSize: 10 }}>{String(run.adapter_version ?? '—')}</td>
                  <td className="num">{formatNumber(run.providers_seen as number | null)}</td>
                  <td className="num">{formatNumber(run.observations_written as number | null)}</td>
                  <td className="num">{run.source_latency_ms ? `${run.source_latency_ms} ms` : '—'}</td>
                  <td className="mono" style={{ fontSize: 9.5 }}>{String(run.worker_id ?? '—')}</td>
                  <td className="tiny" style={{ color: run.error ? '#eda5a1' : undefined }}>{run.error ? String(run.error) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
