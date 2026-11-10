import Link from 'next/link';
import { ArrowUpRight, ChartNoAxesCombined, Clock3, Database, Layers3, Scale } from 'lucide-react';
import { apiGet, type Benchmarks } from '@/lib/api';
import { formatAge, formatDateTime, formatNumber, formatPercent, titleCase } from '@/lib/format';
import {
  Callout,
  DataNote,
  EvidenceBadge,
  FreshnessBadge,
  NetworkDot,
  PageHead,
  StatCard,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

type PercentileSet = {
  p50: number | null;
  p90: number | null;
  p99: number | null;
  samples: number;
};

const WINDOWS: Array<{ key: 'day1' | 'day7' | 'day30'; label: string }> = [
  { key: 'day1', label: '1d' },
  { key: 'day7', label: '7d' },
  { key: 'day30', label: '30d' },
];

export default async function BenchmarksPage() {
  const { data, error } = await apiGet<Benchmarks>('/api/v1/benchmarks');
  if (!data) {
    return (
      <>
        <PageHead title="Benchmarks" description="Comparable observations without a composite score." />
        <div className="error-banner">Benchmarks could not be loaded: {error}</div>
      </>
    );
  }

  const withAvailability = data.networks.filter(
    (network) => network.availabilityPercentiles !== null,
  );
  const coverageRows = data.networks.flatMap((network) =>
    network.coverage.map((item) => ({ ...item, network } as Record<string, unknown> & { network: typeof network })),
  );
  const totalObservations = coverageRows.reduce(
    (total, row) => total + Number(row.observations ?? 0),
    0,
  );

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Benchmarks</strong></>}
        title="Benchmarks and comparability"
        description="Metric distributions grouped by collection method and unit. ComputePulse publishes no universal provider ranking because the underlying evidence is not interchangeable."
        meta={
          <>
            <span><Clock3 size={11} /> Generated {formatDateTime(data.generatedAt)}</span>
            <span><Layers3 size={11} /> {data.networks.length} networks</span>
            <span><Database size={11} /> {formatNumber(totalObservations)} observations in coverage</span>
            <span><Scale size={11} /> {data.comparabilityGroups.length} comparability groups</span>
          </>
        }
      />

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid grid-4">
        <StatCard
          label="Comparability groups"
          value={data.comparabilityGroups.length}
          sub="Only metrics in the same group are compared"
          icon="gauge"
        />
        <StatCard
          label="Networks with availability"
          value={`${withAvailability.length}/${data.networks.length}`}
          sub="Others expose no availability window"
          icon="signal"
          accent={withAvailability.length ? 'green' : 'amber'}
        />
        <StatCard
          label="Capacity-reporting networks"
          value={data.networks.filter((network) => Object.keys(network.capacityEvidence).some((key) => key === 'reported')).length}
          sub="Provider-reported capacity only"
          icon="database"
        />
        <StatCard
          label="Composite score"
          value="NOT CALCULATED"
          sub="By design — incompatible evidence is not summed"
          icon="shield"
          accent="amber"
        />
      </div>

      <Callout tone="warn">
        <strong>No composite provider score.</strong> Availability from Akash, confirmation lag from
        Flux and RPC latency from BOT Chain measure different things. Averaging them into one number
        would create a confident-looking figure with no defensible meaning. Compare inside a group,
        read the caveats, and open the underlying observation.
      </Callout>

      <section className="panel mt-24">
        <div className="panel-head">
          <div>
            <h2>Availability distributions</h2>
            <div className="tiny muted" style={{ marginTop: 3 }}>
              Source-reported windows · percentiles across providers with a value
            </div>
          </div>
          <span className="badge badge-reported">REPORTED</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Network</th>
                <th>Providers</th>
                <th>Coverage</th>
                {WINDOWS.map((window) => (
                  <th key={window.key}>{window.label} p50 / p90 / p99</th>
                ))}
                <th>Samples</th>
                <th>Freshness</th>
              </tr>
            </thead>
            <tbody>
              {data.networks.map((network) => {
                const percentiles = network.availabilityPercentiles as Record<string, PercentileSet> | null;
                return (
                  <tr key={network.id}>
                    <td>
                      <Link href={`/app/networks/${network.id}`} className="row" style={{ gap: 7 }}>
                        <NetworkDot colour={network.brandColor} />
                        <span className="cell-title">{network.name}</span>
                      </Link>
                      <div className="cell-sub">{titleCase(network.kind)}</div>
                    </td>
                    <td className="num">{formatNumber(network.providerCounts.total as number)}</td>
                    <td className="num">
                      {network.providerCounts.availabilityCoverage === null
                        ? <span className="badge badge-unavailable">UNAVAILABLE</span>
                        : formatPercent(network.providerCounts.availabilityCoverage as number)}
                    </td>
                    {WINDOWS.map((window) => {
                      const set = percentiles?.[window.key] ?? null;
                      return (
                        <td className="num tiny" key={`${network.id}-${window.key}`}>
                          {set && set.samples > 0 ? (
                            <>
                              <span style={{ color: 'var(--text)' }}>{formatPercent(set.p50)}</span>
                              <span className="muted"> / {formatPercent(set.p90)} / {formatPercent(set.p99)}</span>
                            </>
                          ) : (
                            <span className="badge badge-unavailable">NO VALUES</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="num tiny muted">
                      {percentiles ? formatNumber(percentiles.day1.samples) : '—'}
                    </td>
                    <td><FreshnessBadge freshness={network.freshness} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-toolbar" style={{ borderBottom: 0 }}>
          <span className="tiny muted">
            Percentiles are computed only from non-null source-reported values. Missing values lower
            the sample count; they are never imputed as zero or as one hundred percent.
          </span>
        </div>
      </section>

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Network metric coverage</h2>
            <span className="mono-label">observed keys</span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Network</th>
                  <th>Metric key</th>
                  <th>Observations</th>
                  <th>First observed</th>
                  <th>Last observed</th>
                </tr>
              </thead>
              <tbody>
                {coverageRows
                  .sort((a, b) => Number(b.observations ?? 0) - Number(a.observations ?? 0))
                  .slice(0, 40)
                  .map((row, index) => (
                    <tr key={`${row.network.id}-${row.metricKey}-${index}`}>
                      <td>
                        <span className="row" style={{ gap: 6 }}>
                          <NetworkDot colour={row.network.brandColor} />
                          <span className="tiny">{row.network.name}</span>
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: 10.5 }}>{String(row.metricKey)}</td>
                      <td className="num">{formatNumber(Number(row.observations ?? 0))}</td>
                      <td className="num tiny muted">{formatDateTime(String(row.firstObserved ?? ''))}</td>
                      <td className="num tiny muted">{formatDateTime(String(row.lastObserved ?? ''))}</td>
                    </tr>
                  ))}
                {!coverageRows.length ? (
                  <tr><td colSpan={5}><div className="table-empty">No observations have been collected.</div></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {coverageRows.length > 40 ? (
            <div className="table-toolbar" style={{ borderBottom: 0 }}>
              <span className="tiny muted">Showing the 40 largest coverage sets of {coverageRows.length}.</span>
            </div>
          ) : null}
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Capacity evidence</h2>
              <ChartNoAxesCombined size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="panel-pad stack-sm">
              {data.networks.map((network) => {
                const entries = Object.entries(network.capacityEvidence);
                return (
                  <div key={network.id}>
                    <div className="row-between">
                      <span className="row" style={{ gap: 6 }}>
                        <NetworkDot colour={network.brandColor} />
                        <span className="tiny">{network.name}</span>
                      </span>
                      <span className="tiny muted">
                        {formatNumber(network.providerCounts.total as number)} providers
                      </span>
                    </div>
                    <div className="row wrap mt-8" style={{ gap: 5 }}>
                      {entries.length ? entries.map(([evidence, count]) => (
                        <span className="badge" key={`${network.id}-${evidence}`}>
                          <EvidenceBadge value={evidence} /> {formatNumber(count)}
                        </span>
                      )) : <span className="badge badge-unavailable">UNAVAILABLE</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="panel-pad" style={{ paddingTop: 0 }}>
              <Link href="/app/capacity" className="link-arrow">Inspect capacity evidence</Link>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Caveats</h2>
              <span className="badge badge-reported">READ FIRST</span>
            </div>
            <div className="panel-pad">
              <ul className="tiny muted" style={{ paddingLeft: 16, margin: 0, lineHeight: 1.85 }}>
                {data.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
              </ul>
            </div>
          </section>
        </div>
      </div>

      <section className="panel mt-24">
        <div className="panel-head">
          <div>
            <h2>Comparability groups</h2>
            <div className="tiny muted" style={{ marginTop: 3 }}>
              A metric is only comparable with another metric in the same group and unit.
            </div>
          </div>
          <span className="mono-label">{data.comparabilityGroups.length} groups</span>
        </div>
        <div className="stack-sm panel-pad">
          {data.comparabilityGroups.map((group) => (
            <div className="panel panel-pad" key={group.group} style={{ background: 'var(--bg)', padding: 14 }}>
              <div className="row-between wrap" style={{ gap: 8 }}>
                <span className="mono" style={{ color: 'var(--cyan)', fontSize: 11 }}>{group.group}</span>
                <span className="tiny muted">{group.definitions.length} metric definition{group.definitions.length === 1 ? '' : 's'}</span>
              </div>
              <div className="table-wrap mt-8">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Name</th>
                      <th>Unit</th>
                      <th>Evidence</th>
                      <th>Direction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.definitions.map((definition) => (
                      <tr key={String(definition.key)}>
                        <td className="mono" style={{ fontSize: 10.5 }}>{String(definition.key)}</td>
                        <td className="tiny">{String(definition.name)}</td>
                        <td className="tiny muted">{String(definition.unit)}</td>
                        <td><EvidenceBadge value={String(definition.evidence_type)} /></td>
                        <td className="tiny muted">{titleCase(String(definition.direction))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tiny muted" style={{ marginTop: 8 }}>{group.note}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-3 mt-24">
        <section className="panel panel-pad">
          <h3>Source latency</h3>
          <p className="tiny muted mt-8">
            <span className="mono">network.source_latency_ms</span> measures the complete source API
            collection request. A large payload inflates it. Compare only within one adapter.
          </p>
        </section>
        <section className="panel panel-pad">
          <h3>Flux confirmation lag</h3>
          <p className="tiny muted mt-8">
            <span className="mono">flux.confirmation_lag_blocks</span> is an ESTIMATED chain-recency
            signal. It is not endpoint health and does not prove a node is reachable.
          </p>
        </section>
        <section className="panel panel-pad">
          <h3>BOT Chain</h3>
          <p className="tiny muted mt-8">
            BOT Chain is a settlement and commitment network. RPC latency and block recency are
            observed; it is not a compute marketplace and exposes no provider capacity.
          </p>
        </section>
      </div>

      <DataNote>
        Download or export is not implemented on this page. Figures are generated from persisted
        observations at request time. A percentile without samples is shown as unavailable rather
        than as an assumption. Generated {formatAge((Date.now() - new Date(data.generatedAt).getTime()) / 1000)}.
      </DataNote>

      <div className="row-between wrap mt-16">
        <span className="tiny muted">
          <ArrowUpRight size={10} style={{ display: 'inline' }} /> Read the{' '}
          <Link href="/metric-methodology" style={{ textDecoration: 'underline' }}>metric methodology</Link>{' '}
          before comparing networks.
        </span>
        <Link href="/app/capacity" className="link-arrow">Capacity evidence</Link>
      </div>
    </>
  );
}
