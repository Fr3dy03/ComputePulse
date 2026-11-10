import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Braces,
  Database,
  FileCode2,
  FileText,
  GitBranch,
  LockKeyhole,
  ServerCog,
  Terminal,
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { Callout, DataNote } from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

const ENDPOINTS = [
  ['GET', '/health', 'Liveness and database connectivity.'],
  ['GET', '/metrics', 'Prometheus exposition format.'],
  ['GET', '/api/v1/overview', 'Cross-network snapshot, source freshness, incidents and collection status.'],
  ['GET', '/api/v1/networks', 'Configured networks with source runtime and evidence limitations.'],
  ['GET', '/api/v1/networks/:id', 'Network detail including recent runs, metrics and monitors.'],
  ['GET', '/api/v1/providers', 'Paginated provider directory. Query: page, pageSize, networkId, health, evidence, search, availabilityWindow, hasIncident, sort.'],
  ['GET', '/api/v1/providers/:id', 'Provider detail, observations, capacity history and incidents.'],
  ['GET', '/api/v1/providers/:id/history', 'Bucketed history. Query: metricKey, window, from, to.'],
  ['GET', '/api/v1/capacity', 'Capacity evidence and provider-reported totals.'],
  ['GET', '/api/v1/benchmarks', 'Comparability groups, percentiles, coverage and caveats.'],
  ['GET', '/api/v1/reports', 'Operational report. Query: days=7 or 30.'],
  ['GET', '/api/v1/monitors', 'Endpoint monitors, latest check and 24h availability.'],
  ['POST', '/api/v1/monitors', 'Create a monitor. Validates URL and SSRF policy.'],
  ['POST', '/api/v1/monitors/:id/check', 'Run one check immediately.'],
  ['GET', '/api/v1/incidents', 'Incident register. Query: status, severity, networkId, providerId, search, limit.'],
  ['POST', '/api/v1/incidents/:id/actions', 'Acknowledge, assign, note, mitigate, resolve or close an incident.'],
  ['GET', '/api/v1/alert-rules', 'Alert rules with delivery counts.'],
  ['PATCH', '/api/v1/alert-rules/:id', 'Update enabled state, threshold, severity or window.'],
  ['GET', '/api/v1/integrations', 'Integration configuration state. Secrets are never returned.'],
  ['PATCH', '/api/v1/integrations/:id', 'Update the signed webhook destination.'],
  ['GET', '/api/v1/settings', 'Organisation, freshness policy, environment and retention.'],
  ['PATCH', '/api/v1/settings', 'Update allowlisted workspace settings.'],
  ['POST', '/api/v1/collect', 'Trigger collection. Optional body: { "networkIds": ["akash-mainnet"] }.'],
  ['GET', '/api/v1/openapi.json', 'OpenAPI document.'],
];

export const dynamic = 'force-dynamic';

const DOCS = [
  ['RESEARCH.md', 'Verified sources, access checks, rejected candidates and licensing notes.'],
  ['PROVIDER_ADAPTERS.md', 'Adapter contracts, field mapping, health semantics and error handling.'],
  ['METRIC_METHODOLOGY.md', 'Metric definitions, formulas, evidence classes and comparability.'],
  ['ARCHITECTURE.md', 'Services, data flow, database schema, deployment topology and security.'],
  ['DATA_FRESHNESS.md', 'Freshness policies, stale detection, gap handling and retention.'],
  ['INTEGRATION_LIMITATIONS.md', 'Prometheus, OpenTelemetry, webhooks, email, registry and known limits.'],
];

export default function DocumentationPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title="Run it, inspect it, extend it."
        lede="ComputePulse ships as a typed monorepo with a Fastify API, Next.js interface, PostgreSQL-compatible storage and documented live adapters. This page covers the reference setup, data model and API surface."
        actions={
          <>
            <Link href="/app" className="btn btn-primary">Open operations app <ArrowRight size={14} /></Link>
            <a href={`${API_URL}/api/docs`} className="btn" target="_blank" rel="noreferrer">Interactive API docs</a>
          </>
        }
        meta={
          <>
            <span><Terminal size={11} /> Node 20+ / npm 10+</span>
            <span><Database size={11} /> PGlite local · PostgreSQL production</span>
            <span><LockKeyhole size={11} /> no Docker required</span>
          </>
        }
      />

      <MarketingSection>
        <div className="grid split-2-1" style={{ alignItems: 'start' }}>
          <div>
            <div className="eyebrow">Quickstart</div>
            <h2 style={{ marginTop: 12 }}>From clone to evidence in five commands.</h2>
            <p style={{ marginTop: 12, maxWidth: 640 }}>
              The local database is embedded PGlite, a PostgreSQL-compatible engine that persists to
              disk. The collector seeds four documented sources and runs a real collection. No Docker,
              Redis or external database is required for evaluation.
            </p>
            <pre className="code-block mt-24" style={{ margin: 0 }}>
{`# 1. install workspace dependencies
npm install

# 2. create local API configuration
cp .env.example apps/api/.env

# 3. initialise schema and seed source metadata
npm run db:seed

# 4. collect real observations
npm run collect

# 5. run the API and web app in separate terminals
npm run dev:api
npm run dev:web`}
            </pre>
            <p className="tiny muted mt-12">
              Open <span className="mono">http://localhost:3000</span>. The API listens on{' '}
              <span className="mono">http://localhost:8787</span>. Both must be running for the
              request-time data views.
            </p>
            <div className="callout warn mt-16">
              <strong>No fabricated fallback.</strong> If the API is offline, the interface shows an
              error banner and explicit empty states. Seeded data contains source metadata, monitors
              and rules; provider and chain values appear only after a collection.
            </div>
          </div>

          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2>Prerequisites</h2>
                <ServerCog size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad">
                <dl className="kv">
                  <dt>Node.js</dt><dd>20.12 or newer (reference: 24)</dd>
                  <dt>npm</dt><dd>10 or newer (workspaces)</dd>
                  <dt>Database</dt><dd>PGlite locally, PostgreSQL via DATABASE_URL</dd>
                  <dt>Foundry</dt><dd>Optional, for contract tests and deployment</dd>
                  <dt>Network</dt><dd>Outbound HTTPS to the four source APIs</dd>
                </dl>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h2>Repository layout</h2>
                <Boxes size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad">
                <pre className="code-block" style={{ margin: 0, overflowX: 'auto' }}>
{`apps/
  api/      Fastify API, adapters, collector, DB
  web/      Next.js 15 marketing site and app
contracts/  Foundry registry and tests
docs/       Six operational reference documents
package.json`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Environment</div>
            <h2 style={{ marginTop: 12 }}>Configuration that changes behaviour.</h2>
            <p style={{ marginTop: 12, maxWidth: 700 }}>
              The API loads <span className="mono">.env</span> from its working directory. The
              reference <span className="mono">.env.example</span> contains safe local defaults and
              explicit placeholders for production secrets.
            </p>
          </div>
        </div>
        <div className="table-wrap panel">
          <table className="data">
            <thead>
              <tr><th>Variable</th><th>Default</th><th>Purpose</th></tr>
            </thead>
            <tbody>
              {[
                ['PORT', '8787', 'Fastify listen port.'],
                ['APP_ORIGIN', 'http://localhost:3000', 'CORS origin for the browser client.'],
                ['DATABASE_URL', 'empty', 'PostgreSQL connection string. Empty uses PGlite.'],
                ['PGLITE_DIR', 'apps/api/.data/pglite', 'Local embedded database directory.'],
                ['ADMIN_API_TOKEN', 'empty', 'When set, mutating routes require a bearer token.'],
                ['CREDENTIAL_ENCRYPTION_KEY', 'dev key', 'AES-256-GCM key for stored secrets. Replace in production.'],
                ['COLLECTOR_ENABLED', 'true', 'Scheduled source collection.'],
                ['MONITOR_SCHEDULER_ENABLED', 'true', 'Scheduled endpoint checks.'],
                ['AKASH_INTERVAL_MS', '300000', 'Akash collection interval.'],
                ['FLUX_INTERVAL_MS', '600000', 'Flux collection interval.'],
                ['BOT_INTERVAL_MS', '60000', 'BOT Chain and Bohr collection interval.'],
                ['SMTP_URL', 'empty', 'Enables email delivery when configured.'],
                ['WEBHOOK_SECRET', 'empty', 'Optional global webhook signing secret.'],
                ['OTEL_ENABLED', 'false', 'Enable OTLP/HTTP trace export.'],
                ['OTEL_EXPORTER_OTLP_ENDPOINT', 'empty', 'Collector endpoint for OTLP.'],
                ['INCIDENT_REGISTRY_ADDRESS', 'empty', 'Deployed ProviderIncidentRegistry address.'],
                ['BOT_OPERATOR_PRIVATE_KEY', 'empty', 'Operator key for anchoring. Never commit.'],
              ].map(([name, value, purpose]) => (
                <tr key={name}>
                  <td className="mono" style={{ fontSize: 10.5 }}>{name}</td>
                  <td className="mono tiny muted">{value}</td>
                  <td className="tiny">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="warn">
          <strong>Production checklist.</strong> Set a strong <span className="mono">ADMIN_API_TOKEN</span>,
          replace the development encryption key, use PostgreSQL or TimescaleDB, terminate TLS at a
          proxy, restrict egress, configure retention, and replace the reference privacy/terms pages
          with your own reviewed documents.
        </Callout>
      </MarketingSection>

      <MarketingSection>
        <div className="section-head">
          <div>
            <div className="eyebrow">API reference</div>
            <h2 style={{ marginTop: 12 }}>Read and write surface.</h2>
            <p style={{ marginTop: 12, maxWidth: 720 }}>
              The browser application uses this API at request time. Responses are JSON. Collection
              and monitor writes are rate-limited and audited. The OpenAPI document is served by the
              API process.
            </p>
          </div>
          <a href={`${API_URL}/api/docs`} target="_blank" rel="noreferrer" className="link-arrow">
            API reference <ArrowUpRight size={11} />
          </a>
        </div>
        <div className="table-wrap panel">
          <table className="data">
            <thead>
              <tr><th>Method</th><th>Path</th><th>Description</th></tr>
            </thead>
            <tbody>
              {ENDPOINTS.map(([method, path, description]) => (
                <tr key={`${method}-${path}`}>
                  <td>
                    <span className={`badge ${method === 'GET' ? 'badge-reported' : 'badge-estimated'}`}>{method}</span>
                  </td>
                  <td className="mono" style={{ fontSize: 10.5 }}>{path}</td>
                  <td className="tiny">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DataNote>
          The API process must be running for <span className="mono">{API_URL}/api/docs</span> and{' '}
          <span className="mono">{API_URL}/api/v1/openapi.json</span>. The web application proxies no
          data; it calls the configured API URL directly.
        </DataNote>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="grid split-1-2" style={{ alignItems: 'start' }}>
          <div>
            <div className="eyebrow">Reference documents</div>
            <h2 style={{ marginTop: 12 }}>The long-form material.</h2>
            <p style={{ marginTop: 12 }}>
              The repository contains six documents covering the research, adapters, metrics,
              architecture, freshness and integration limits. They are the source of truth for claims
              made on this site.
            </p>
            <div className="stack-sm mt-24">
              {DOCS.map(([file, description]) => (
                <a className="panel panel-pad" key={file} href={`/docs/${file}`} style={{ background: 'var(--bg)' }}>
                  <div className="row-between">
                    <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)' }}>{file}</span>
                    <FileText size={13} style={{ color: 'var(--secondary)' }} />
                  </div>
                  <p className="tiny muted" style={{ marginTop: 6 }}>{description}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2>Database</h2>
                <Database size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad">
                <p className="tiny muted">
                  The schema uses regular PostgreSQL tables and indexes. In production, the
                  observations table is the natural TimescaleDB hypertable:
                </p>
                <pre className="code-block mt-12" style={{ margin: 0, overflowX: 'auto' }}>
{`CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT create_hypertable(
  'observations',
  by_range('observed_at'),
  if_not_exists => TRUE
);`}
                </pre>
                <p className="tiny muted mt-12">
                  PGlite does not ship TimescaleDB. The local reference uses plain tables with the same
                  SQL semantics; production can apply the hypertable migration.
                </p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>Contract</h2>
                <FileCode2 size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad">
                <p className="tiny muted">
                  <span className="mono">ProviderIncidentRegistry.sol</span> is a Foundry project under{' '}
                  <span className="mono">contracts/</span>. It implements the specified roles,
                  structs, functions and events only. No tokens, slashing, escrow or on-chain metrics.
                </p>
                <div className="row wrap mt-12" style={{ gap: 8 }}>
                  <span className="badge badge-observed">DEFAULT_ADMIN_ROLE</span>
                  <span className="badge badge-observed">PROVIDER_OPERATOR_ROLE</span>
                  <span className="badge badge-observed">INCIDENT_ATTESTOR_ROLE</span>
                </div>
                <Link href="/network-operators" className="link-arrow mt-16">Registry model</Link>
              </div>
            </div>

            <div className="panel panel-pad">
              <div className="row-between">
                <h3>Tests</h3>
                <GitBranch size={14} style={{ color: 'var(--secondary)' }} />
              </div>
              <p className="tiny muted mt-8">
                API tests cover adapters, invalid endpoints, downtime, timeouts, rate limits, stale and
                missing metrics, duplicate handling, units, endpoint changes, benchmark comparability,
                incident states, alert delivery and contract signatures. Foundry covers the registry.
              </p>
              <pre className="code-block mt-12" style={{ margin: 0 }}>
{`npm test
cd contracts && forge test -vvv`}
              </pre>
            </div>
          </div>
        </div>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Start operating</div>
          <h2 style={{ margin: '16px 0 18px' }}>Bring up the sources, then inspect the evidence.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            The quickstart takes a fresh checkout to a populated, live operational view with no
            external database or container runtime.
          </p>
          <div className="btn-row">
            <Link href="/app" className="btn btn-primary">Open operations app <ArrowRight size={14} /></Link>
            <Link href="/metric-methodology" className="btn">Read the methodology</Link>
          </div>
        </div>
      </section>
    </>
  );
}
