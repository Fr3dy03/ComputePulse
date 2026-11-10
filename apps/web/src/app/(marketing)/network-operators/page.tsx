import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileSignature,
  Fingerprint,
  GitBranch,
  KeyRound,
  Link2,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { apiGet, type Overview } from '@/lib/api';
import { formatAge, formatNumber } from '@/lib/format';
import { Callout, DataNote, EvidenceBadge, NetworkDot } from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const dynamic = 'force-dynamic';

const ROLES = [
  ['DEFAULT_ADMIN_ROLE', 'Grants and revokes the operator and attestor roles. The admin is expected to be a multisig or controlled operator account in production.'],
  ['PROVIDER_OPERATOR_ROLE', 'Registers a provider reference and binds it to an operator address and network identifier. It does not grant custody of provider infrastructure.'],
  ['INCIDENT_ATTESTOR_ROLE', 'Submits incident commitments, acknowledgements, remediation commitments and closures for registered providers.'],
];

const FUNCTIONS = [
  ['registerProvider()', 'Registers a provider reference. The transaction is rejected when the provider is already active or the operator address is zero.'],
  ['submitIncidentCommitment()', 'Stores a digest of the incident summary and a source commitment. The source commitment is a hash of the evidence package produced off-chain.'],
  ['acknowledgeIncident()', 'Moves an open incident to ACKNOWLEDGED and records the caller and block timestamp.'],
  ['submitRemediationCommitment()', 'Records a digest of the remediation reference. It does not publish the private remediation text.'],
  ['closeIncident()', 'Closes an acknowledged or mitigated incident. A closed incident cannot be reopened by submitting a new commitment with the same ID.'],
  ['getIncident()', 'Returns the complete incident struct for a given incident ID.'],
  ['getIncidentStatus()', 'Returns only the current status, useful for lightweight integrations.'],
];

const EVENTS = [
  'ProviderRegistered',
  'IncidentCommitted',
  'IncidentAcknowledged',
  'RemediationCommitted',
  'IncidentClosed',
];

export default async function NetworkOperatorsPage() {
  const { data } = await apiGet<Overview>('/api/v1/overview');
  const registry = data?.networks.find((network) => network.id === 'bot-mainnet');

  return (
    <>
      <PageHero
        eyebrow="Network operators"
        title="An incident record responders can defend."
        lede="ComputePulse is off-chain observability first. The optional on-chain registry exists for signed incident announcements and remediation references — not for metrics, tokens, slashing or escrow."
        actions={
          <>
            <Link href="/app/incidents" className="btn btn-primary">Open incident register <ArrowRight size={14} /></Link>
            <Link href="/documentation" className="btn">Operator documentation</Link>
          </>
        }
        meta={
          <>
            <span><ScrollText size={11} /> role-controlled registry</span>
            <span><Link2 size={11} /> BOT Chain commitment layer</span>
            <span><ShieldCheck size={11} /> no funds at risk</span>
          </>
        }
      />

      <MarketingSection>
        <div className="grid grid-3">
          {[
            {
              icon: <Clock3 size={16} />,
              title: 'Observe',
              body: 'A source reports a state or an operator runs a monitor. ComputePulse stores the observation with evidence class, source endpoint, method and timestamps.',
            },
            {
              icon: <TriangleAlert size={16} />,
              title: 'Investigate',
              body: 'A correlated incident links the source reference, affected provider and every lifecycle event. Operators add acknowledgement and remediation notes through the app.',
            },
            {
              icon: <FileSignature size={16} />,
              title: 'Commit',
              body: 'A resolved incident can be hashed into a summary digest and source commitment. The optional BOT Chain registry records the commitment, not the raw observability data.',
            },
          ].map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="icon-box">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>

        <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
          <div className="panel">
            <div className="panel-head">
              <h2>Lifecycle states</h2>
              <span className="mono-label">off-chain and on-chain</span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Meaning</th>
                    <th>Evidence</th>
                    <th>On-chain action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['OPEN', 'Incident recorded from source state or a monitor failure.', 'reported / observed', 'submitIncidentCommitment'],
                    ['ACKNOWLEDGED', 'An operator has accepted ownership.', 'observed', 'acknowledgeIncident'],
                    ['INVESTIGATING', 'Active diagnosis with a named assignee and notes.', 'observed', '—'],
                    ['MITIGATED', 'Impact is reduced but the incident is not closed.', 'observed', 'submitRemediationCommitment'],
                    ['RESOLVED', 'Service restored; waiting for review or closure.', 'observed', '—'],
                    ['CLOSED', 'Incident record finalised and review complete.', 'observed', 'closeIncident'],
                  ].map(([state, meaning, evidence, action]) => (
                    <tr key={state}>
                      <td className="mono" style={{ fontSize: 10.5 }}>{state}</td>
                      <td className="tiny">{meaning}</td>
                      <td><EvidenceBadge value={evidence.split(' / ')[0]} suffix={evidence.includes(' / ') ? evidence.split(' / ')[1] : undefined} /></td>
                      <td className="mono tiny muted">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-toolbar" style={{ borderBottom: 0 }}>
              <span className="tiny muted">
                Off-chain events are always recorded. Anchoring is optional and never blocks incident
                handling if BOT Chain is unavailable.
              </span>
            </div>
          </div>

          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2>Commitment layer</h2>
                <NetworkDot colour={registry?.brandColor ?? '#10A37F'} />
              </div>
              <div className="panel-pad">
                <dl className="kv">
                  <dt>Network</dt>
                  <dd>{registry?.name ?? 'BOT Chain'}</dd>
                  <dt>Chain ID</dt>
                  <dd className="mono">677</dd>
                  <dt>Source state</dt>
                  <dd>{registry?.healthState ?? 'unavailable'}</dd>
                  <dt>Last observation</dt>
                  <dd>
                    {registry?.lastObservedAt
                      ? formatAge((Date.now() - new Date(registry.lastObservedAt).getTime()) / 1000)
                      : '—'}
                  </dd>
                  <dt>Registry address</dt>
                  <dd className="mono tiny">not deployed in reference mode</dd>
                </dl>
                <Callout tone="warn" icon={false}>
                  No contract address is fabricated. Deployment requires an operator key and BOT Chain
                  gas. The app shows <span className="mono">not_anchored</span> until a real deployment
                  and transaction exist.
                </Callout>
                <a
                  href="https://scan.botchain.ai/"
                  target="_blank"
                  rel="noreferrer"
                  className="link-arrow"
                >
                  Open BOT Chain explorer <ArrowUpRight size={11} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Registry contract</div>
            <h2 style={{ marginTop: 12 }}>Three roles. Seven functions. Five events.</h2>
            <p style={{ marginTop: 12, maxWidth: 720 }}>
              <span className="mono">ProviderIncidentRegistry.sol</span> follows the specified minimum
              surface. It stores commitments and status history only. It contains no token, slashing,
              penalty, escrow or metric logic.
            </p>
          </div>
          <a
            href="https://dev-docs.botchain.ai/docs/intro/"
            target="_blank"
            rel="noreferrer"
            className="link-arrow"
          >
            BOT developer docs <ArrowUpRight size={11} />
          </a>
        </div>

        <div className="grid grid-2">
          <div className="panel">
            <div className="panel-head">
              <h2>Roles</h2>
              <KeyRound size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="stack-sm panel-pad">
              {ROLES.map(([role, description]) => (
                <div key={role}>
                  <div className="mono" style={{ color: 'var(--cyan)', fontSize: 10.5 }}>{role}</div>
                  <p className="tiny muted" style={{ marginTop: 5 }}>{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Events</h2>
              <GitBranch size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="panel-pad stack-sm">
              {EVENTS.map((event) => (
                <div className="row" style={{ gap: 8 }} key={event}>
                  <CheckCircle2 size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                  <span className="mono" style={{ fontSize: 10.5 }}>{event}</span>
                </div>
              ))}
              <p className="tiny muted" style={{ marginTop: 10 }}>
                Every state transition emits an event with the incident ID, actor and timestamp so an
                indexer can reconstruct the history without trusting a private API.
              </p>
            </div>
          </div>
        </div>

        <div className="panel mt-16">
          <div className="panel-head">
            <h2>Function surface</h2>
            <Users size={13} style={{ color: 'var(--secondary)' }} />
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Function</th><th>Behaviour</th></tr>
              </thead>
              <tbody>
                {FUNCTIONS.map(([fn, description]) => (
                  <tr key={fn}>
                    <td className="mono" style={{ fontSize: 10.5, color: 'var(--cyan)' }}>{fn}</td>
                    <td className="tiny">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid split-1-2" style={{ alignItems: 'start' }}>
          <div>
            <div className="eyebrow">Data boundary</div>
            <h2 style={{ marginTop: 12 }}>What stays private.</h2>
            <p style={{ marginTop: 12 }}>
              Raw observations, monitor response bodies, operator notes and provider contact details
              remain off-chain. The registry receives fixed-size commitments and status, not telemetry.
            </p>
            <div className="stack-sm mt-24">
              {[
                ['On-chain', 'provider ID hash, operator address, network ID hash, incident ID hash, summary digest, source commitment, remediation digest, status and timestamps.'],
                ['Off-chain', 'Raw metric values, response bodies, latency samples, monitor credentials, assignee names, internal notes and the full incident timeline.'],
              ].map(([label, body]) => (
                <div className="panel panel-pad" key={label} style={{ background: 'var(--bg)' }}>
                  <div className="mono-label">{label}</div>
                  <p className="tiny" style={{ marginTop: 7 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Operator workflow in the app</h2>
              <Fingerprint size={13} style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="panel-pad">
              <div className="timeline">
                {[
                  ['Detect', 'A rule or correlated source state opens an incident with a source reference and observation time.'],
                  ['Acknowledge', 'An operator claims ownership. The event is audited with actor and timestamp.'],
                  ['Investigate', 'Assign, add notes and attach remediation references. Every action is appended to the event log.'],
                  ['Mitigate and resolve', 'Record the remediation digest and resolve the incident. The original evidence remains immutable.'],
                  ['Commit or close', 'Optionally anchor the commitment on BOT Chain, then close the local record. Failure to anchor never deletes the incident.'],
                ].map(([title, body], index) => (
                  <div className={`timeline-item ${index === 4 ? 'accent' : ''}`} key={title}>
                    <div className="time">{String(index + 1).padStart(2, '0')}</div>
                    <div className="event">
                      <strong>{title}</strong>
                      <div className="tiny muted">{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DataNote>
          The reference deployment currently reports {data ? `${formatNumber(data.incidents.total)} recorded incidents` : 'no live incident count'}.
          No contract address or transaction hash is shown unless one was actually produced. Anchor
          state is displayed as not anchored in local mode.
        </DataNote>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Accountable operations</div>
          <h2 style={{ margin: '16px 0 18px' }}>Record the incident. Keep the evidence.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            Review the live incident lifecycle, then read the deployment guide before enabling the
            optional registry in production.
          </p>
          <div className="btn-row">
            <Link href="/app/incidents" className="btn btn-primary">View incidents <ArrowRight size={14} /></Link>
            <Link href="/documentation" className="btn">Registry deployment</Link>
          </div>
        </div>
      </section>
    </>
  );
}
