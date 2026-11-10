import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Braces,
  CheckCircle2,
  Mail,
  Plug,
  Radio,
  Webhook,
  XCircle,
} from 'lucide-react';
import { apiGet, type Integration } from '@/lib/api';
import { formatAge, formatDateTime, titleCase } from '@/lib/format';
import { WebhookEditor } from '@/components/AdminForms';
import { Callout, DataNote, PageHead, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

const KIND_META: Record<
  string,
  { icon: typeof Plug; title: string; evidence: string; note: string }
> = {
  prometheus: {
    icon: Activity,
    title: 'Prometheus scrape endpoint',
    evidence: 'OBSERVED',
    note: 'Exports ComputePulse collector and monitor counters at /metrics. Values describe this platform, not provider availability.',
  },
  opentelemetry: {
    icon: Braces,
    title: 'OpenTelemetry traces',
    evidence: 'OBSERVED',
    note: 'OTLP/HTTP traces for API requests and collection runs when an endpoint is configured.',
  },
  email: {
    icon: Mail,
    title: 'Email notifications',
    evidence: 'CONFIGURATION',
    note: 'Requires SMTP_URL. Local mode records no email delivery and does not pretend to send one.',
  },
  webhook: {
    icon: Webhook,
    title: 'Signed alert webhook',
    evidence: 'CONFIGURATION',
    note: 'HMAC-SHA256 signed JSON deliveries. The signing secret is encrypted at rest and never returned by the API.',
  },
};

export default async function IntegrationsPage() {
  const { data, error } = await apiGet<{ data: Integration[] }>('/api/v1/integrations');
  const integrations = data?.data ?? [];
  const configured = integrations.filter((item) =>
    ['configured', 'ready'].includes(item.status),
  );
  const webhook = integrations.find((item) => item.kind === 'webhook');

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Integrations</strong></>}
        title="Integrations and delivery"
        description="Telemetry export and alert delivery paths. Configuration state is shown exactly as stored; no integration is described as live unless its prerequisites are present."
        meta={
          <>
            <span><Plug size={11} /> {integrations.length} integration records</span>
            <span><CheckCircle2 size={11} /> {configured.length} configured or ready</span>
            <span><BellRing size={11} /> Signed delivery path</span>
          </>
        }
      />

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid grid-4">
        <StatCard
          label="Prometheus"
          value={integrations.some((item) => item.kind === 'prometheus') ? '/metrics' : '—'}
          sub="Scrape endpoint exposed by the API"
          icon="radio"
        />
        <StatCard
          label="OpenTelemetry"
          value={integrations.find((item) => item.kind === 'opentelemetry')?.status === 'ready' ? 'READY' : 'OFF'}
          sub="OTLP/HTTP export when configured"
          icon="signal"
        />
        <StatCard
          label="Email"
          value={integrations.find((item) => item.kind === 'email')?.status === 'configured' ? 'CONFIGURED' : 'UNAVAILABLE'}
          sub="SMTP_URL is not set in local mode"
          icon="alert"
          accent="amber"
        />
        <StatCard
          label="Webhook"
          value={webhook?.status === 'configured' ? 'SIGNED' : 'UNCONFIGURED'}
          sub={webhook?.has_secret ? 'Secret encrypted at rest' : 'No signing secret stored'}
          icon="shield"
          accent={webhook?.status === 'configured' ? 'green' : 'amber'}
        />
      </div>

      <div className="grid grid-2 mt-24" style={{ alignItems: 'start' }}>
        {integrations.map((integration) => {
          const meta = KIND_META[integration.kind] ?? {
            icon: Plug,
            title: integration.name,
            evidence: 'CONFIGURATION',
            note: 'Integration record.',
          };
          const Icon = meta.icon;
          const healthy = ['configured', 'ready'].includes(integration.status);
          return (
            <section className="panel" key={integration.id}>
              <div className="panel-head">
                <div className="row" style={{ gap: 10 }}>
                  <span className="icon-box" style={{ width: 30, height: 30 }}>
                    <Icon size={15} />
                  </span>
                  <div>
                    <h2>{meta.title}</h2>
                    <div className="tiny muted" style={{ marginTop: 2 }}>{integration.id}</div>
                  </div>
                </div>
                <span className={`badge ${healthy ? 'badge-observed' : 'badge-unavailable'}`}>
                  {integration.status.toUpperCase()}
                </span>
              </div>
              <div className="panel-pad stack">
                <p className="tiny muted" style={{ margin: 0 }}>{meta.note}</p>
                <dl className="kv">
                  <dt>Kind</dt>
                  <dd>{titleCase(integration.kind)}</dd>
                  <dt>Display name</dt>
                  <dd style={{ textAlign: 'left' }}>{integration.name}</dd>
                  <dt>Secret</dt>
                  <dd style={{ textAlign: 'left' }}>
                    {integration.has_secret ? 'Stored (encrypted)' : 'Not stored'}
                  </dd>
                  <dt>Last sync</dt>
                  <dd style={{ textAlign: 'left' }}>
                    {integration.last_sync_at
                      ? `${formatDateTime(integration.last_sync_at)} · ${formatAge((Date.now() - new Date(integration.last_sync_at).getTime()) / 1000)}`
                      : 'never'}
                  </dd>
                </dl>
                <div>
                  <div className="mono-label mb-8">Stored configuration</div>
                  <pre className="code-block" style={{ margin: 0, maxHeight: 180, overflow: 'auto' }}>
                    {JSON.stringify(integration.config, null, 2)}
                  </pre>
                </div>
                {integration.kind === 'prometheus' ? (
                  <div className="row-between wrap" style={{ gap: 8 }}>
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'}/metrics`}
                      target="_blank"
                      rel="noreferrer"
                      className="link-arrow"
                    >
                      Open scrape endpoint
                    </a>
                    <span className="tiny muted">Content type text/plain; version=0.0.4</span>
                  </div>
                ) : null}
                {integration.kind === 'email' ? (
                  <Callout tone="warn" icon={false}>
                    Email delivery is unavailable until <span className="mono">SMTP_URL</span> is
                    configured and the API is restarted. No message is queued or simulated.
                  </Callout>
                ) : null}
                {integration.kind === 'opentelemetry' ? (
                  <Callout tone="warn" icon={false}>
                    Set <span className="mono">OTEL_ENABLED=true</span> and{' '}
                    <span className="mono">OTEL_EXPORTER_OTLP_ENDPOINT</span> to export traces. The
                    integration record alone does not create a trace pipeline.
                  </Callout>
                ) : null}
              </div>
            </section>
          );
        })}
        {!integrations.length ? (
          <section className="panel panel-pad">
            <div className="table-empty">No integration records are configured.</div>
          </section>
        ) : null}
      </div>

      {webhook ? (
        <div className="mt-24">
          <WebhookEditor integration={webhook} />
        </div>
      ) : null}

      <div className="grid grid-3 mt-24">
        <section className="panel panel-pad">
          <div className="row-between">
            <h3>SSRF policy</h3>
            <ShieldGlyph />
          </div>
          <p className="tiny muted mt-8">
            Webhook URLs pass the same validation as monitors: HTTP(S) only, DNS resolved,
            public-address revalidation, documented port allowlist, and redirects disabled.
          </p>
        </section>
        <section className="panel panel-pad">
          <div className="row-between">
            <h3>Signing</h3>
            <Radio size={14} style={{ color: 'var(--secondary)' }} />
          </div>
          <p className="tiny muted mt-8">
            Delivery bodies are signed with HMAC-SHA256 using the stored secret. The API exposes only
            whether a secret exists, never its value. Rotate by saving a replacement.
          </p>
        </section>
        <section className="panel panel-pad">
          <div className="row-between">
            <h3>Failure handling</h3>
            <XCircle size={14} style={{ color: 'var(--red)' }} />
          </div>
          <p className="tiny muted mt-8">
            A failed webhook delivery is recorded with its status. ComputePulse does not retry
            indefinitely and does not drop the underlying incident when notification fails.
          </p>
        </section>
      </div>

      <DataNote>
        Integration state is configuration evidence, not delivery evidence. Check the alert rules
        table and operational report for actual delivery counts. No integration below is described as
        working merely because a record exists.
      </DataNote>

      <div className="row-between wrap mt-16">
        <span className="tiny muted">
          Secrets are encrypted with AES-256-GCM. Environment configuration is reported in Settings.
        </span>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/app/settings" className="link-arrow">Environment settings</Link>
          <a
            href="https://www.botchain.ai/en/"
            target="_blank"
            rel="noreferrer"
            className="tiny muted"
            style={{ textDecoration: 'underline' }}
          >
            BOT Chain <ArrowUpRight size={9} style={{ display: 'inline' }} />
          </a>
        </div>
      </div>
    </>
  );
}

function ShieldGlyph() {
  return <span className="badge badge-observed">ENFORCED</span>;
}
