import Link from 'next/link';
import {
  ArrowRight,
  Clock3,
  Database,
  Eye,
  Fingerprint,
  Gauge,
  Layers3,
  Radio,
  ScanSearch,
  Server,
  ShieldAlert,
} from 'lucide-react';
import { apiGet, type ProviderListItem } from '@/lib/api';
import { formatAge, formatNumber, formatPercent } from '@/lib/format';
import {
  AvailabilityValue,
  Callout,
  DataNote,
  EvidenceBadge,
  FreshnessBadge,
  HealthBadge,
  NetworkDot,
} from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  ['Provider', 'Identity from the source. Akash uses a provider address; Flux uses a node collateral address. Host references are shown as references only — ComputePulse does not mass-probe them.'],
  ['Network', 'The configured source network and its brand marker. Cross-network rows keep the same columns, but the underlying methods differ.'],
  ['Health', 'Source-reported state or UNKNOWN. Flux exposes no liveness flag in its public list, so Flux health is never inferred from confirmation lag.'],
  ['Latency', 'For provider rows this is the source API request duration that produced the record. It is not provider endpoint latency. Direct endpoint latency only exists for operator-created monitors.'],
  ['Availability window', 'The source-reported 24h/7d/30d uptime window. Akash exposes these; Flux does not. Missing values are shown as a dash, not as 100%.'],
  ['Capacity information', 'Provider-reported CPU, memory, storage and GPU fields. Totals never imply schedulable capacity. Flux capacity is UNAVAILABLE because the source does not include it.'],
  ['Observation freshness', 'Age since the last successful observation, evaluated against the source-specific stale threshold. FRESH, DELAYED, STALE, PENDING and UNAVAILABLE are distinct.'],
  ['Active incident', 'Count of open incidents linked to the provider. A zero is shown only after the incident table was queried; it is not a promise that no incident exists elsewhere.'],
];

export default async function ProviderObservabilityPage() {
  const { data } = await apiGet<{ data: ProviderListItem[] }>(
    '/api/v1/providers?pageSize=5&sort=name',
  );
  const providers = data?.data ?? [];

  return (
    <>
      <PageHero
        eyebrow="Provider observability"
        title="Every provider row explains where it came from."
        lede="Provider observability is not a list of green dots. It is the discipline of separating what a source claims, what ComputePulse measured, what was derived, and what simply is not available."
        actions={
          <>
            <Link href="/app/providers" className="btn btn-primary">Open provider directory <ArrowRight size={14} /></Link>
            <Link href="/metric-methodology" className="btn">Read the methodology</Link>
          </>
        }
        meta={
          <>
            <span><Eye size={11} /> provenance on every row</span>
            <span><ShieldAlert size={11} /> source claims are not probes</span>
            <span><Clock3 size={11} /> freshness is explicit</span>
          </>
        }
      />

      <MarketingSection>
        <div className="grid grid-3">
          {[
            {
              icon: <Radio size={16} />,
              title: 'Source-reported',
              badge: 'reported',
              body: 'Akash exposes provider online state and uptime windows through its Console index. ComputePulse stores those values exactly as reported and labels them REPORTED. It does not call them observed availability.',
            },
            {
              icon: <ScanSearch size={16} />,
              title: 'Directly observed',
              badge: 'observed',
              body: 'An operator can create an HTTP or JSON-RPC monitor for an endpoint they control or are authorised to test. The resulting status code and latency are OBSERVED evidence with a precise timestamp.',
            },
            {
              icon: <Gauge size={16} />,
              title: 'Derived with a method',
              badge: 'estimated',
              body: 'Flux confirmation lag is calculated from the node last-confirmed height and the current chain head. It describes chain recency, not node reachability, and is labelled ESTIMATED.',
            },
          ].map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="row-between">
                <div className="icon-box">{item.icon}</div>
                <EvidenceBadge value={item.badge} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Signature table</div>
            <h2 style={{ marginTop: 12 }}>Eight columns. No implicit claims.</h2>
            <p style={{ marginTop: 12, maxWidth: 720 }}>
              The provider table is the product&apos;s core surface. Each column answers a different
              question, and the provenance drawer exposes the source record behind it.
            </p>
          </div>
          <Link href="/compute-providers" className="link-arrow">Use the live table</Link>
        </div>
        <div className="stack-sm">
          {COLUMNS.map(([column, description], index) => (
            <div className="feature" key={column}>
              <div className="feature-num">{String(index + 1).padStart(2, '0')}</div>
              <div>
                <h3>{column}</h3>
                <p style={{ marginTop: 7, maxWidth: 850 }}>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="section-head">
          <div>
            <div className="eyebrow">Live rows</div>
            <h2 style={{ marginTop: 12 }}>The table as it renders against real data.</h2>
            <p style={{ marginTop: 12 }}>
              These rows come from the running collector. If the API is unreachable, the table shows
              an explicit empty state rather than sample data.
            </p>
          </div>
          <Link href="/app/providers" className="link-arrow">All providers</Link>
        </div>
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
                  <th>Capacity information</th>
                  <th>Observation freshness</th>
                  <th>Active incident</th>
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
                    <td>
                      <span className="row" style={{ gap: 7 }}>
                        <NetworkDot colour={provider.brandColor} />
                        {provider.networkName}
                      </span>
                    </td>
                    <td><HealthBadge value={provider.healthState} evidence={provider.healthSignal} /></td>
                    <td className="num">
                      {provider.sourceLatencyMs ? `${formatNumber(provider.sourceLatencyMs)} ms` : '—'}
                      <div className="cell-sub">source API</div>
                    </td>
                    <td><AvailabilityValue value={provider.availability1d} window="24h" /></td>
                    <td className="tiny">
                      {provider.capacityEvidence === 'reported'
                        ? `${provider.capacity?.cpuTotalCores ? `${formatNumber(provider.capacity.cpuTotalCores)} cores` : 'reported'}`
                        : <span className="badge badge-unavailable">UNAVAILABLE</span>}
                    </td>
                    <td><FreshnessBadge freshness={provider.freshness} /></td>
                    <td className="tiny">
                      {provider.activeIncidents
                        ? <span className="badge badge-down">{provider.activeIncidents}</span>
                        : '—'}
                    </td>
                  </tr>
                ))}
                {!providers.length ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="table-empty">
                        Provider rows are unavailable because no live API response was returned.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="table-toolbar" style={{ borderBottom: 0 }}>
            <span className="tiny muted">
              Source latency is the collection request duration, not provider endpoint latency.
              Availability is the source-reported window where present.
            </span>
            <Link href="/metric-methodology" className="link-arrow">Method</Link>
          </div>
        </div>
        <DataNote>
          A Flux row will show health UNKNOWN and capacity UNAVAILABLE because the public node list
          does not expose liveness or capacity. That is the honest representation, not a collection
          defect.
        </DataNote>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="grid split-2-1" style={{ alignItems: 'start' }}>
          <div>
            <div className="eyebrow">Provenance</div>
            <h2 style={{ marginTop: 12 }}>What the drawer shows.</h2>
            <p style={{ marginTop: 12, maxWidth: 650 }}>
              Selecting a provider opens a provenance panel with the fields needed to audit the row:
              source endpoint, adapter version, observation time, collection time, health signal,
              availability method, capacity evidence, freshness policy and the raw metric snapshot.
            </p>
            <div className="grid grid-2 mt-24">
              {[
                ['Adapter version', 'Identifies the exact parsing contract that produced the record.'],
                ['Source endpoint', 'The public URL that was called. No undocumented mirror is used.'],
                ['Observed at', 'The timestamp supplied by the source for the state.'],
                ['Collected at', 'When ComputePulse received and persisted it.'],
                ['Method', 'Reported window, observed request or documented derivation.'],
                ['Freshness policy', 'Expected interval and stale threshold for that source.'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mono-label">{label}</div>
                  <p className="tiny" style={{ marginTop: 6 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2>Freshness states</h2>
                <Clock3 size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad stack-sm">
                {[
                  ['FRESH', 'Inside the expected interval and stale threshold.'],
                  ['DELAYED', 'Later than expected but not yet beyond the stale threshold.'],
                  ['STALE', 'Beyond the source threshold. The last value is old and must not be read as current.'],
                  ['PENDING', 'Configured, but no successful collection has completed yet.'],
                  ['UNAVAILABLE', 'No observation exists. No default is substituted.'],
                ].map(([state, body]) => (
                  <div key={state}>
                    <FreshnessBadge
                      freshness={{
                        state: state.toLowerCase(),
                        ageSeconds: null,
                        message: body,
                      }}
                    />
                    <p className="tiny muted" style={{ marginTop: 5 }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <Callout tone="warn">
              <strong>Do not read a source claim as an SLA.</strong> Akash uptime is self-reported
              provider telemetry. A 100% value covers the source window only. It does not guarantee a
              workload will be accepted, priced as expected or reachable from your network.
            </Callout>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="section-head">
          <div>
            <div className="eyebrow">Limits</div>
            <h2 style={{ marginTop: 12 }}>What provider observability cannot tell you.</h2>
          </div>
        </div>
        <div className="grid grid-3">
          {[
            {
              icon: <Server size={16} />,
              title: 'Not a workload SLA',
              body: 'Provider availability windows and reported capacity do not prove that a specific deployment will schedule, stay running or meet a latency objective.',
            },
            {
              icon: <Layers3 size={16} />,
              title: 'Not cross-source truth',
              body: 'A healthy Akash provider and a healthy Flux node are not equivalent states. Their sources answer different questions with different collection methods.',
            },
            {
              icon: <Database size={16} />,
              title: 'Not complete inventory',
              body: 'Only providers present in a documented public source are indexed. Absence from the index is not evidence that a provider does not exist.',
            },
          ].map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="icon-box">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
        <div className="row-between wrap mt-24">
          <span className="tiny muted">
            Live sample: {providers.length ? `${providers.length} provider rows fetched ${formatAge(0)}` : 'API unavailable'}
            {providers[0]?.availability1d !== null && providers[0]?.availability1d !== undefined
              ? ` · top row availability ${formatPercent(providers[0].availability1d)}`
              : ''}
          </span>
          <Link href="/app/providers" className="link-arrow">Inspect a row</Link>
        </div>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Direct evidence</div>
          <h2 style={{ margin: '16px 0 18px' }}>Need endpoint truth? Measure it explicitly.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            Create a monitor only for an endpoint you operate or are authorised to test. ComputePulse
            validates the destination, records the attempt and keeps the raw error when it fails.
          </p>
          <div className="btn-row">
            <Link href="/app/monitors/new" className="btn btn-primary">Connect a Provider <ArrowRight size={14} /></Link>
            <Link href="/integrations" className="btn">Monitoring integrations</Link>
          </div>
        </div>
      </section>
    </>
  );
}
