import Link from 'next/link';
import { Cpu, Database, HardDrive, Layers3, MemoryStick, ShieldAlert } from 'lucide-react';
import { apiGet, type CapacityOverview, type CapacityProvider } from '@/lib/api';
import { formatBytes, formatDateTime, formatNumber } from '@/lib/format';
import {
  Callout,
  DataNote,
  EvidenceBadge,
  NetworkDot,
  PageHead,
  StatCard,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function CapacityPage() {
  const { data, error } = await apiGet<CapacityOverview>('/api/v1/capacity');
  if (!data) {
    return (
      <>
        <PageHead title="Capacity evidence" description="Provider-reported compute capacity." />
        <div className="error-banner">Capacity could not be loaded: {error}</div>
      </>
    );
  }

  const akash = data.networks.find((network) => network.capacity)?.capacity ?? null;
  const providers = [...data.providers].sort(
    (a, b) => (b.cpuAvailableCores ?? 0) - (a.cpuAvailableCores ?? 0),
  );
  const reportingNetworks = data.networks.filter((network) => network.capacity);
  const silentNetworks = data.networks.filter((network) => !network.capacity);

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Capacity</strong></>}
        title="Capacity evidence"
        description="Provider-reported resource capacity, kept distinct from observed availability and never treated as guaranteed schedulable compute."
        meta={
          <>
            <span><Cpu size={11} /> {providers.length} capacity-reporting providers</span>
            <span><Database size={11} /> Reported evidence only</span>
            <span><ShieldAlert size={11} /> unavailable where source is silent</span>
          </>
        }
      />

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid grid-4">
        <StatCard label="Capacity providers" value={data.providers.length} sub={`${reportingNetworks.length} network reporting`} icon="server" />
        <StatCard label="CPU available" value={akash ? `${formatNumber(akash.cpuAvailable)}` : '—'} sub={akash ? `of ${formatNumber(akash.cpuTotal)} reported cores` : 'UNAVAILABLE'} icon="gauge" />
        <StatCard label="Memory available" value={akash ? formatBytes(akash.memoryAvailable) : '—'} sub={akash ? `of ${formatBytes(akash.memoryTotal)} reported` : 'UNAVAILABLE'} icon="database" />
        <StatCard label="GPU available" value={akash ? formatNumber(akash.gpuAvailable) : '—'} sub={akash ? `of ${formatNumber(akash.gpuTotal)} reported units` : 'UNAVAILABLE'} icon="server" accent="amber" />
      </div>

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head"><h2>Provider capacity</h2><span className="mono-label">sorted by available CPU</span></div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Network</th>
                  <th>CPU avail / total</th>
                  <th>Memory avail / total</th>
                  <th>Storage available</th>
                  <th>GPU avail / total</th>
                  <th>Evidence</th>
                  <th>Observed</th>
                </tr>
              </thead>
              <tbody>
                {providers.slice(0, 100).map((provider) => (
                  <ProviderCapacityRow provider={provider} key={provider.providerId} />
                ))}
                {!providers.length ? (
                  <tr><td colSpan={8}><div className="table-empty">No provider capacity is exposed by any configured source.</div></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {providers.length > 100 ? (
            <div className="table-toolbar" style={{ borderBottom: 0 }}>
              <span className="tiny muted">Showing first 100 of {providers.length} capacity-reporting providers.</span>
            </div>
          ) : null}
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Network evidence</h2><Layers3 size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="stack-sm panel-pad">
              {reportingNetworks.map((network) => (
                <div key={network.id} className="panel panel-pad" style={{ background: 'var(--bg)', padding: 12 }}>
                  <div className="row-between">
                    <span className="row" style={{ gap: 7 }}><NetworkDot colour={network.brandColor} /><span style={{ fontSize: 12 }}>{network.name}</span></span>
                    <EvidenceBadge value="reported" />
                  </div>
                  <div className="cell-sub mt-8">
                    {network.capacity ? `${network.capacity.providers} providers · ${formatNumber(network.capacity.cpuAvailable)} available cores` : ''}
                  </div>
                  <div className="cell-sub">
                    {network.capacity ? `${formatBytes(network.capacity.memoryAvailable)} memory · ${formatNumber(network.capacity.gpuAvailable)} GPU` : ''}
                  </div>
                </div>
              ))}
              {silentNetworks.map((network) => (
                <div key={network.id} className="panel panel-pad" style={{ background: 'var(--bg)', padding: 12 }}>
                  <div className="row-between">
                    <span className="row" style={{ gap: 7 }}><NetworkDot colour={network.brandColor} /><span style={{ fontSize: 12 }}>{network.name}</span></span>
                    <span className="badge badge-unavailable">UNAVAILABLE</span>
                  </div>
                  <div className="cell-sub mt-8">The source does not expose capacity. No estimate is generated.</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Methodology</h2><span className="tiny muted">capacity method</span></div>
            <div className="panel-pad">
              <dl className="kv">
                <dt>Evidence</dt><dd><EvidenceBadge value={String(data.methodology.evidence ?? 'reported')} /></dd>
                <dt>Source</dt><dd style={{ textAlign: 'left' }}>{String(data.methodology.source ?? '—')}</dd>
                <dt>Unit conversion</dt><dd style={{ textAlign: 'left' }}>{String(data.methodology.unitConversions ?? '—')}</dd>
                <dt>Flux</dt><dd style={{ textAlign: 'left' }}>{String(data.methodology.flux ?? '—')}</dd>
              </dl>
              <Callout tone="warn" icon={false}>{String(data.methodology.warning ?? '')}</Callout>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>GPU models</h2><Cpu size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              {akash ? (
                <div className="row wrap" style={{ gap: 6 }}>
                  {Object.entries(akash.gpuModels).sort((a, b) => b[1] - a[1]).map(([model, count]) => (
                    <span className="badge" key={model}>{model} · {count}</span>
                  ))}
                </div>
              ) : <span className="tiny muted">No GPU model evidence.</span>}
            </div>
          </section>
        </div>
      </div>

      <DataNote>
        Capacity totals sum provider-reported fields from the latest collection. They do not imply
        schedulable capacity, a price, or an SLA. A provider reporting 100 available cores may be
        unable to accept a workload for reasons outside this source. Per-provider values are more
        trustworthy than any cross-provider sum; the sum is shown for inventory context only.
      </DataNote>
    </>
  );
}

function ProviderCapacityRow({ provider }: { provider: CapacityProvider }) {
  return (
    <tr>
      <td>
        <Link href={`/app/providers/${provider.providerId}`} className="cell-title">
          {provider.providerName || provider.externalId.slice(0, 26)}
        </Link>
        <div className="cell-sub">{provider.country ?? provider.region ?? 'location unavailable'}</div>
      </td>
      <td><span className="row" style={{ gap: 6 }}><NetworkDot colour={provider.brandColor} /><span className="tiny">{provider.networkName}</span></span></td>
      <td className="num">
        <span style={{ color: 'var(--green)' }}>{formatNumber(provider.cpuAvailableCores)}</span>
        <span className="muted"> / {formatNumber(provider.cpuTotalCores)}</span>
      </td>
      <td className="num tiny">
        {formatBytes(provider.memoryAvailableBytes)}<span className="muted"> / {formatBytes(provider.memoryTotalBytes)}</span>
      </td>
      <td className="num tiny">{formatBytes(provider.storageAvailableBytes)}</td>
      <td className="num">{provider.gpuAvailable ?? '—'}<span className="muted"> / {provider.gpuTotal ?? '—'}</span></td>
      <td><EvidenceBadge value={provider.evidence} /></td>
      <td className="num">{formatDateTime(provider.observedAt)}</td>
    </tr>
  );
}
