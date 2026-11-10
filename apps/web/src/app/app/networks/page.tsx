import Link from 'next/link';
import { ArrowUpRight, Clock3, Database, Globe2, Radio } from 'lucide-react';
import { apiGet, type NetworkSummary } from '@/lib/api';
import { formatAge, formatDateTime, formatNumber } from '@/lib/format';
import {
  DataNote,
  FreshnessBadge,
  HealthBadge,
  NetworkDot,
  PageHead,
  StatCard,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function NetworksPage() {
  const { data, error } = await apiGet<{ data: NetworkSummary[] }>('/api/v1/networks');
  const networks = data?.data ?? [];

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Networks</strong></>}
        title="Network directory"
        description="Every configured source, its collection state and the limits of what it can prove. Networks are presented by role: compute marketplace, compute network or settlement network."
        meta={
          <>
            <span><Radio size={11} /> {networks.length} configured sources</span>
            <span><Database size={11} /> {formatNumber(networks.reduce((total, network) => total + network.providerCount, 0))} indexed providers</span>
            <span><Clock3 size={11} /> Data captured at request time</span>
          </>
        }
      />

      {error ? <div className="error-banner">The API could not list networks: {error}</div> : null}

      <div className="grid grid-4 mb-24">
        <StatCard label="Sources" value={networks.length} sub="Documented public APIs" icon="radio" />
        <StatCard label="Provider indexes" value={networks.filter((network) => network.providerCount > 0).length} sub="Sources exposing provider records" icon="server" />
        <StatCard label="With capacity" value={networks.filter((network) => network.capacityProviders > 0).length} sub="Reported, not independently measured" icon="database" />
        <StatCard label="Source incidents" value={networks.reduce((total, network) => total + network.activeIncidents, 0)} sub="Active provider incidents" icon="alert" accent={networks.some((network) => network.activeIncidents > 0) ? 'red' : 'green'} />
      </div>

      <div className="stack">
        {networks.map((network) => (
          <section className="panel" key={network.id}>
            <div className="panel-pad">
              <div className="row-between wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div className="row wrap" style={{ gap: 9 }}>
                    <NetworkDot colour={network.brandColor} />
                    <h2 style={{ fontSize: 19, letterSpacing: '-0.02em' }}>{network.name}</h2>
                    <span className="badge">{network.kind.replace(/_/g, ' ')}</span>
                    {network.chainId ? <span className="badge">chain {network.chainId}</span> : null}
                    <HealthBadge value={network.healthState} evidence="source collection" />
                    <FreshnessBadge freshness={network.sourceFreshness} />
                  </div>
                  <p className="tiny mt-8" style={{ maxWidth: 780 }}>{network.healthReason}</p>
                  <div className="row wrap mt-12" style={{ gap: 16 }}>
                    <span className="mono-label">{network.sourceAdapter}</span>
                    <span className="tiny muted">
                      Source: <a href={network.sourceUrl ?? '#'} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
                        {network.sourceUrl?.replace(/^https?:\/\//, '')} <ArrowUpRight size={9} style={{ display: 'inline' }} />
                      </a>
                    </span>
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Link href={`/app/providers?networkId=${network.id}`} className="btn btn-sm">Providers</Link>
                  <Link href={`/app/networks/${network.id}`} className="btn btn-sm btn-primary">Network detail</Link>
                </div>
              </div>

              <div className="metric-grid mt-16">
                <div className="metric-cell">
                  <div className="label">Provider count</div>
                  <div className="value">{network.providerCount ? formatNumber(network.providerCount) : '—'}</div>
                  <div className="detail">{network.providerCount ? 'indexed records' : 'not a provider marketplace'}</div>
                </div>
                <div className="metric-cell">
                  <div className="label">Healthy / degraded</div>
                  <div className="value">{network.providerCount ? `${formatNumber(network.healthCounts.healthy ?? 0)} / ${formatNumber(network.healthCounts.degraded ?? 0)}` : '—'}</div>
                  <div className="detail">source-reported</div>
                </div>
                <div className="metric-cell">
                  <div className="label">Capacity evidence</div>
                  <div className="value" style={{ fontSize: 15 }}>{network.capacityProviders ? `${network.capacityProviders} providers` : 'UNAVAILABLE'}</div>
                  <div className="detail">{network.capacityProviders ? 'provider-reported' : 'source does not expose'}</div>
                </div>
                <div className="metric-cell">
                  <div className="label">Source latency</div>
                  <div className="value">{network.source?.latencyMs ? `${formatNumber(network.source.latencyMs)}ms` : '—'}</div>
                  <div className="detail">API fetch duration</div>
                </div>
                <div className="metric-cell">
                  <div className="label">Monitored endpoints</div>
                  <div className="value">{network.monitoredEndpoints}</div>
                  <div className="detail">{network.healthyEndpoints} up · {network.failedEndpoints} failing</div>
                </div>
                <div className="metric-cell">
                  <div className="label">Active incidents</div>
                  <div className="value" style={{ color: network.activeIncidents ? 'var(--red)' : undefined }}>{network.activeIncidents}</div>
                  <div className="detail">correlated</div>
                </div>
              </div>

              <div className="grid grid-2 mt-16">
                <div>
                  <div className="mono-label mb-8">Supported evidence</div>
                  <ul className="tiny muted" style={{ margin: 0, paddingLeft: 16 }}>
                    {network.supportedMetrics.map((metric) => <li key={metric}>{metric}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="mono-label mb-8">Limitations</div>
                  <ul className="tiny muted" style={{ margin: 0, paddingLeft: 16 }}>
                    {network.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="table-toolbar" style={{ borderBottom: 0 }}>
              <span className="tiny muted">
                Last success: {network.source?.lastSuccessAt ? `${formatAge((Date.now() - new Date(network.source.lastSuccessAt).getTime()) / 1000)} · ${formatDateTime(network.source.lastSuccessAt)}` : 'never'}
                {network.source?.lastError ? ` · Last error: ${network.source.lastError}` : ''}
              </span>
              <div className="row" style={{ gap: 12 }}>
                {network.docsUrl ? (
                  <a href={network.docsUrl} target="_blank" rel="noreferrer" className="tiny muted" style={{ textDecoration: 'underline' }}>
                    Source docs <ArrowUpRight size={9} style={{ display: 'inline' }} />
                  </a>
                ) : null}
                {network.explorerUrl ? (
                  <a href={network.explorerUrl} target="_blank" rel="noreferrer" className="tiny muted" style={{ textDecoration: 'underline' }}>
                    Explorer <Globe2 size={9} style={{ display: 'inline' }} />
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ))}
        {!networks.length && !error ? (
          <div className="panel table-empty">No networks configured. Seed the database to create source definitions.</div>
        ) : null}
      </div>

      <DataNote>
        Network health describes source collection health, not the health of every provider on that
        network. A healthy source can still report thousands of offline providers. No cross-network
        aggregate health score is produced.
      </DataNote>
    </>
  );
}
