import Link from 'next/link';
import {
  ArrowRight,
  Activity,
  Clock3,
  Database,
  Gauge,
  Layers3,
  Percent,
  Scale,
  ShieldCheck,
  Sigma,
} from 'lucide-react';
import { apiGet, type Benchmarks } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Callout, DataNote, EvidenceBadge } from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const dynamic = 'force-dynamic';

const RULES = [
  {
    title: 'Observation time',
    body: 'The timestamp supplied by the source for the state. Displayed as observed_at. It is not the time the API was called unless the source only supplies a retrieval time, in which case that is documented.',
  },
  {
    title: 'Collection time',
    body: 'When ComputePulse received and persisted the record. A large gap between observed_at and collected_at means the source is reporting old state.',
  },
  {
    title: 'Measurement window',
    body: 'The period a value covers. Akash uptime is a 24h, 7d or 30d window. A monitor latency is a single request. A rate requires an explicit interval; none is inferred.',
  },
  {
    title: 'Collection method',
    body: 'The adapter request, monitor request or documented derivation that produced the value. Adapter version is stored with every observation so parsing changes are traceable.',
  },
  {
    title: 'Freshness',
    body: 'The age of the last successful observation measured against the source-specific stale threshold. Fresh, delayed, stale, pending and unavailable are distinct states.',
  },
  {
    title: 'Actual vs estimated',
    body: 'OBSERVED means measured by ComputePulse. REPORTED means supplied by the source. ESTIMATED means derived with the method published here. UNAVAILABLE means no signal exists. No value is silently imputed.',
  },
];

export default async function MetricMethodologyPage() {
  const { data } = await apiGet<Benchmarks>('/api/v1/benchmarks');

  return (
    <>
      <PageHero
        eyebrow="Metric methodology"
        title="The rules behind every number."
        lede="This page is the public contract for what ComputePulse collects, derives and refuses to claim. If a value cannot be traced to a source, a method and a timestamp, it does not appear as a metric."
        actions={
          <>
            <Link href="/app/benchmarks" className="btn btn-primary">See live benchmarks <ArrowRight size={14} /></Link>
            <Link href="/documentation" className="btn">API and schemas</Link>
          </>
        }
        meta={
          <>
            <span><Sigma size={11} /> no composite score</span>
            <span><Percent size={11} /> explicit denominators</span>
            <span><Database size={11} /> gaps preserved</span>
          </>
        }
      />

      <MarketingSection>
        <div className="grid grid-3">
          {[
            {
              icon: <Activity size={16} />,
              title: 'Evidence states',
              body: 'Five required states are stored, not inferred at render time: OBSERVED, REPORTED, ESTIMATED, UNAVAILABLE and STALE. The UI exposes the state wherever a value appears.',
            },
            {
              icon: <Layers3 size={16} />,
              title: 'Comparability groups',
              body: 'Metrics only compare inside a group and unit. Source collection latency, provider availability, reported capacity and chain RPC latency live in separate groups.',
            },
            {
              icon: <ShieldCheck size={16} />,
              title: 'No imputation',
              body: 'A missing bucket is a gap. It is not zero, it is not the previous value carried forward, and it does not reduce the denominator silently.',
            },
          ].map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="icon-box">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>

        <div className="panel mt-24">
          <div className="panel-head">
            <h2>Required fields on every metric</h2>
            <span className="mono-label">provenance contract</span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Field</th><th>Definition</th></tr>
              </thead>
              <tbody>
                {RULES.map((rule) => (
                  <tr key={rule.title}>
                    <td className="cell-title" style={{ whiteSpace: 'nowrap' }}>{rule.title}</td>
                    <td className="tiny">{rule.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Computations</div>
            <h2 style={{ marginTop: 12 }}>Documented formulas only.</h2>
            <p style={{ marginTop: 12, maxWidth: 720 }}>
              Derived values are labelled ESTIMATED and carry the inputs used. The formulas below are
              the complete set of computations that can produce a displayed value.
            </p>
          </div>
        </div>
        <div className="grid grid-2">
          {[
            {
              title: 'Availability percentiles',
              badge: 'REPORTED',
              body: 'For each network and uptime window, ComputePulse collects non-null source-reported ratios and computes p50, p90 and p99. The sample count is shown. A provider without a value is excluded from the distribution, not treated as zero.',
              formula: 'percentile(sorted(values), p) where values = non-null uptime ratios',
            },
            {
              title: 'Monitor availability',
              badge: 'OBSERVED',
              body: 'Successful checks divided by total checks inside the selected report window. The denominator is the number of attempts stored, including failures. A monitor with zero checks returns null, not 100%.',
              formula: 'successful_checks / total_checks',
            },
            {
              title: 'Freshness state',
              badge: 'OBSERVED',
              body: 'Age is now minus the last successful collection. If age is beyond the source stale threshold, the state is stale. If no success exists, the state is pending or unavailable. A delayed state is used between the expected interval and the stale threshold.',
              formula: 'age_seconds = now − last_success_at',
            },
            {
              title: 'Flux confirmation lag',
              badge: 'ESTIMATED',
              body: 'The current chain head minus the node last-confirmed height, floored at zero. This is chain recency, not endpoint reachability. A large lag can reflect normal node behaviour, so the value never changes provider health from UNKNOWN.',
              formula: 'max(0, chain_head − node_last_confirmed_height)',
            },
            {
              title: 'Capacity totals',
              badge: 'REPORTED',
              body: 'Akash CPU is reported in millicores and converted to cores by dividing by 1000. Memory and storage are bytes. GPU counts are units. Totals sum the latest provider-reported fields for inventory context only.',
              formula: 'cpu_cores = millicores / 1000',
            },
            {
              title: 'Incident onset',
              badge: 'ESTIMATED',
              body: 'When an incident is correlated from a source reference, the onset is the source observed_at time when present, otherwise the first time ComputePulse saw the state. The method is recorded; the onset is not presented as an exact outage start.',
              formula: 'started_at ≈ first source observation, not verified outage start',
            },
          ].map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="row-between">
                <h3>{item.title}</h3>
                <EvidenceBadge value={item.badge} />
              </div>
              <p style={{ marginTop: 10 }}>{item.body}</p>
              <pre className="code-block mt-12" style={{ marginBottom: 0, overflowX: 'auto' }}>{item.formula}</pre>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid split-2-1" style={{ alignItems: 'start' }}>
          <div>
            <div className="eyebrow">Comparability</div>
            <h2 style={{ marginTop: 12 }}>The live metric catalogue.</h2>
            <p style={{ marginTop: 12, maxWidth: 680 }}>
              Metric definitions are stored in the database. The groups below are the only permitted
              comparison boundaries. A metric never appears in two groups.
            </p>
            {data ? (
              <div className="stack-sm mt-24">
                {data.comparabilityGroups.map((group) => (
                  <div className="panel" key={group.group}>
                    <div className="panel-head">
                      <div>
                        <h3 className="mono" style={{ fontSize: 11, color: 'var(--cyan)' }}>{group.group}</h3>
                        <div className="tiny muted" style={{ marginTop: 3 }}>{group.definitions.length} definitions</div>
                      </div>
                      <span className="badge">{group.definitions.length}</span>
                    </div>
                    <div className="table-wrap">
                      <table className="data">
                        <thead>
                          <tr><th>Key</th><th>Unit</th><th>Evidence</th><th>Direction</th></tr>
                        </thead>
                        <tbody>
                          {group.definitions.map((definition) => (
                            <tr key={String(definition.key)}>
                              <td>
                                <div className="mono" style={{ fontSize: 10.5 }}>{String(definition.key)}</div>
                                <div className="cell-sub">{String(definition.name)}</div>
                              </td>
                              <td className="tiny muted">{String(definition.unit)}</td>
                              <td><EvidenceBadge value={String(definition.evidence_type)} /></td>
                              <td className="tiny muted">{String(definition.direction).replace(/_/g, ' ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Callout tone="warn">
                The live metric catalogue is unavailable because the API did not respond. The
                methodology above still applies; no definitions are invented.
              </Callout>
            )}
          </div>

          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2>Evidence states</h2>
                <Gauge size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad stack-sm">
                {[
                  ['observed', 'Direct measurement by a ComputePulse worker.'],
                  ['reported', 'Upstream source claim, stored without independent verification.'],
                  ['estimated', 'Documented derivation from observed or reported inputs.'],
                  ['stale', 'An older observation beyond the source freshness policy.'],
                  ['unavailable', 'Source silence. No value, no estimate, no default.'],
                ].map(([state, body]) => (
                  <div key={state}>
                    <EvidenceBadge value={state} />
                    <p className="tiny muted" style={{ marginTop: 5 }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>Freshness thresholds</h2>
                <Clock3 size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad">
                <dl className="kv">
                  <dt>Akash</dt><dd>5 min collect · 15 min stale</dd>
                  <dt>Flux</dt><dd>10 min collect · 30 min stale</dd>
                  <dt>BOT Chain</dt><dd>1 min collect · 5 min stale</dd>
                  <dt>Bohr</dt><dd>1 min collect · 5 min stale</dd>
                  <dt>Monitors</dt><dd>Operator interval · failure after 2 checks</dd>
                </dl>
                <Callout tone="warn" icon={false}>
                  A stale value is historical. The API continues to return it with a STALE label and
                  the last observation time; the UI does not present it as current.
                </Callout>
              </div>
            </div>

            <div className="panel panel-pad">
              <div className="row-between">
                <h3>Refused calculations</h3>
                <Scale size={14} style={{ color: 'var(--amber)' }} />
              </div>
              <ul className="tiny muted" style={{ paddingLeft: 16, lineHeight: 1.85, marginBottom: 0 }}>
                <li>A universal network health percentage.</li>
                <li>A composite provider rank across source types.</li>
                <li>Cross-source latency averages in one number.</li>
                <li>Uptime estimated from block height or RPC latency.</li>
                <li>Capacity inferred from a node list that omits it.</li>
                <li>Incident-free periods inferred from missing data.</li>
              </ul>
            </div>
          </div>
        </div>
        <DataNote>
          {data
            ? `Live catalogue generated ${formatDateTime(data.generatedAt)}. Benchmarks and percentiles are computed at request time from persisted observations.`
            : 'Live catalogue unavailable. The static methodology remains the authoritative contract.'}
        </DataNote>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Audit the method</div>
          <h2 style={{ margin: '16px 0 18px' }}>No metric without a provenance trail.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            Open a benchmark or provider row, then inspect the source and observation time behind the
            figure. If the trail is missing, the value is not displayed.
          </p>
          <div className="btn-row">
            <Link href="/app/benchmarks" className="btn btn-primary">View benchmarks <ArrowRight size={14} /></Link>
            <Link href="/provider-observability" className="btn">Provider evidence</Link>
          </div>
        </div>
      </section>
    </>
  );
}
