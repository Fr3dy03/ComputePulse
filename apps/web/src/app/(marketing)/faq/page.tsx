import Link from 'next/link';
import { ArrowRight, CircleHelp, ShieldCheck } from 'lucide-react';
import { Callout, EvidenceBadge } from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

const FAQS = [
  {
    q: 'Is ComputePulse a monitoring agent installed on a provider?',
    a: 'No. It is an external observability layer. It reads documented public provider and chain APIs, stores what they report, and can run explicit HTTP or JSON-RPC checks against endpoints an operator is authorised to test. It does not install an agent on provider hosts.',
  },
  {
    q: 'Does a green health state mean the provider is reachable?',
    a: 'No. Akash provider health is source-reported. Flux has no liveness field in its public node list, so every Flux row is UNKNOWN. A green source state is not a ping result. Direct endpoint evidence only comes from an operator-created monitor.',
  },
  {
    q: 'Why is there no overall health percentage?',
    a: 'The sources measure different things: an Akash uptime ratio, a Flux chain-recency estimate and a BOT Chain RPC latency. Weighting them into one number would require arbitrary assumptions. ComputePulse compares only inside documented groups and refuses a composite score.',
  },
  {
    q: 'What does STALE mean?',
    a: 'An observation exists but is older than the source-specific stale threshold. The value is historical, not current. The interface keeps the last value visible with a STALE label and its observation time rather than deleting it or pretending it is fresh.',
  },
  {
    q: 'What happens when a source API fails?',
    a: 'The collection run is recorded as failed with the error. The source health and freshness reflect the failure. The previous observation is not relabelled as current, and no default value is inserted. Alert rules can open a stale-source incident.',
  },
  {
    q: 'Why is Flux capacity unavailable?',
    a: 'The public FluxNode list exposes node identity, tier, collateral references and last confirmed height, but no CPU, memory, storage or GPU capacity. Any capacity figure would have to be invented or fetched by probing nodes. ComputePulse marks it UNAVAILABLE.',
  },
  {
    q: 'Is Flux confirmation lag a health signal?',
    a: 'It is an ESTIMATED chain-recency signal. A node can have a high lag for reasons unrelated to reachability. It never changes a Flux provider from UNKNOWN to HEALTHY or DOWN. It is shown as context, not as liveness.',
  },
  {
    q: 'What is "source latency" in the provider table?',
    a: 'It is the duration of the complete source API request that produced the row. A 1.6-second Flux fetch reflects a 4 MB node list, not a slow provider. It is compared only within the same adapter and collection method.',
  },
  {
    q: 'Why is Akash capacity labelled REPORTED?',
    a: 'Akash providers publish CPU, memory, storage and GPU fields through the Console index. ComputePulse normalises the units and stores the values, but does not verify that the capacity is schedulable, priced as expected or backed by working hardware.',
  },
  {
    q: 'Does the incident registry put metrics on-chain?',
    a: 'No. The registry stores provider references, incident ID hashes, summary digests, source commitments, remediation digests, status and timestamps. Raw observations, response bodies and operator notes stay off-chain. There are no tokens, slashing, escrow or on-chain metrics.',
  },
  {
    q: 'Is the seeded incident real?',
    a: 'Yes. It is correlated from a provider that was actually offline in a real Akash collection. The title may contain a truncated provider name, and the detail page exposes the real source commitment. It is not a fixture with invented timestamps.',
  },
  {
    q: 'Can I monitor any provider endpoint?',
    a: 'Only endpoints you operate or are explicitly authorised to test. Monitors apply SSRF protection, reject private and link-local targets, and require a public destination. Mass-probing provider IPs from a public list is not supported.',
  },
  {
    q: 'Which database does the reference deployment use?',
    a: 'PGlite, an embedded PostgreSQL-compatible engine that persists to disk. Setting DATABASE_URL switches the API to PostgreSQL. TimescaleDB is documented for production time-series storage. Redis/BullMQ is optional and not required for local evaluation.',
  },
  {
    q: 'Are credentials stored in plaintext?',
    a: 'No. Monitor headers and webhook signing secrets are encrypted with AES-256-GCM before storage. Responses expose only whether a secret exists. Production deployments must replace the development encryption key.',
  },
  {
    q: 'Why do some pages show a dash instead of a number?',
    a: 'A dash means the source does not expose the field, no collection has succeeded, or the value failed validation. A dash is deliberately not zero. Treat it as unavailable and read the source limitations before drawing a conclusion.',
  },
  {
    q: 'Can ComputePulse send alerts to my existing tools?',
    a: 'Yes, through a signed HMAC-SHA256 webhook, Prometheus scraping, optional OpenTelemetry traces and SMTP email when configured. Configuration state and delivery failures are both visible. No integration is described as working merely because a record exists.',
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Questions that usually hide a data problem."
        lede="Short, direct answers about evidence states, source limits, endpoint probing, the incident registry and the local deployment. Where a value is unavailable, the answer says so."
        actions={
          <>
            <Link href="/metric-methodology" className="btn btn-primary">Read the methodology <ArrowRight size={14} /></Link>
            <Link href="/contact" className="btn">Contact</Link>
          </>
        }
        meta={
          <>
            <span><CircleHelp size={11} /> 16 answers</span>
            <span><ShieldCheck size={11} /> no fabricated behaviour</span>
          </>
        }
      />

      <MarketingSection>
        <div className="stack-sm" style={{ maxWidth: 900 }}>
          {FAQS.map((item, index) => (
            <details className="panel panel-pad" key={item.q} style={{ background: 'var(--panel)' }}>
              <summary
                style={{
                  cursor: 'pointer',
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  alignItems: 'flex-start',
                  fontWeight: 500,
                  fontSize: 14,
                }}
              >
                <span>
                  <span className="mono" style={{ color: 'var(--cyan)', fontSize: 10, marginRight: 10 }}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {item.q}
                </span>
                <span className="mono-label">open</span>
              </summary>
              <p className="tiny" style={{ marginTop: 14, maxWidth: 780 }}>{item.a}</p>
            </details>
          ))}
        </div>

        <Callout tone="warn">
          <strong>Still seeing a number you cannot explain?</strong> Open the provider or network row
          and inspect the provenance drawer. If the source, method and observation time are not
          visible, treat the value as untrusted and report it.
        </Callout>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="grid grid-3">
          {[
            {
              title: 'Evidence states',
              body: 'OBSERVED, REPORTED, ESTIMATED, UNAVAILABLE, STALE and PENDING are defined in one place.',
              href: '/metric-methodology',
              label: 'Methodology',
            },
            {
              title: 'Provider columns',
              body: 'How to read health, latency, availability window, capacity and freshness without overclaiming.',
              href: '/provider-observability',
              label: 'Provider observability',
            },
            {
              title: 'Deployment',
              body: 'Local quickstart, environment variables, database options, tests and API surface.',
              href: '/documentation',
              label: 'Documentation',
            },
          ].map((item) => (
            <div className="feature-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <Link href={item.href} className="link-arrow" style={{ marginTop: 14 }}>{item.label}</Link>
            </div>
          ))}
        </div>
        <div className="row wrap mt-24" style={{ gap: 8 }}>
          <EvidenceBadge value="observed" />
          <EvidenceBadge value="reported" />
          <EvidenceBadge value="estimated" />
          <EvidenceBadge value="unavailable" />
          <EvidenceBadge value="stale" />
        </div>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Inspect for yourself</div>
          <h2 style={{ margin: '16px 0 18px' }}>Open a row. Read the provenance.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            The fastest way to understand the evidence model is to inspect a live provider or network
            record and follow the source trail.
          </p>
          <div className="btn-row">
            <Link href="/app/providers" className="btn btn-primary">Browse providers <ArrowRight size={14} /></Link>
            <Link href="/app/networks" className="btn">View networks</Link>
          </div>
        </div>
      </section>
    </>
  );
}
