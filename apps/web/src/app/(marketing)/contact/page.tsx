import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Mail,
  MessageSquare,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { apiGet, type Overview } from '@/lib/api';
import { formatAge, formatNumber } from '@/lib/format';
import { Callout, DataNote, FreshnessBadge, HealthBadge, NetworkDot } from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const contactEmail = process.env.CONTACT_EMAIL?.trim();
  const { data } = await apiGet<Overview>('/api/v1/overview');

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the people who run the evidence."
        lede="Use this page for deployment questions, source-adapter issues, data corrections and security reports. This reference deployment does not operate a fake contact form."
        actions={
          <>
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} className="btn btn-primary">
                Email operations <Mail size={14} />
              </a>
            ) : (
              <Link href="/documentation" className="btn btn-primary">Read the documentation <ArrowRight size={14} /></Link>
            )}
            <Link href="/app" className="btn">View system status</Link>
          </>
        }
        meta={
          <>
            <span><Server size={11} /> {data ? `${data.networks.length} sources observed` : 'API status unavailable'}</span>
            <span><Clock3 size={11} /> UTC timestamps</span>
            <span><ShieldCheck size={11} /> security reports welcome</span>
          </>
        }
      />

      <MarketingSection>
        <div className="grid split-2-1" style={{ alignItems: 'start' }}>
          <div>
            {contactEmail ? (
              <div className="panel">
                <div className="panel-head">
                  <h2>Operations contact</h2>
                  <Mail size={14} style={{ color: 'var(--cyan)' }} />
                </div>
                <div className="panel-pad">
                  <p className="tiny muted">
                    This deployment has configured a contact address. Include the source, provider or
                    incident identifier so the request can be traced without guesswork.
                  </p>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="mono"
                    style={{ display: 'inline-block', marginTop: 16, color: 'var(--cyan)', fontSize: 14 }}
                  >
                    {contactEmail}
                  </a>
                </div>
              </div>
            ) : (
              <div className="panel">
                <div className="panel-head">
                  <h2>Contact channel not configured</h2>
                  <CircleAlert size={14} style={{ color: 'var(--amber)' }} />
                </div>
                <div className="panel-pad stack">
                  <p className="tiny muted">
                    The reference deployment has no public inbox, so this page does not display a
                    fabricated email address or a form that discards messages. Set{' '}
                    <span className="mono">CONTACT_EMAIL</span> in the environment to publish a real
                    address here.
                  </p>
                  <div className="callout warn" style={{ margin: 0 }}>
                    <strong>Operators:</strong> if you are evaluating ComputePulse, use your internal
                    deployment channel. For security issues, do not post secrets or provider
                    credentials in a public issue.
                  </div>
                  <div>
                    <Link href="/documentation" className="link-arrow">Deployment and configuration</Link>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-2 mt-24">
              {[
                {
                  icon: <MessageSquare size={16} />,
                  title: 'Deployment questions',
                  body: 'Include your Node version, database mode, API base URL, and the exact command that failed. A screenshot of an error banner helps only if it includes the request path.',
                },
                {
                  icon: <BookOpen size={16} />,
                  title: 'Data corrections',
                  body: 'Name the source, metric key, provider ID and observation timestamp. Provider values are source claims; corrections must identify the upstream record, not just the displayed number.',
                },
                {
                  icon: <ShieldCheck size={16} />,
                  title: 'Security reports',
                  body: 'Describe the affected route or integration, the impact and reproduction steps. Do not include live credentials, private keys or full provider response bodies.',
                },
                {
                  icon: <Server size={16} />,
                  title: 'Adapter requests',
                  body: 'Propose a documented, publicly accessible source with stable terms. Include the endpoint, sample response, authentication requirements and the exact fields you expect.',
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

          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2>Live system state</h2>
                <span className="mono-label">request time</span>
              </div>
              <div className="panel-pad">
                {data ? (
                  <>
                    <dl className="kv">
                      <dt>Providers</dt>
                      <dd>{formatNumber(data.providerCounts.total)}</dd>
                      <dt>Observations</dt>
                      <dd>{formatNumber(data.observations.total)}</dd>
                      <dt>Monitors up</dt>
                      <dd>{data.monitors.up}/{data.monitors.total}</dd>
                      <dt>Active incidents</dt>
                      <dd>{data.incidents.active}</dd>
                      <dt>Snapshot</dt>
                      <dd>{formatAge((Date.now() - new Date(data.generatedAt).getTime()) / 1000)}</dd>
                    </dl>
                    <div className="stack-sm mt-16">
                      {data.networks.map((network) => (
                        <div className="row-between" key={network.id}>
                          <span className="row" style={{ gap: 7 }}>
                            <NetworkDot colour={network.brandColor} />
                            <span className="tiny">{network.name}</span>
                          </span>
                          <div className="row" style={{ gap: 6 }}>
                            <HealthBadge value={network.healthState} />
                            <FreshnessBadge freshness={network.sourceFreshness} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="table-empty">
                    The API is unreachable. This page will not show cached values as current.
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>Before you write</h2>
                <CheckCircle2 size={13} style={{ color: 'var(--green)' }} />
              </div>
              <div className="panel-pad">
                <ul className="tiny muted" style={{ paddingLeft: 16, lineHeight: 1.9, margin: 0 }}>
                  <li>Check the FAQ and the six reference documents first.</li>
                  <li>Include the network and provider ID, not only a display name.</li>
                  <li>Include the metric key and observation timestamp.</li>
                  <li>Never send provider credentials or a private key.</li>
                  <li>For a monitor failure, include the SSRF-safe destination and status code.</li>
                </ul>
              </div>
            </div>

            <Callout>
              <strong>No support SLA is implied.</strong> This is a reference deployment. Response
              times depend on the operator running it. Production deployments must publish their own
              support terms.
            </Callout>
          </div>
        </div>

        <DataNote>
          Contact routing is environment-driven. The page displays no address unless{' '}
          <span className="mono">CONTACT_EMAIL</span> is set. The live system card is generated from
          the API at request time and is not a cached status badge.
        </DataNote>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Keep investigating</div>
          <h2 style={{ margin: '16px 0 18px' }}>The evidence is one click away.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            Browse the provider directory, inspect a freshness state, or read the exact metric
            methodology before opening a request.
          </p>
          <div className="btn-row">
            <Link href="/app/providers" className="btn btn-primary">Browse providers <ArrowRight size={14} /></Link>
            <Link href="/faq" className="btn">Read the FAQ</Link>
          </div>
        </div>
      </section>
    </>
  );
}
