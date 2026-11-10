import Link from 'next/link';
import {
  ArrowRight,
  Activity,
  BellRing,
  Braces,
  ChartNoAxesCombined,
  CircleCheck,
  Database,
  Fingerprint,
  Gauge,
  GitBranch,
  Layers3,
  LockKeyhole,
  Radio,
  ScrollText,
  Server,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { apiGet, type Overview } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { Callout, DataNote, EvidenceBadge, StatCard } from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const dynamic = 'force-dynamic';

const STAGES = [
  {
    number: '01',
    title: 'Collect',
    icon: Radio,
    body: 'Scheduled adapters call documented public APIs: the Akash Console provider index, the Flux daemon node list and block count, and BOT Chain / Bohr JSON-RPC. Every run records its start, finish, latency, provider count, observation count and error.',
  },
  {
    number: '02',
    title: 'Normalise',
    icon: Layers3,
    body: 'Adapter output becomes typed observations with metric key, unit, evidence state, observation time, collection time, source endpoint and adapter version. No field is accepted without a unit or a method.',
  },
  {
    number: '03',
    title: 'Preserve evidence',
    icon: Fingerprint,
    body: 'OBSERVED, REPORTED, ESTIMATED, UNAVAILABLE and STALE are stored as first-class states. Missing values are not zero-filled. A filtered availability sample keeps its real denominator.',
  },
  {
    number: '04',
    title: 'Investigate',
    icon: Activity,
    body: 'Provider and network pages expose histories with gaps, capacity evidence, monitor checks and linked incidents. A provenance drawer shows exactly where a value came from before an operator acts.',
  },
  {
    number: '05',
    title: 'Notify and commit',
    icon: ScrollText,
    body: 'Alert rules open incidents from persisted evidence. Lifecycle actions are audited, signed webhooks notify responders, and a resolved incident can be hashed into the optional BOT Chain incident registry.',
  },
];

export default async function PlatformPage() {
  const { data } = await apiGet<Overview>('/api/v1/overview');

  return (
    <>
      <PageHero
        eyebrow="Platform overview"
        title="An operations layer for infrastructure you do not own."
        lede="ComputePulse collects public provider and chain signals, labels how each value was obtained, and gives operators one place to compare, investigate and record what happened. It is deliberately not a universal uptime score."
        actions={
          <>
            <Link href="/app" className="btn btn-primary">View Network Status <ArrowRight size={14} /></Link>
            <Link href="/provider-observability" className="btn">How observation works</Link>
          </>
        }
        meta={
          <>
            <span><Radio size={11} /> {data ? `${data.networks.length} live sources` : 'source status on app load'}</span>
            <span><ShieldCheck size={11} /> evidence-labelled records</span>
            <span><LockKeyhole size={11} /> no fabricated fallbacks</span>
          </>
        }
      />

      <MarketingSection>
        <div className="grid grid-4">
          <StatCard
            label="Sources configured"
            value={data?.networks.length ?? '—'}
            sub="Akash, Flux, BOT Chain, Bohr"
            icon="radio"
          />
          <StatCard
            label="Providers indexed"
            value={data ? formatNumber(data.providerCounts.total) : '—'}
            sub={data ? `${formatNumber(data.providerCounts.unknown)} with no liveness signal` : 'live from API'}
            icon="server"
          />
          <StatCard
            label="Observations stored"
            value={data ? formatNumber(data.observations.total, { compact: true }) : '—'}
            sub={data ? `${formatNumber(data.observations.last24h)} in the last 24h` : 'live from API'}
            icon="database"
          />
          <StatCard
            label="Endpoint monitors"
            value={data ? `${data.monitors.up}/${data.monitors.total}` : '—'}
            sub="Explicit, operator-created checks"
            icon="gauge"
            accent={data && data.monitors.down > 0 ? 'amber' : 'green'}
          />
        </div>

        <div className="grid grid-3 mt-24">
          {[
            {
              icon: <Server size={16} />,
              title: 'Provider directory',
              body: 'Searchable records across networks with health, availability window, capacity evidence, freshness and active incidents.',
              href: '/compute-providers',
              label: 'Explore providers',
            },
            {
              icon: <Waypoints size={16} />,
              title: 'Network observability',
              body: 'Source collection health, chain metrics and per-network coverage, kept in documented comparability groups.',
              href: '/cross-network-monitoring',
              label: 'Compare networks',
            },
            {
              icon: <BellRing size={16} />,
              title: 'Incidents and alerts',
              body: 'Deterministic rules, a complete lifecycle event log, signed webhook delivery and an optional on-chain commitment.',
              href: '/network-operators',
              label: 'Operator workflow',
            },
          ].map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="icon-box">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <Link href={item.href} className="link-arrow" style={{ marginTop: 14 }}>{item.label}</Link>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">The pipeline</div>
            <h2 style={{ marginTop: 12 }}>Five stages. No hidden aggregation.</h2>
            <p style={{ marginTop: 12, maxWidth: 700 }}>
              Each stage produces a durable record. When a collection fails, the failure is the
              record. When a source is silent, the gap is the record. Nothing is repaired with a
              plausible-looking default.
            </p>
          </div>
        </div>
        <div className="stack-sm">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <div className="feature" key={stage.number}>
                <div className="feature-num">{stage.number}</div>
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <Icon size={14} style={{ color: 'var(--cyan)' }} />
                    <h3>{stage.title}</h3>
                  </div>
                  <p style={{ marginTop: 8, maxWidth: 850 }}>{stage.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid split-2-1" style={{ alignItems: 'start' }}>
          <div>
            <div className="eyebrow">Evidence model</div>
            <h2 style={{ marginTop: 12 }}>The label is part of the metric.</h2>
            <p style={{ marginTop: 12, maxWidth: 620 }}>
              A number without a method is a liability. Every record carries its evidence class, and
              the interface exposes the class wherever the value appears.
            </p>
            <div className="grid grid-2 mt-24">
              {[
                ['OBSERVED', 'Measured directly by a ComputePulse worker or adapter request.'],
                ['REPORTED', 'Supplied by an upstream source. Stored as reported, not independently verified.'],
                ['ESTIMATED', 'Derived with a documented method, such as Flux confirmation lag from block recency.'],
                ['STALE', 'An older observation exists beyond the source freshness policy.'],
                ['UNAVAILABLE', 'The source does not expose the signal. No value is inferred.'],
                ['PENDING', 'No collection has completed yet for that source.'],
              ].map(([state, description]) => (
                <div className="panel panel-pad" key={state} style={{ background: 'var(--bg)' }}>
                  <EvidenceBadge value={state} />
                  <p className="tiny" style={{ marginTop: 10 }}>{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2>In the API</h2>
                <Braces size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad">
                <p className="tiny muted">
                  Every observation includes the source endpoint, adapter version, observed and
                  collected timestamps, dimensions, unit and evidence type. Provider responses add a
                  freshness object with age and policy.
                </p>
                <pre className="code-block mt-12" style={{ margin: 0, overflowX: 'auto' }}>
{`{
  "metric_key": "akash.uptime_1d",
  "value": 0.9987,
  "unit": "ratio",
  "status": "reported",
  "observed_at": "...",
  "collected_at": "...",
  "source_endpoint": "https://console-api.akash.network",
  "adapter_version": "akash-console@1.0.0"
}`}
                </pre>
                <Link href="/documentation" className="link-arrow mt-12">API documentation</Link>
              </div>
            </div>

            <Callout>
              <strong>What the platform refuses to do.</strong> It does not blend an Akash uptime
              percentage, a Flux confirmation lag and a BOT Chain RPC latency into a single score. It
              does not probe Flux node IPs from the public list. It does not treat an empty result as
              healthy.
            </Callout>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Operating surfaces</div>
            <h2 style={{ marginTop: 12 }}>Designed for the investigation, not just the dashboard.</h2>
          </div>
          <Link href="/documentation" className="link-arrow">Browse the documentation</Link>
        </div>
        <div className="grid grid-3">
          {[
            {
              icon: <Gauge size={16} />,
              title: 'Provider detail',
              body: 'History charts with 1h/24h/7d/30d/custom windows, explicit gap coverage, source-reported availability windows and capacity fields with units.',
            },
            {
              icon: <ChartNoAxesCombined size={16} />,
              title: 'Benchmarks',
              body: 'Percentiles only inside a comparability group. Sample counts and coverage are shown next to every distribution.',
            },
            {
              icon: <CircleCheck size={16} />,
              title: 'Monitors',
              body: 'Opt-in HTTP or JSON-RPC checks with SSRF validation, expected status and body assertions, retries, timeout and recorded errors.',
            },
            {
              icon: <BellRing size={16} />,
              title: 'Alert rules',
              body: 'Thresholds over stored monitor or freshness evidence. Cooldowns prevent duplicate incidents; delivery failures are recorded.',
            },
            {
              icon: <ScrollText size={16} />,
              title: 'Reports',
              body: 'Seven- or thirty-day operational evidence from collection runs, monitor checks, incidents, deliveries and audit activity.',
            },
            {
              icon: <GitBranch size={16} />,
              title: 'Integrations',
              body: 'Prometheus scrape endpoint, opt-in OTLP tracing, SMTP email when configured, and HMAC-signed webhooks with encrypted secrets.',
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
            <div className="eyebrow">Deployment</div>
            <h2 style={{ marginTop: 12 }}>Local evaluation without infrastructure theatre.</h2>
            <p style={{ marginTop: 12 }}>
              The reference deployment runs on Node.js with PGlite, a PostgreSQL-compatible embedded
              database, so the full API and interface start without Docker, Redis or a database
              server. Set <span className="mono">DATABASE_URL</span> to move to PostgreSQL. Production
              guidance covers TimescaleDB, Redis/BullMQ and OTLP export.
            </p>
            <div className="stack-sm mt-24">
              {[
                'Typed Fastify API with OpenAPI and a public REST surface',
                'Next.js 15 application router with request-time data',
                'AES-256-GCM credential storage and an explicit SSRF policy',
                'Audited operator mutations and configurable retention',
              ].map((item) => (
                <div className="row" style={{ gap: 9 }} key={item}>
                  <CircleCheck size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                  <span className="tiny">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel panel-pad">
            <div className="mono-label mb-12">Reference quickstart</div>
            <pre className="code-block" style={{ margin: 0 }}>
{`npm install
cp .env.example .env
npm run db:seed
npm run collect
npm run dev:api
npm run dev:web`}
            </pre>
            <p className="tiny muted mt-12">
              Seed data contains the four documented source networks and monitors. Provider and chain
              values only appear after a real collection.
            </p>
            <div className="btn-row mt-16">
              <Link href="/documentation" className="btn btn-sm btn-primary">Deployment guide</Link>
              <Link href="/app" className="btn btn-sm">Open the app</Link>
            </div>
          </div>
        </div>
        <DataNote>
          Marketing figures on this page are generated from the running API at request time. If the
          API is unavailable, the page shows a dash rather than a cached or invented number.
        </DataNote>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Start with evidence</div>
          <h2 style={{ margin: '16px 0 18px' }}>See what the sources actually say.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            Open the live operations view, then connect an endpoint you are authorised to monitor.
            Every check is timestamped and stored with its method.
          </p>
          <div className="btn-row">
            <Link href="/app" className="btn btn-primary">View Network Status <ArrowRight size={14} /></Link>
            <Link href="/app/monitors/new" className="btn">Connect a Provider</Link>
          </div>
        </div>
      </section>
    </>
  );
}
