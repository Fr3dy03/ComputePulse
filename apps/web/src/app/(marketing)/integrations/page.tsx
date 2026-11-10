import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Braces,
  CheckCircle2,
  Database,
  LockKeyhole,
  Mail,
  Plug,
  Radio,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { apiGet, type Integration } from '@/lib/api';
import { formatAge, formatDateTime, titleCase } from '@/lib/format';
import { Callout, DataNote, StatCard } from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const dynamic = 'force-dynamic';

const META: Record<string, { icon: typeof Plug; description: string; link?: { href: string; label: string } }> = {
  prometheus: {
    icon: Activity,
    description: 'Scrape the Fastify API at /metrics for collection, monitor, incident and evidence counters in Prometheus text exposition format.',
  },
  opentelemetry: {
    icon: Braces,
    description: 'OTLP/HTTP tracing is opt-in. When enabled, API requests and collection runs emit spans to the configured collector.',
  },
  email: {
    icon: Mail,
    description: 'Email alert delivery requires SMTP_URL. Local mode records the integration as unconfigured and sends nothing.',
  },
  webhook: {
    icon: Webhook,
    description: 'Signed JSON alert deliveries with HMAC-SHA256, an encrypted shared secret and the same SSRF policy as monitors.',
  },
};

export default async function IntegrationsMarketingPage() {
  const { data, error } = await apiGet<{ data: Integration[] }>('/api/v1/integrations');
  const integrations = data?.data ?? [];
  const configured = integrations.filter((item) => ['configured', 'ready'].includes(item.status));

  return (
    <>
      <PageHero
        eyebrow="Integrations"
        title="Feed the tools your team already trusts."
        lede="ComputePulse exposes Prometheus metrics, optional OpenTelemetry traces, signed webhooks and SMTP delivery when configured. Configuration state is reported honestly; nothing is described as live until its prerequisites exist."
        actions={
          <>
            <Link href="/app/integrations" className="btn btn-primary">Configure integrations <ArrowRight size={14} /></Link>
            <Link href="/documentation" className="btn">API reference</Link>
          </>
        }
        meta={
          <>
            <span><Radio size={11} /> /metrics endpoint</span>
            <span><ShieldCheck size={11} /> signed webhooks</span>
            <span><LockKeyhole size={11} /> secrets encrypted at rest</span>
          </>
        }
      />

      <MarketingSection>
        <div className="grid grid-4">
          <StatCard
            label="Integration records"
            value={integrations.length || '—'}
            sub="Reported by the running API"
            icon="radio"
          />
          <StatCard
            label="Configured or ready"
            value={configured.length}
            sub="Configuration evidence, not delivery proof"
            icon="check"
            accent="green"
          />
          <StatCard
            label="Scrape path"
            value="/metrics"
            sub="Prometheus text exposition"
            icon="gauge"
          />
          <StatCard
            label="Delivery signing"
            value="HMAC-SHA256"
            sub="Secret encrypted with AES-256-GCM"
            icon="shield"
          />
        </div>

        {error ? (
          <div className="error-banner mt-16">
            Integration records are unavailable: {error}. No integration cards are fabricated.
          </div>
        ) : null}

        <div className="grid grid-2 mt-24">
          {integrations.map((integration) => {
            const meta = META[integration.kind] ?? {
              icon: Plug,
              description: 'Integration record reported by the API.',
            };
            const Icon = meta.icon;
            const ready = ['configured', 'ready'].includes(integration.status);
            return (
              <section className="panel" key={integration.id}>
                <div className="panel-head">
                  <div className="row" style={{ gap: 10 }}>
                    <span className="icon-box" style={{ width: 30, height: 30 }}>
                      <Icon size={15} />
                    </span>
                    <div>
                      <h2>{integration.name}</h2>
                      <div className="tiny muted" style={{ marginTop: 2 }}>{titleCase(integration.kind)}</div>
                    </div>
                  </div>
                  <span className={`badge ${ready ? 'badge-observed' : 'badge-unavailable'}`}>
                    {integration.status.toUpperCase()}
                  </span>
                </div>
                <div className="panel-pad">
                  <p className="tiny muted">{meta.description}</p>
                  <dl className="kv mt-16">
                    <dt>Last sync</dt>
                    <dd>
                      {integration.last_sync_at
                        ? formatAge((Date.now() - new Date(integration.last_sync_at).getTime()) / 1000)
                        : 'never'}
                    </dd>
                    <dt>Secret</dt>
                    <dd>{integration.has_secret ? 'Stored (encrypted)' : 'Not stored'}</dd>
                    <dt>Updated</dt>
                    <dd>{formatDateTime(integration.last_sync_at)}</dd>
                  </dl>
                  {integration.kind === 'webhook' ? (
                    <div className="row-between wrap mt-12">
                      <span className="tiny muted">Header: X-ComputePulse-Signature</span>
                      <Link href="/app/integrations" className="link-arrow">Edit webhook</Link>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
          {!integrations.length && !error ? (
            <section className="panel panel-pad">
              <div className="table-empty">No integration records are configured.</div>
            </section>
          ) : null}
        </div>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="grid split-2-1" style={{ alignItems: 'start' }}>
          <div>
            <div className="eyebrow">Security model</div>
            <h2 style={{ marginTop: 12 }}>Outbound delivery with an explicit policy.</h2>
            <p style={{ marginTop: 12, maxWidth: 650 }}>
              Webhook destinations are validated before they are stored and again before delivery.
              Private, loopback, link-local and cloud metadata addresses are rejected after DNS
              resolution. Redirects are not followed.
            </p>
            <div className="grid grid-2 mt-24">
              {[
                ['SSRF validation', 'HTTP(S) only, DNS revalidation, public-address checks and a documented port allowlist.'],
                ['Encrypted secrets', 'AES-256-GCM at rest. The API returns only whether a secret exists.'],
                ['Signed bodies', 'HMAC-SHA256 over the exact JSON payload with a configurable signature header.'],
                ['No infinite retries', 'A failed delivery is recorded. ComputePulse does not queue forever or hide the failure.'],
                ['Rate limiting', 'API route limits reduce abuse and accidental collection storms.'],
                ['Retention controls', 'Observation and monitor-check retention are configurable and documented.'],
              ].map(([label, body]) => (
                <div className="panel panel-pad" key={label} style={{ background: 'var(--bg)' }}>
                  <strong style={{ fontSize: 12 }}>{label}</strong>
                  <p className="tiny" style={{ marginTop: 6 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2>Example scrape</h2>
                <Database size={13} style={{ color: 'var(--secondary)' }} />
              </div>
              <div className="panel-pad">
                <pre className="code-block" style={{ margin: 0, overflowX: 'auto' }}>
{`# prometheus.yml
scrape_configs:
  - job_name: computepulse
    metrics_path: /metrics
    static_configs:
      - targets: ["api:8787"]`}
                </pre>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'}/metrics`}
                  target="_blank"
                  rel="noreferrer"
                  className="link-arrow mt-12"
                >
                  Open local /metrics <ArrowUpRight size={11} />
                </a>
              </div>
            </div>
            <Callout>
              <strong>Configuration is not delivery.</strong> A configured webhook does not prove the
              destination accepted a payload. Delivery counts and failures are reported in Alert Rules
              and operational reports.
            </Callout>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="section-head">
          <div>
            <div className="eyebrow">API surface</div>
            <h2 style={{ marginTop: 12 }}>Everything the interface reads is available over HTTP.</h2>
            <p style={{ marginTop: 12, maxWidth: 700 }}>
              The Next.js application calls the same public REST API that operators and automation can
              use. OpenAPI is served by the Fastify backend.
            </p>
          </div>
          <Link href="/documentation" className="link-arrow">Endpoint reference</Link>
        </div>
        <div className="grid grid-3">
          {[
            ['/api/v1/overview', 'Cross-network snapshot with source freshness and incident counts.'],
            ['/api/v1/providers', 'Filtered provider directory with pagination and availability window.'],
            ['/api/v1/providers/:id/history', 'Bucketed time series with explicit coverage and gaps.'],
            ['/api/v1/incidents', 'Incident register with lifecycle events and source commitments.'],
            ['/api/v1/reports?days=7', 'Operational evidence report for a seven- or thirty-day window.'],
            ['/api/v1/openapi.json', 'Machine-readable OpenAPI document for the read and write routes.'],
          ].map(([route, body]) => (
            <div className="feature-card" key={route}>
              <div className="mono" style={{ color: 'var(--cyan)', fontSize: 10.5 }}>{route}</div>
              <p className="tiny" style={{ marginTop: 8 }}>{body}</p>
            </div>
          ))}
        </div>
        <div className="row-between wrap mt-24">
          <span className="tiny muted">
            {integrations.length
              ? `${configured.length} of ${integrations.length} integration records are configured or ready.`
              : 'Waiting for the API integration records.'}
          </span>
          <Link href="/app/integrations" className="link-arrow">Manage delivery</Link>
        </div>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Connect the signal</div>
          <h2 style={{ margin: '16px 0 18px' }}>Scrape it, trace it, or sign it.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            Start with the local /metrics endpoint, then configure a signed webhook for incident
            delivery. Every integration reports its true state.
          </p>
          <div className="btn-row">
            <Link href="/app/integrations" className="btn btn-primary">Open integrations <ArrowRight size={14} /></Link>
            <Link href="/app/alert-rules" className="btn">Alert rules</Link>
          </div>
        </div>
      </section>
    </>
  );
}
