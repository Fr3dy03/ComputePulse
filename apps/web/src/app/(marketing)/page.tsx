import Link from 'next/link';
import {
  ArrowRight,
  Activity,
  Boxes,
  ChartNoAxesCombined,
  CircleCheck,
  CloudCog,
  Database,
  FileSearch,
  Fingerprint,
  Gauge,
  GitBranch,
  Layers3,
  LockKeyhole,
  Network,
  Radio,
  ScrollText,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { apiGet, type Overview, type ProviderListItem } from '@/lib/api';
import { formatAge, formatNumber, formatPercent } from '@/lib/format';
import {
  AvailabilityValue,
  Callout,
  DataNote,
  EvidenceBadge,
  FreshnessBadge,
  HealthBadge,
  LiveLabel,
  NetworkDot,
  SectionHead,
  StatCard,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [overviewResponse, providersResponse] = await Promise.all([
    apiGet<Overview>('/api/v1/overview'),
    apiGet<{ data: ProviderListItem[]; meta: Record<string, unknown> }>(
      '/api/v1/providers?pageSize=4&health=healthy&sort=name',
    ),
  ]);
  const overview = overviewResponse.data;
  const providers = providersResponse.data?.data ?? [];

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">Cross-network provider observability</div>
              <h1>
                See the infrastructure behind decentralised compute.
              </h1>
              <p className="lede">
                Monitor provider health, compare network signals and investigate infrastructure
                incidents through one transparent operations view.
              </p>
              <div className="hero-actions">
                <Link href="/app/monitors/new" className="btn btn-primary">
                  Connect a Provider <ArrowRight size={14} />
                </Link>
                <Link href="/app" className="btn">
                  View Network Status
                </Link>
              </div>
              <div className="hero-meta">
                <span><span className="status-dot live" /> live collection</span>
                <span><ShieldCheck size={11} /> evidence-labelled</span>
                <span><LockKeyhole size={11} /> no fabricated metrics</span>
              </div>
            </div>

            <div className="hero-console" aria-label="Live source summary">
              <div className="console-bar">
                <div className="dots"><i /><i /><i /></div>
                <span className="title">operations / source summary</span>
                <span style={{ marginLeft: 'auto' }}>
                  <FreshnessBadge
                    freshness={
                      overview
                        ? { state: 'fresh', ageSeconds: Math.max(0, (Date.now() - new Date(overview.generatedAt).getTime()) / 1000), message: 'Overview snapshot generated just now.' }
                        : null
                    }
                  />
                </span>
              </div>
              <div className="console-body">
                <div className="console-section-label">
                  <span>Observed networks</span>
                  <span>{overview ? `${overview.networks.length} sources` : 'API unavailable'}</span>
                </div>
                {overview ? (
                  overview.networks.map((network) => (
                    <div className="console-network" key={network.id}>
                      <div className="top">
                        <span className="name">
                          <NetworkDot colour={network.brandColor} />
                          {network.name}
                        </span>
                        <span className="signal">
                          {network.providerCount > 0
                            ? `${formatNumber(network.providerCount)} providers`
                            : 'chain signals'}
                        </span>
                      </div>
                      <div className="row-between" style={{ marginTop: 7 }}>
                        <span className="mono" style={{ fontSize: 9.5, color: 'var(--secondary)' }}>
                          {network.healthState === 'healthy' ? 'source collection healthy' : network.healthState}
                          {' · '}{network.sourceFreshness.state}
                        </span>
                        <span className="mono" style={{ fontSize: 9.5 }}>
                          {network.source?.latencyMs ? `${network.source.latencyMs}ms` : '—'}
                        </span>
                      </div>
                      <div className="bar">
                        <span
                          style={{
                            width: network.providerCount
                              ? `${Math.max(4, Math.min(100, ((network.healthCounts.healthy ?? 0) + (network.healthCounts.degraded ?? 0)) / Math.max(1, network.providerCount) * 100))}%`
                              : '100%',
                            background: network.brandColor,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="callout warn">
                    The ComputePulse API is unreachable. This console does not display cached or
                    fabricated source values. Start the API and reload.
                  </div>
                )}
                <div className="console-foot">
                  <span>{overview ? `${formatNumber(overview.observations.total)} observations` : '— observations'}</span>
                  <span>{overview ? `${overview.monitors.up}/${overview.monitors.total} endpoint monitors up` : '— monitors'}</span>
                  <span>{overview ? `${overview.incidents.active} active incidents` : '— incidents'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="logo-row">
            <span className="label">Verified live sources</span>
            <span className="logo-item"><NetworkDot colour="#42B8C5" /> Akash Console API</span>
            <span className="logo-item"><NetworkDot colour="#4D8CC8" /> Flux daemon</span>
            <span className="logo-item"><NetworkDot colour="#10A37F" /> BOT Chain RPC</span>
            <span className="logo-item"><NetworkDot colour="#D9A34C" /> Bohr testnet RPC</span>
            <span className="logo-item" style={{ opacity: 0.55 }}>Vast.ai — rejected: auth required</span>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 56 }}>
        <div className="container">
          <div className="grid grid-4">
            <StatCard
              label="Indexed providers"
              value={overview ? formatNumber(overview.providerCounts.total) : '—'}
              sub={overview ? `${formatNumber(overview.providerCounts.healthy)} source-reported healthy` : 'API unavailable'}
              icon="server"
            />
            <StatCard
              label="Observed networks"
              value={overview?.networks.length ?? '—'}
              sub="Each source keeps its own evidence contract"
              icon="radio"
            />
            <StatCard
              label="Observations stored"
              value={overview ? formatNumber(overview.observations.total, { compact: true }) : '—'}
              sub={overview ? `${formatNumber(overview.observations.last24h)} in the last 24h` : '—'}
              icon="database"
            />
            <StatCard
              label="Endpoint monitors"
              value={overview ? `${overview.monitors.up}/${overview.monitors.total}` : '—'}
              sub={overview?.monitors.availability24h !== null && overview?.monitors.availability24h !== undefined
                ? `${formatPercent(overview.monitors.availability24h)} 24h observed availability`
                : 'Checks pending'}
              icon="gauge"
              accent={overview && overview.monitors.down > 0 ? 'amber' : 'green'}
            />
          </div>

          <div className="grid grid-3 mt-24">
            {[
              {
                icon: <Fingerprint size={16} />,
                title: 'Provenance on every row',
                body: 'Source endpoint, adapter version, observation time, measurement window, collection method and freshness are attached to the record, not buried in documentation.',
              },
              {
                icon: <Layers3 size={16} />,
                title: 'Evidence before aggregation',
                body: 'OBSERVED, REPORTED, ESTIMATED, UNAVAILABLE and STALE are separate states. Incompatible sources are never blended into a universal health score.',
              },
              {
                icon: <FileSearch size={16} />,
                title: 'Gaps stay visible',
                body: 'Missing observations render as gaps and coverage percentages. They are never backfilled with zero, an average, or a synthetic green state.',
              },
            ].map((item) => (
              <div className="feature-card" key={item.title}>
                <div className="icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow="The operations question"
            title="Four signals, four different truths."
            description="A provider index can report that a node is online without measuring its endpoint. A chain RPC can answer quickly without proving validator health. ComputePulse keeps those claims distinct."
            action={<Link href="/platform" className="link-arrow">Explore the platform</Link>}
          />
          <div className="bento">
            <div className="feature-card half">
              <div className="row-between">
                <div className="icon-box"><Activity size={16} /></div>
                <EvidenceBadge value="observed" />
              </div>
              <h3>Endpoint responsiveness</h3>
              <p>
                Opt-in HTTP or JSON-RPC checks record status code, latency, attempt count and error
                text at a specific timestamp. These are direct observations, not source claims.
              </p>
              <div className="evidence-row">
                <span className="badge badge-observed">OBSERVED</span>
                <span className="badge">per-endpoint</span>
                <span className="badge">latency ms</span>
              </div>
            </div>
            <div className="feature-card half">
              <div className="row-between">
                <div className="icon-box"><Waypoints size={16} /></div>
                <EvidenceBadge value="reported" />
              </div>
              <h3>Source-reported provider state</h3>
              <p>
                Akash exposes online state and 1d/7d/30d uptime through its Console index. We store
                those values exactly as reported and label the method — never as an independent probe.
              </p>
              <div className="evidence-row">
                <span className="badge badge-reported">REPORTED</span>
                <span className="badge">source window</span>
                <span className="badge">not probed</span>
              </div>
            </div>
            <div className="feature-card half">
              <div className="row-between">
                <div className="icon-box"><Gauge size={16} /></div>
                <EvidenceBadge value="reported" />
              </div>
              <h3>Capacity with an honesty boundary</h3>
              <p>
                Akash reports CPU, memory, storage and GPU totals and availability. Flux does not
                expose capacity in its node list, so Flux capacity is UNAVAILABLE, not estimated.
              </p>
              <div className="evidence-row">
                <span className="badge badge-reported">REPORTED</span>
                <span className="badge badge-unavailable">UNAVAILABLE</span>
              </div>
            </div>
            <div className="feature-card half">
              <div className="row-between">
                <div className="icon-box"><ShieldCheck size={16} /></div>
                <EvidenceBadge value="estimated" />
              </div>
              <h3>Incidents and commitments</h3>
              <p>
                Incidents are correlated from observed source state, carry a complete event log and
                can be hashed into a signed commitment. The contract records facts — it does not
                custody funds or mint tokens.
              </p>
              <div className="evidence-row">
                <span className="badge badge-estimated">ESTIMATED onset</span>
                <span className="badge badge-observed">event log</span>
                <span className="badge">BOT Chain</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow="Live network status"
            title="The networks currently under observation."
            description="Every value below comes from a scheduled collection of a documented public source. Source latency is API responsiveness, not provider latency."
            action={<Link href="/app/networks" className="link-arrow">Open network directory</Link>}
          />
          {overview ? (
            <div className="grid grid-2">
              {overview.networks.map((network) => (
                <div className="panel panel-pad" key={network.id}>
                  <div className="row-between wrap" style={{ marginBottom: 12 }}>
                    <div className="row" style={{ gap: 9 }}>
                      <NetworkDot colour={network.brandColor} />
                      <h3 style={{ fontSize: 16 }}>{network.name}</h3>
                      <span className="badge">{network.kind.replace(/_/g, ' ')}</span>
                    </div>
                    <FreshnessBadge freshness={network.sourceFreshness} />
                  </div>
                  <div className="metric-grid" style={{ marginBottom: 14 }}>
                    <div className="metric-cell">
                      <div className="label">Providers</div>
                      <div className="value">{network.providerCount ? formatNumber(network.providerCount) : '—'}</div>
                      <div className="detail">{network.providerCount ? 'indexed' : 'not a provider market'}</div>
                    </div>
                    <div className="metric-cell">
                      <div className="label">Source latency</div>
                      <div className="value">{network.source?.latencyMs ? `${formatNumber(network.source.latencyMs)}ms` : '—'}</div>
                      <div className="detail">API fetch</div>
                    </div>
                    <div className="metric-cell">
                      <div className="label">Capacity evidence</div>
                      <div className="value" style={{ fontSize: 14 }}>
                        {network.capacityProviders ? `${network.capacityProviders} providers` : 'UNAVAILABLE'}
                      </div>
                      <div className="detail">{network.capacityProviders ? 'provider-reported' : 'not exposed by source'}</div>
                    </div>
                  </div>
                  <p className="tiny" style={{ minHeight: 40 }}>{network.healthReason}</p>
                  <div className="row-between" style={{ marginTop: 12 }}>
                    <Link href={`/app/networks/${network.id}`} className="link-arrow">Network detail</Link>
                    <span className="mono-label">
                      {network.activeIncidents} active incident{network.activeIncidents === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Callout tone="warn">
              Live network data is unavailable because the API could not be reached. No placeholder
              metrics are shown.
            </Callout>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow="Signature table"
            title="Provider rows that explain themselves."
            description="Provider, network, health, latency, availability window, capacity, freshness and active incident — with a provenance drawer one click away."
            action={<Link href="/app/providers" className="link-arrow">Browse all {overview ? formatNumber(overview.providerCounts.total) : ''} providers</Link>}
          />
          <div className="panel">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Network</th>
                    <th>Health</th>
                    <th>Latency</th>
                    <th>Availability window</th>
                    <th>Capacity</th>
                    <th>Freshness</th>
                    <th>Incident</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((provider) => (
                    <tr key={provider.id}>
                      <td>
                        <Link href={`/app/providers/${provider.id}`} className="cell-title">
                          {provider.name || provider.hostReference?.replace(/^https?:\/\//, '') || provider.externalId}
                        </Link>
                        <div className="cell-sub mono">{provider.region || provider.country || 'location unavailable'}</div>
                      </td>
                      <td><span className="row" style={{ gap: 7 }}><NetworkDot colour={provider.brandColor} />{provider.networkName}</span></td>
                      <td><HealthBadge value={provider.healthState} evidence={provider.healthSignal} /></td>
                      <td className="num">{provider.sourceLatencyMs ? `${formatNumber(provider.sourceLatencyMs)} ms` : '—'}<div className="cell-sub">source</div></td>
                      <td><AvailabilityValue value={provider.availability1d} window="24h" /></td>
                      <td className="tiny">{provider.capacityEvidence === 'reported' ? 'reporting' : <span className="badge badge-unavailable">UNAVAILABLE</span>}</td>
                      <td><FreshnessBadge freshness={provider.freshness} /></td>
                      <td className="tiny">{provider.activeIncidents ? <span className="badge badge-down">{provider.activeIncidents}</span> : '—'}</td>
                    </tr>
                  ))}
                  {!providers.length ? (
                    <tr><td colSpan={8}><div className="table-empty">No live provider rows are available. The API may be offline.</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="table-toolbar" style={{ borderBottom: 0 }}>
              <span className="tiny muted">
                Source-reported health is explicitly not endpoint health. Latency shown is source API
                fetch time; no provider endpoint was probed.
              </span>
              <Link href="/metric-methodology" className="link-arrow">Read the method</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid split-2-1" style={{ alignItems: 'start' }}>
            <div>
              <SectionHead
                eyebrow="From signal to investigation"
                title="Built for the full incident loop."
                description="Collect, compare, investigate, record and resolve. Each step stays tied to the evidence that supports it."
              />
              <div className="stack-sm">
                {[
                  ['01', 'Collect from documented sources', 'Scheduled adapters pull provider indexes and chain state. Each run records source latency, provider counts, observation writes and errors.'],
                  ['02', 'Compare without blending', 'Provider health, endpoint checks, reported capacity and chain signals stay in separate comparability groups.'],
                  ['03', 'Investigate with provenance', 'Open a provider or incident to see source endpoint, observation time, method, freshness and every lifecycle event.'],
                  ['04', 'Resolve and commit', 'Operator remediation is hashed with the incident summary and timeline. Optional anchoring records the commitment on BOT Chain.'],
                ].map(([number, title, body]) => (
                  <div className="feature" key={number}>
                    <div className="feature-num">{number}</div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel panel-pad">
              <LiveLabel>Latest incident</LiveLabel>
              {overview?.latestIncidents?.[0] ? (
                <div className="mt-16">
                  <h3 style={{ marginBottom: 8 }}>{overview.latestIncidents[0].title}</h3>
                  <p className="tiny" style={{ marginBottom: 14 }}>{overview.latestIncidents[0].summary}</p>
                  <dl className="kv">
                    <dt>Network</dt><dd>{overview.latestIncidents[0].network_name ?? '—'}</dd>
                    <dt>Severity</dt><dd>{overview.latestIncidents[0].severity}</dd>
                    <dt>Status</dt><dd>{overview.latestIncidents[0].status}</dd>
                    <dt>Detected</dt><dd>{formatAge((Date.now() - new Date(overview.latestIncidents[0].detected_at).getTime()) / 1000)}</dd>
                    <dt>Source</dt><dd className="mono">{overview.latestIncidents[0].source}</dd>
                  </dl>
                  <Link href={`/app/incidents/${overview.latestIncidents[0].id}`} className="btn btn-sm mt-16">
                    Open incident <ArrowRight size={12} />
                  </Link>
                </div>
              ) : (
                <p className="mt-16">No correlated incident is currently recorded.</p>
              )}
              <hr />
              <div className="mono-label mb-8">Evidence mix</div>
              {overview?.evidenceMix?.map((item) => (
                <div className="bar-item" key={item.evidence}>
                  <div className="bar-top">
                    <span>{item.evidence.toUpperCase()}</span>
                    <span className="mono">{formatNumber(item.count)}</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${item.evidence === 'observed' ? 'green' : item.evidence === 'reported' ? 'blue' : item.evidence === 'estimated' ? 'amber' : ''}`}
                      style={{ width: `${Math.min(100, (item.count / Math.max(1, overview.observations.total)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DataNote>
            Aggregate counts above describe stored observations, not a service-level score. Read the
            source limitations before comparing networks.
          </DataNote>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid grid-3">
            <div className="feature-card">
              <div className="icon-box"><GitBranch size={16} /></div>
              <h3>Public API and OpenAPI</h3>
              <p>Read routes expose providers, histories, capacities, monitors, incidents and reports. OpenAPI is served at <code>/api/v1/openapi.json</code>.</p>
              <Link href="/documentation" className="link-arrow" style={{ marginTop: 14 }}>API reference</Link>
            </div>
            <div className="feature-card">
              <div className="icon-box"><ChartNoAxesCombined size={16} /></div>
              <h3>Prometheus and OpenTelemetry</h3>
              <p>Scrape <code>/metrics</code> for collection, monitor and evidence counters. OTLP trace export is opt-in through environment configuration.</p>
              <Link href="/integrations" className="link-arrow" style={{ marginTop: 14 }}>Integration details</Link>
            </div>
            <div className="feature-card">
              <div className="icon-box"><ScrollText size={16} /></div>
              <h3>Incident registry</h3>
              <p>A role-controlled Solidity registry stores incident commitments, status history and remediation digests. No tokens, slashing or escrow.</p>
              <Link href="/network-operators" className="link-arrow" style={{ marginTop: 14 }}>Operator model</Link>
            </div>
          </div>

          <div className="callout mt-24">
            <div className="row wrap" style={{ gap: 18 }}>
              <div className="row" style={{ gap: 8 }}><CircleCheck size={14} style={{ color: 'var(--green)' }} /> Real source data</div>
              <div className="row" style={{ gap: 8 }}><CircleCheck size={14} style={{ color: 'var(--green)' }} /> Stale detection</div>
              <div className="row" style={{ gap: 8 }}><CircleCheck size={14} style={{ color: 'var(--green)' }} /> Incident lifecycle</div>
              <div className="row" style={{ gap: 8 }}><CircleCheck size={14} style={{ color: 'var(--green)' }} /> No fabricated network values</div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Start with evidence</div>
          <h2 style={{ margin: '16px 0 18px' }}>Connect a provider endpoint. Keep the source honest.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            Create an explicit monitor for an endpoint you control or operate, or explore the live
            cross-network view first. Every check is timestamped, SSRF-validated and stored as an
            observation.
          </p>
          <div className="btn-row">
            <Link href="/app/monitors/new" className="btn btn-primary">Connect a Provider <ArrowRight size={14} /></Link>
            <Link href="/app" className="btn">View Network Status</Link>
          </div>
          <div className="hero-meta">
            <span><CloudCog size={11} /> 4 verified live sources</span>
            <span><Database size={11} /> PGlite / PostgreSQL</span>
            <span><Boxes size={11} /> Built on BOT Chain</span>
          </div>
        </div>
      </section>
    </>
  );
}
