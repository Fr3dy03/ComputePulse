import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Link2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  Layers3,
  Network,
  Radio,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { apiGet, type Overview } from '@/lib/api';
import { formatAge, formatDateTime, formatNumber } from '@/lib/format';
import {
  Callout,
  DataNote,
  EvidenceBadge,
  FreshnessBadge,
  HealthBadge,
  NetworkDot,
} from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const dynamic = 'force-dynamic';

export default async function CrossNetworkMonitoringPage() {
  const { data, error } = await apiGet<Overview>('/api/v1/overview');

  return (
    <>
      <PageHero
        eyebrow="Cross-network monitoring"
        title="Compare networks without pretending they are the same."
        lede="Akash is a compute marketplace. Flux is a compute network. BOT Chain and Bohr are settlement networks. ComputePulse places them side by side while preserving the method, unit and evidence class behind every signal."
        actions={
          <>
            <Link href="/app/networks" className="btn btn-primary">Open network directory <ArrowRight size={14} /></Link>
            <Link href="/app/benchmarks" className="btn">View benchmarks</Link>
          </>
        }
        meta={
          <>
            <span><Network size={11} /> {data ? `${data.networks.length} configured networks` : 'live source count'}</span>
            <span><ShieldCheck size={11} /> no composite health score</span>
            <span><Clock3 size={11} /> per-source freshness policy</span>
          </>
        }
      />

      <MarketingSection>
        <div className="grid grid-4">
          <div className="stat">
            <div className="stat-label"><Radio size={12} style={{ color: 'var(--cyan)' }} /> Sources observed</div>
            <div className="stat-value">{data?.networks.length ?? '—'}</div>
            <div className="stat-sub">Each with its own adapter contract</div>
          </div>
          <div className="stat">
            <div className="stat-label"><Database size={12} style={{ color: 'var(--cyan)' }} /> Observations</div>
            <div className="stat-value">{data ? formatNumber(data.observations.total, { compact: true }) : '—'}</div>
            <div className="stat-sub">Stored with evidence and provenance</div>
          </div>
          <div className="stat">
            <div className="stat-label"><Gauge size={12} style={{ color: 'var(--cyan)' }} /> Endpoint monitors</div>
            <div className="stat-value">{data ? `${data.monitors.up}/${data.monitors.total}` : '—'}</div>
            <div className="stat-sub">Observed checks, separate from source claims</div>
          </div>
          <div className="stat">
            <div className="stat-label"><CircleAlert size={12} style={{ color: 'var(--amber)' }} /> Active incidents</div>
            <div className="stat-value">{data?.incidents.active ?? '—'}</div>
            <div className="stat-sub">Correlated from persisted evidence</div>
          </div>
        </div>

        {error || !data ? (
          <Callout tone="warn">
            Live network data is unavailable ({error ?? 'no response'}). This page does not display
            placeholder network rows.
          </Callout>
        ) : (
          <div className="panel mt-24">
            <div className="panel-head">
              <h2>Live source status</h2>
              <span className="mono-label">generated {formatDateTime(data.generatedAt)}</span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Network</th>
                    <th>Type</th>
                    <th>Collection</th>
                    <th>Freshness</th>
                    <th>Providers</th>
                    <th>Source latency</th>
                    <th>Capacity evidence</th>
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
                      <td className="tiny">{network.kind.replace(/_/g, ' ')}</td>
                      <td><HealthBadge value={network.healthState} evidence="source collection" /></td>
                      <td><FreshnessBadge freshness={network.sourceFreshness} /></td>
                      <td className="num">
                        {network.providerCount ? formatNumber(network.providerCount) : <span className="muted">—</span>}
                      </td>
                      <td className="num">
                        {network.source?.latencyMs ? `${formatNumber(network.source.latencyMs)} ms` : '—'}
                      </td>
                      <td className="tiny">
                        {network.capacityProviders
                          ? `${network.capacityProviders} providers`
                          : <span className="badge badge-unavailable">UNAVAILABLE</span>}
                      </td>
                      <td className="num">
                        {network.activeIncidents
                          ? <span className="badge badge-down">{network.activeIncidents}</span>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-toolbar" style={{ borderBottom: 0 }}>
              <span className="tiny muted">
                Source latency is the complete API fetch duration. It is not provider, node or
                validator latency.
              </span>
              <Link href="/app/benchmarks" className="link-arrow">Coverage detail</Link>
            </div>
          </div>
        )}
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Comparability</div>
            <h2 style={{ marginTop: 12 }}>What can actually be compared.</h2>
            <p style={{ marginTop: 12, maxWidth: 720 }}>
              ComputePulse defines comparability groups in the database. A metric belongs to exactly
              one group and unit. Percentiles and rankings are only produced inside a group.
            </p>
          </div>
          <Link href="/metric-methodology" className="link-arrow">Methodology</Link>
        </div>
        <div className="grid grid-2">
          {[
            {
              group: 'source_collection_latency',
              title: 'Source collection latency',
              body: 'The duration of a complete adapter request. Akash returns ~1,900 providers; Flux returns ~6,900 nodes, so payload size dominates. Compare only within one adapter and method.',
              icon: <Clock3 size={16} />,
            },
            {
              group: 'reported_capacity',
              title: 'Reported capacity',
              body: 'CPU, memory, storage and GPU fields reported by Akash. These are inventory claims, not schedulable capacity. Flux does not expose capacity, so no comparison exists.',
              icon: <Database size={16} />,
            },
            {
              group: 'chain_rpc_latency',
              title: 'Chain RPC latency',
              body: 'Observed latency for the BOT Chain and Bohr JSON-RPC calls. It describes the RPC endpoint response, not validator performance or network finality.',
              icon: <Waypoints size={16} />,
            },
            {
              group: 'provider_availability',
              title: 'Provider availability',
              body: 'Akash source-reported 1d/7d/30d uptime windows. Flux has no liveness field, so its availability is UNAVAILABLE rather than zero or assumed 100%.',
              icon: <Gauge size={16} />,
            },
          ].map((item) => (
            <div className="feature-card" key={item.group}>
              <div className="row-between">
                <div className="icon-box">{item.icon}</div>
                <span className="mono" style={{ fontSize: 10, color: 'var(--cyan)' }}>{item.group}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
        <div className="callout warn mt-24">
          <strong>No universal network health percentage.</strong> A single number would require
          weighting incompatible evidence: an Akash uptime ratio, a Flux chain-recency estimate and a
          BOT RPC duration. The weights would be arbitrary and the result would be indefensible.
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid split-2-1" style={{ alignItems: 'start' }}>
          <div>
            <div className="eyebrow">Freshness</div>
            <h2 style={{ marginTop: 12 }}>Every network has its own clock.</h2>
            <p style={{ marginTop: 12, maxWidth: 650 }}>
              Collection intervals differ because source behaviour differs. Akash is collected every
              five minutes and considered stale after fifteen. Flux is collected every ten minutes and
              considered stale after thirty. BOT Chain and Bohr are collected every minute and
              considered stale after five. Operators can read the exact policy in Settings and on each
              network.
            </p>
            <div className="grid grid-2 mt-24">
              {[
                ['Fresh', 'Inside the expected interval. The value can be read as current.'],
                ['Delayed', 'Later than expected, but still inside the stale threshold.'],
                ['Stale', 'Beyond the source policy. The last value is historical, not current.'],
                ['Unavailable', 'No observation exists. Gaps stay gaps.'],
              ].map(([state, body]) => (
                <div className="panel panel-pad" key={state} style={{ background: 'var(--bg)' }}>
                  <strong style={{ fontSize: 12 }}>{state}</strong>
                  <p className="tiny" style={{ marginTop: 7 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2>What we collect</h2>
                <Layers3 size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad stack-sm">
                {[
                  ['Akash', 'Provider identity, online flag, uptime windows, capacity fields, GPU models, source age.'],
                  ['Flux', 'Node identity, collateral address, last confirmed height, chain head, derived confirmation lag.'],
                  ['BOT Chain', 'Chain ID, block height, block age, RPC latency, commitment and registry state when configured.'],
                  ['Bohr', 'Testnet chain ID, block height, block age and RPC latency.'],
                ].map(([network, body]) => (
                  <div key={network}>
                    <div className="mono-label">{network}</div>
                    <p className="tiny" style={{ marginTop: 4 }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <Callout>
              <strong>Read the limitations.</strong> Public source data can change shape, rate-limit or
              disappear. ComputePulse records the error and marks the source unhealthy; it does not
              substitute the previous response as current.
            </Callout>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Incident correlation</div>
            <h2 style={{ marginTop: 12 }}>One outage, one traceable incident.</h2>
            <p style={{ marginTop: 12, maxWidth: 700 }}>
              A source-reported offline provider can become a correlated incident with a source
              reference, observation time and commitment hash. The lifecycle is explicit: open,
              acknowledge, investigate, mitigate, resolve, close.
            </p>
          </div>
          <Link href="/app/incidents" className="link-arrow">Open incident register</Link>
        </div>
        <div className="grid grid-3">
          {[
            {
              icon: <Radio size={16} />,
              title: 'Correlated, not invented',
              body: 'The seeded incident is created from an actually offline Akash provider in a real collection — not from a demo fixture with invented timestamps.',
            },
            {
              icon: <Link2 size={16} />,
              title: 'Commitment optional',
              body: 'Incident summaries and remediation digests can be anchored on BOT Chain through a role-controlled registry. No funds, tokens or slashing are involved.',
            },
            {
              icon: <ArrowUpRight size={16} />,
              title: 'Inspectable end to end',
              body: 'Every incident shows its source, observation time, events and affected network/provider. Operators can add remediation notes that are themselves audited.',
            },
          ].map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="icon-box">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid grid-2">
          <div>
            <div className="eyebrow">Method notes</div>
            <h2 style={{ marginTop: 12 }}>Signals that look similar but are not.</h2>
            <ul className="prose" style={{ paddingLeft: 18 }}>
              <li><strong>Source latency vs provider latency.</strong> A 1.6 s Akash or Flux fetch is the API request duration. A provider endpoint has not been contacted.</li>
              <li><strong>Online vs healthy.</strong> A source can mark a provider online while its own uptime field is low. The interface shows the reported state and window separately.</li>
              <li><strong>Block height vs finality.</strong> A rising block height proves the RPC answered. It does not prove the chain is final or that a specific transaction is safe.</li>
              <li><strong>Capacity vs schedulability.</strong> Reported free cores do not guarantee that a workload will be accepted, priced or kept running.</li>
            </ul>
          </div>
          <div className="panel panel-pad">
            <div className="mono-label mb-12">Evidence at a glance</div>
            <div className="stack-sm">
              {[
                ['Provider online state', 'reported'],
                ['Provider uptime window', 'reported'],
                ['Provider capacity fields', 'reported'],
                ['Flux confirmation lag', 'estimated'],
                ['Chain RPC latency', 'observed'],
                ['Chain block height', 'observed'],
                ['Endpoint monitor latency', 'observed'],
                ['Flux liveness', 'unavailable'],
              ].map(([label, state]) => (
                <div className="row-between" key={label}>
                  <span className="tiny">{label}</span>
                  <EvidenceBadge value={state} />
                </div>
              ))}
            </div>
            <Link href="/metric-methodology" className="link-arrow mt-16">Full metric catalogue</Link>
          </div>
        </div>
        <DataNote>
          Live rows above are generated from stored observations at request time. {data ? `The latest overview covered ${formatNumber(data.observations.total)} observations and was generated ${formatAge((Date.now() - new Date(data.generatedAt).getTime()) / 1000)}.` : 'No live overview was returned.'}
        </DataNote>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Cross-network view</div>
          <h2 style={{ margin: '16px 0 18px' }}>Open the evidence, not a leaderboard.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            Browse network collection health, inspect a provider&apos;s provenance, or compare
            distributions inside a documented group.
          </p>
          <div className="btn-row">
            <Link href="/app/networks" className="btn btn-primary">View Network Status <ArrowRight size={14} /></Link>
            <Link href="/app/benchmarks" className="btn">Open benchmarks</Link>
          </div>
        </div>
      </section>
    </>
  );
}
