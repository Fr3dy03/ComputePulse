import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowUpRight,
  Clock3,
  Cpu,
  Database,
  ExternalLink,
  Globe2,
  HardDrive,
  MapPin,
  Server,
  ShieldAlert,
} from 'lucide-react';
import {
  apiGet,
  type History,
  type ProviderDetail,
} from '@/lib/api';
import {
  formatAge,
  formatBytes,
  formatCores,
  formatDateTime,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import {
  AvailabilityValue,
  Callout,
  DataNote,
  EvidenceBadge,
  FreshnessBadge,
  HealthBadge,
  MetricCell,
  NetworkDot,
  PageHead,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import { HistoryChart } from '@/components/HistoryChart';
import { CheckMonitorButton } from '@/components/actions';

export const dynamic = 'force-dynamic';

const METRIC_LABELS: Record<string, string> = {
  'akash.uptime_1d': 'Source-reported uptime · 24h',
  'akash.uptime_7d': 'Source-reported uptime · 7d',
  'akash.uptime_30d': 'Source-reported uptime · 30d',
  'akash.cpu.total_cores': 'Reported total CPU cores',
  'akash.cpu.available_cores': 'Reported available CPU cores',
  'akash.memory.total_bytes': 'Reported total memory',
  'akash.memory.available_bytes': 'Reported available memory',
  'akash.source_latency_ms': 'Source API latency',
  'akash.source_age_seconds': 'Akash source check age',
  'provider.online': 'Provider online state',
  'provider.uptime_1d': 'Source-reported uptime · 24h',
  'provider.uptime_7d': 'Source-reported uptime · 7d',
  'provider.uptime_30d': 'Source-reported uptime · 30d',
  'flux.confirmation_lag_blocks': 'Estimated confirmation lag',
  'flux.block_height': 'Last confirmed block',
  'flux.collateral': 'Reported collateral',
  'chain.rpc_latency_ms': 'RPC latency',
};

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: provider, error } = await apiGet<ProviderDetail>(
    `/api/v1/providers/${encodeURIComponent(id)}`,
  );
  if (!provider) {
    if (error) {
      return (
        <>
          <div className="error-banner">Provider detail could not be loaded: {error}</div>
          <Link href="/app/providers" className="btn btn-sm">Back to providers</Link>
        </>
      );
    }
    notFound();
  }

  const historyMetric =
    provider.availableMetricKeys.find((metric) => metric.metric_key.includes('uptime_1d'))?.metric_key ??
    provider.availableMetricKeys[0]?.metric_key ??
    'provider.online';
  const history = await apiGet<History>(
    `/api/v1/providers/${encodeURIComponent(id)}/history?metricKey=${encodeURIComponent(historyMetric)}&window=24h`,
  );

  const metricOptions = provider.availableMetricKeys.map((metric) => ({
    key: metric.metric_key,
    label: METRIC_LABELS[metric.metric_key] ?? metric.metric_key.replace(/[._]/g, ' '),
    unit: metric.unit,
  }));

  const displayName = provider.name || provider.hostReference || provider.externalId;

  return (
    <>
      <PageHead
        breadcrumb={
          <>
            <Link href="/app/providers">Providers</Link> /{' '}
            <Link href={`/app/networks/${provider.network.id}`}>{provider.network.name}</Link> /{' '}
            <strong>detail</strong>
          </>
        }
        title={displayName.replace(/^https?:\/\//, '')}
        description={provider.healthReason ?? undefined}
        actions={
          <>
            {provider.hostReference ? (
              <a href={provider.hostReference} target="_blank" rel="noreferrer" className="btn btn-sm">
                Host reference <ExternalLink size={11} />
              </a>
            ) : null}
            <Link href="/app/monitors/new" className="btn btn-sm btn-primary">Monitor an endpoint</Link>
          </>
        }
        meta={
          <>
            <span><NetworkDot colour={provider.network.brandColor} /> {provider.network.name}</span>
            <span><MapPin size={11} /> {[provider.city, provider.region, provider.country].filter(Boolean).join(', ') || 'Location unavailable'}</span>
            <span><Clock3 size={11} /> Observed {formatDateTime(provider.statusObservedAt)}</span>
            <span><Database size={11} /> {provider.availableMetricKeys.length} metric keys</span>
          </>
        }
      />

      <div className="row wrap mb-16" style={{ gap: 8 }}>
        <HealthBadge value={provider.healthState} evidence={provider.healthSignal} />
        <FreshnessBadge freshness={provider.freshness} showMessage />
        <EvidenceBadge value={provider.availability.evidence} suffix="availability" />
        <EvidenceBadge value={provider.capacityEvidence} suffix="capacity" />
        <span className="badge">{provider.healthSignal.replace(/_/g, ' ')}</span>
        {provider.activeIncidents > 0 ? <span className="badge badge-down">{provider.activeIncidents} active incident</span> : null}
      </div>

      <div className="grid grid-4">
        <StatCard
          label="24h availability"
          value={provider.availability.day1 !== null ? formatPercent(provider.availability.day1) : '—'}
          sub={provider.availability.day1 !== null ? 'source-reported · not probed' : 'not reported by source'}
          icon="gauge"
          accent={provider.availability.day1 !== null && provider.availability.day1 >= 0.99 ? 'green' : 'amber'}
        />
        <StatCard
          label="Source API latency"
          value={provider.source.latencyMs ? `${formatNumber(provider.source.latencyMs)} ms` : '—'}
          sub="collection request duration"
          icon="signal"
        />
        <StatCard
          label="CPU available"
          value={provider.capacity?.cpuAvailableCores != null ? formatNumber(provider.capacity.cpuAvailableCores) : '—'}
          sub={provider.capacity ? `of ${formatCores(provider.capacity.cpuTotalCores)} reported total` : 'capacity UNAVAILABLE'}
          icon="gauge"
        />
        <StatCard
          label="GPU available"
          value={provider.capacity?.gpuAvailable != null ? String(provider.capacity.gpuAvailable) : '—'}
          sub={provider.capacity ? `of ${provider.capacity.gpuTotal ?? '—'} reported total` : 'capacity UNAVAILABLE'}
          icon="server"
        />
      </div>

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Latest observations</h2>
              <span className="mono-label">point-in-time</span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Evidence</th>
                    <th>Observed at</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {provider.observations.map((observation) => (
                    <tr key={`${observation.metric_key}-${observation.observed_at}`}>
                      <td>
                        <div className="cell-title">{observation.name ?? observation.metric_key}</div>
                        <div className="cell-sub mono">{observation.metric_key}</div>
                      </td>
                      <td className="num">
                        {formatNumber(observation.value, { maximumFractionDigits: 4 })} {observation.unit}
                      </td>
                      <td><EvidenceBadge value={observation.evidence_type ?? observation.status} /></td>
                      <td className="num">{formatDateTime(observation.observed_at)}</td>
                      <td className="mono" style={{ fontSize: 9.5, maxWidth: 180 }}>
                        {observation.source_endpoint.replace(/^https?:\/\//, '')}
                      </td>
                    </tr>
                  ))}
                  {!provider.observations.length ? (
                    <tr><td colSpan={5}><div className="table-empty">No observation exists for this provider in the latest collection.</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="table-toolbar" style={{ borderBottom: 0 }}>
              <span className="tiny muted">
                All values above are point-in-time source observations. They are not a rolling SLA.
              </span>
              <span className="tiny muted">Adapter {provider.source.adapterVersion}</span>
            </div>
          </section>

          <HistoryChart
            scope="providers"
            id={provider.id}
            metricKeys={metricOptions}
            initialMetric={historyMetric}
            initialHistory={history.data}
            title="Observation history"
          />

          <section className="panel">
            <div className="panel-head">
              <h2>Capacity evidence</h2>
              <EvidenceBadge value={provider.capacityEvidence} />
            </div>
            <div className="panel-pad">
              {provider.capacity ? (
                <>
                  <div className="metric-grid">
                    <MetricCell label="CPU total" value={formatCores(provider.capacity.cpuTotalCores)} detail="provider-reported" />
                    <MetricCell label="CPU available" value={formatCores(provider.capacity.cpuAvailableCores)} detail="provider-reported" />
                    <MetricCell label="CPU active" value={formatCores(provider.capacity.cpuActiveCores)} detail="provider-reported" />
                    <MetricCell label="Memory total" value={formatBytes(provider.capacity.memoryTotalBytes)} detail="bytes" />
                    <MetricCell label="Memory available" value={formatBytes(provider.capacity.memoryAvailableBytes)} detail="bytes" />
                    <MetricCell label="Memory active" value={formatBytes(provider.capacity.memoryActiveBytes)} detail="bytes" />
                    <MetricCell label="Storage total" value={formatBytes(provider.capacity.storageTotalBytes)} detail="bytes" />
                    <MetricCell label="Storage available" value={formatBytes(provider.capacity.storageAvailableBytes)} detail="bytes" />
                  </div>
                  {provider.capacity.gpuModels?.length ? (
                    <div className="mt-16">
                      <div className="mono-label mb-8">GPU models</div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {provider.capacity.gpuModels.map((gpu, index) => (
                          <span className="badge" key={index}>
                            {String(gpu.vendor ?? '')} {String(gpu.model ?? '')} {String(gpu.ram ?? '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <Callout tone="warn" icon={false}>
                    <strong>Reported, not measured.</strong> These values come from the provider's entry
                    in the source index. They may not reflect schedulable capacity at this moment and
                    are not an availability guarantee.
                  </Callout>
                </>
              ) : (
                <Callout tone="warn">
                  <strong>Capacity UNAVAILABLE.</strong> {provider.network.name} does not expose
                  provider capacity in this source. ComputePulse does not infer or estimate it.
                </Callout>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Provider incidents</h2><Link href={`/app/incidents?providerId=${provider.id}`} className="link-arrow">Filtered list</Link></div>
            <div className="stack-sm panel-pad">
              {provider.incidents.length ? provider.incidents.map((incident, index) => {
                const row = incident as Record<string, unknown>;
                return (
                  <Link href={`/app/incidents/${row.id}`} key={String(row.id ?? index)} className="panel panel-pad" style={{ background: 'var(--bg)', padding: 12 }}>
                    <div className="row-between">
                      <span style={{ fontSize: 12 }}>{String(row.title ?? 'Incident')}</span>
                      <StatusBadge value={String(row.status ?? 'open')} />
                    </div>
                    <div className="cell-sub">{formatDateTime(String(row.detected_at ?? ''))} · {String(row.severity ?? '')}</div>
                  </Link>
                );
              }) : <span className="tiny muted">No incident correlates with this provider.</span>}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Identity</h2><Server size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              <dl className="kv">
                <dt>Provider ID</dt><dd className="mono" style={{ textAlign: 'left', fontSize: 10 }}>{provider.id}</dd>
                <dt>External ID</dt><dd className="mono" style={{ textAlign: 'left', fontSize: 10 }}>{provider.externalId}</dd>
                <dt>Operator</dt><dd className="mono" style={{ textAlign: 'left', fontSize: 10 }}>{provider.operatorAddress ?? '—'}</dd>
                <dt>Host reference</dt><dd className="mono" style={{ textAlign: 'left', fontSize: 10 }}>{provider.hostReference ?? '—'}</dd>
                <dt>Location</dt><dd>{[provider.city, provider.region, provider.country].filter(Boolean).join(', ') || '—'}</dd>
                <dt>Location source</dt><dd style={{ textAlign: 'left' }}>{provider.locationSource ?? '—'}</dd>
                <dt>First seen</dt><dd>{formatDateTime(provider.firstSeenAt)}</dd>
                <dt>Last seen</dt><dd>{formatDateTime(provider.lastSeenAt)}</dd>
              </dl>
              <DataNote>{provider.hostNote}</DataNote>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Provenance</h2><ExternalLink size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              <dl className="kv">
                <dt>Source</dt><dd>{provider.network.name}</dd>
                <dt>Adapter</dt><dd className="mono">{provider.source.adapterVersion}</dd>
                <dt>Rate limit</dt><dd>{provider.source.adapterRateLimit}</dd>
                <dt>Expected interval</dt><dd>{provider.source.expectedIntervalSeconds}s</dd>
                <dt>Stale after</dt><dd>{provider.source.staleAfterSeconds}s</dd>
                <dt>Source state</dt><dd>{provider.source.state}</dd>
                <dt>Method</dt><dd style={{ textAlign: 'left' }}>{String(provider.provenance.collectionMethod ?? '—')}</dd>
              </dl>
              <a href={provider.sourceUrl} target="_blank" rel="noreferrer" className="link-arrow mt-12">
                Source endpoint <ArrowUpRight size={11} />
              </a>
              <div className="tiny muted mt-8" style={{ wordBreak: 'break-all' }}>{provider.sourceUrl}</div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Hardware metadata</h2><Cpu size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              {Object.keys(provider.hardware).length ? (
                <dl className="kv">
                  {Object.entries(provider.hardware).map(([key, value]) => (
                    <div key={key} style={{ display: 'contents' }}>
                      <dt>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
                      <dd className="mono" style={{ textAlign: 'left', fontSize: 10 }}>
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : <span className="tiny muted">No hardware metadata exposed.</span>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Availability windows</h2><Clock3 size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              <div className="stack-sm">
                <div className="row-between">
                  <span className="tiny muted">24 hours</span>
                  <AvailabilityValue value={provider.availability.day1} window="24h" />
                </div>
                <div className="row-between">
                  <span className="tiny muted">7 days</span>
                  <AvailabilityValue value={provider.availability.day7} window="7d" />
                </div>
                <div className="row-between">
                  <span className="tiny muted">30 days</span>
                  <AvailabilityValue value={provider.availability.day30} window="30d" />
                </div>
              </div>
              <div className="callout mt-12" style={{ fontSize: 11.5 }}>{provider.availability.note}</div>
              <div className="mono-label mt-12">Method · {provider.availability.method ?? 'unavailable'}</div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Related checks</h2><ShieldAlert size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              <p className="tiny muted">
                No endpoint monitor is attached to this provider by default. Source health is not a
                substitute for direct probing.
              </p>
              <Link href="/app/monitors/new" className="btn btn-sm mt-12">Create explicit monitor</Link>
            </div>
          </section>
        </div>
      </div>

      <DataNote>
        Availability is sourced from {provider.network.name}. ComputePulse does not verify it. The
        provider's host reference is not probed unless an operator creates an explicit monitor. This
        record contains no synthetic fallback values. Checked at {formatAge((Date.now() - new Date(provider.statusObservedAt ?? provider.lastSeenAt).getTime()) / 1000)}.
      </DataNote>
    </>
  );
}
