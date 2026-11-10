import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileKey2,
  Fingerprint,
  Network,
  ShieldAlert,
} from 'lucide-react';
import { apiGet, type IncidentSummary } from '@/lib/api';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import {
  Callout,
  DataNote,
  PageHead,
  SeverityBadge,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import { IncidentActions } from '@/components/IncidentActions';

export const dynamic = 'force-dynamic';

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: incident, error } = await apiGet<IncidentSummary>(
    `/api/v1/incidents/${encodeURIComponent(id)}`,
  );
  if (!incident) {
    if (error) return <div className="error-banner">Incident could not be loaded: {error}</div>;
    notFound();
  }

  const events = incident.events ?? [];
  const end = incident.resolved_at ?? incident.closed_at;
  const durationSeconds = end
    ? (new Date(end).getTime() - new Date(incident.detected_at).getTime()) / 1000
    : (Date.now() - new Date(incident.detected_at).getTime()) / 1000;
  const metadata = incident.metadata ?? {};

  return (
    <>
      <PageHead
        breadcrumb={<><Link href="/app/incidents">Incidents</Link> / <strong>{incident.id}</strong></>}
        title={incident.title}
        description={`${incident.network_name ?? 'Unscoped network'} · ${incident.provider_external_id ?? 'no provider'} · source ${incident.source}`}
        actions={
          incident.source_url ? (
            <a href={incident.source_url} target="_blank" rel="noreferrer" className="btn btn-sm">
              Open source <ArrowUpRight size={11} />
            </a>
          ) : null
        }
        meta={
          <>
            <span><Clock3 size={11} /> Detected {formatDateTime(incident.detected_at)}</span>
            <span><Network size={11} /> {incident.provider_name ?? incident.provider_external_id ?? 'No provider'}</span>
            <span><Fingerprint size={11} /> {incident.anchor_status ?? 'not_anchored'}</span>
          </>
        }
      />

      <div className="row wrap mb-16" style={{ gap: 8 }}>
        <SeverityBadge severity={incident.severity} />
        <StatusBadge value={incident.status} />
        <span className="badge">{incident.source}</span>
        <span className="badge badge-observed">event log</span>
        <span className="badge badge-estimated">onset estimated / detection time</span>
        {incident.assigned_to ? <span className="badge">assigned: {incident.assigned_to}</span> : <span className="badge badge-unavailable">unassigned</span>}
      </div>

      <div className="grid grid-4">
        <StatCard label="Duration" value={incident.resolved_at ? formatDuration(durationSeconds) : `${formatDuration(durationSeconds)}+`} sub={incident.resolved_at ? `resolved ${formatDateTime(incident.resolved_at)}` : 'still active'} icon="clock" accent={incident.resolved_at ? 'green' : 'red'} />
        <StatCard label="Timeline events" value={events.length} sub="append-only event log" icon="database" />
        <StatCard label="Source observed" value={incident.source_observed_at ? formatDateTime(incident.source_observed_at).slice(0, 17) : '—'} sub="upstream record time" icon="radio" />
        <StatCard label="Anchor status" value={incident.anchor_status ?? 'not_anchored'} sub={incident.onchain_tx_hash ? 'transaction recorded' : 'no transaction recorded'} icon="shield" accent={incident.onchain_tx_hash ? 'green' : 'amber'} />
      </div>

      <div className="grid split-2-1 mt-24" style={{ alignItems: 'start' }}>
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Summary</h2><span className="tiny muted">evidence-bound narrative</span></div>
            <div className="panel-pad">
              <p style={{ fontSize: 14, color: 'var(--text)' }}>{incident.summary}</p>
              {incident.remediation ? (
                <>
                  <div className="mono-label mt-16 mb-8">Operator remediation</div>
                  <p className="tiny" style={{ color: 'var(--text)' }}>{incident.remediation}</p>
                </>
              ) : null}
              <Callout tone="warn" icon={false}>
                <strong>Onset limitation.</strong> The source does not establish when this outage
                began. The incident start is the ComputePulse detection time; it is not back-dated.
                Duration therefore describes detection-to-resolution, not true outage length.
              </Callout>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Event timeline</h2><span className="mono-label">{events.length} entries</span></div>
            <div className="panel-pad">
              <div className="timeline">
                {events.map((event) => (
                  <div className={`timeline-item ${event.event_type === 'resolved' ? 'accent' : event.event_type === 'created' ? 'danger' : ''}`} key={event.id}>
                    <div className="time">{formatDateTime(event.created_at)} · {event.actor}</div>
                    <div className="event">
                      <span className="mono" style={{ color: 'var(--cyan)', fontSize: 10.5 }}>{event.event_type}</span>
                      {event.note ? <div className="tiny muted mt-8" style={{ color: '#b7c3cc' }}>{event.note}</div> : null}
                      {event.data && Object.keys(event.data).length ? (
                        <details style={{ marginTop: 6 }}>
                          <summary className="tiny muted" style={{ cursor: 'pointer' }}>Event data</summary>
                          <pre className="prose" style={{ fontSize: 10, overflowX: 'auto', background: 'var(--bg)', padding: 10, borderRadius: 5, border: '1px solid var(--border)', marginTop: 6 }}>
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!events.length ? <span className="tiny muted">No events recorded.</span> : null}
              </div>
            </div>
          </section>

          <IncidentActions
            id={incident.id}
            status={incident.status}
            assignedTo={incident.assigned_to ?? null}
            severity={incident.severity}
          />

          <section className="panel">
            <div className="panel-head"><h2>Source metadata</h2><span className="tiny muted">raw evidence fields</span></div>
            <div className="panel-pad">
              <dl className="kv">
                <dt>Incident ID</dt><dd className="mono" style={{ fontSize: 10, textAlign: 'left' }}>{incident.id}</dd>
                <dt>Source</dt><dd>{incident.source}</dd>
                <dt>Source ref</dt><dd className="mono" style={{ fontSize: 10, textAlign: 'left' }}>{incident.source_ref ?? '—'}</dd>
                <dt>Source observed</dt><dd>{formatDateTime(incident.source_observed_at)}</dd>
                <dt>Started at</dt><dd>{formatDateTime(incident.started_at)}</dd>
                <dt>Detected at</dt><dd>{formatDateTime(incident.detected_at)}</dd>
                <dt>Acknowledged</dt><dd>{formatDateTime(incident.acknowledged_at)}</dd>
                <dt>Resolved</dt><dd>{formatDateTime(incident.resolved_at)}</dd>
                <dt>Closed</dt><dd>{formatDateTime(incident.closed_at)}</dd>
                <dt>Assigned to</dt><dd>{incident.assigned_to ?? '—'}</dd>
              </dl>
              {Object.keys(metadata).length ? (
                <>
                  <div className="mono-label mt-16 mb-8">Correlation metadata</div>
                  <pre style={{ fontSize: 10, overflowX: 'auto', background: 'var(--bg)', padding: 10, borderRadius: 5, border: '1px solid var(--border)' }}>
                    {JSON.stringify(metadata, null, 2)}
                  </pre>
                </>
              ) : null}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Linked provider</h2><ShieldAlert size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              {incident.provider_id ? (
                <>
                  <Link href={`/app/providers/${incident.provider_id}`} className="cell-title">
                    {incident.provider_name ?? incident.provider_external_id ?? incident.provider_id}
                  </Link>
                  <div className="cell-sub mono mt-8" style={{ wordBreak: 'break-all' }}>{incident.provider_external_id}</div>
                  <Link href={`/app/providers/${incident.provider_id}`} className="btn btn-sm mt-12">Open provider evidence</Link>
                </>
              ) : <span className="tiny muted">No provider is linked to this incident.</span>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Commitment</h2><FileKey2 size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              <div className="mono-label mb-8">Source commitment hash</div>
              <div className="mono" style={{ fontSize: 10, wordBreak: 'break-all', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, padding: 9 }}>
                {incident.sourceCommitment ?? incident.summary_digest ?? 'Not generated until resolution evidence exists.'}
              </div>
              <dl className="kv mt-12">
                <dt>Anchor status</dt><dd>{incident.anchor_status ?? 'not_anchored'}</dd>
                <dt>Contract incident</dt><dd className="mono" style={{ fontSize: 10 }}>{incident.contract_incident_id ?? '—'}</dd>
                <dt>Tx hash</dt><dd className="mono" style={{ fontSize: 10, textAlign: 'left', wordBreak: 'break-all' }}>{incident.onchain_tx_hash ?? '—'}</dd>
              </dl>
              {incident.onchain_tx_hash ? (
                <a href={`https://scan.botchain.ai/tx/${incident.onchain_tx_hash}`} target="_blank" rel="noreferrer" className="link-arrow mt-12">
                  View on BOT Chain scan
                </a>
              ) : (
                <Callout tone="warn" icon={false}>
                  Not anchored. On-chain commitment is optional and requires an operator key plus a
                  configured registry address. No fake transaction is shown.
                </Callout>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Lifecycle</h2><CheckCircle2 size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              {['open', 'acknowledged', 'investigating', 'mitigated', 'resolved', 'closed'].map((state) => {
                const order = ['open', 'acknowledged', 'investigating', 'mitigated', 'resolved', 'closed'];
                const currentIndex = order.indexOf(incident.status);
                const stateIndex = order.indexOf(state);
                const done = stateIndex <= currentIndex;
                return (
                  <div className="row" key={state} style={{ gap: 8, padding: '6px 0' }}>
                    <span className={`status-dot ${done ? 'healthy' : ''}`} />
                    <span className="tiny" style={{ color: done ? 'var(--text)' : 'var(--secondary)' }}>{state}</span>
                    {state === incident.status ? <span className="badge" style={{ marginLeft: 'auto' }}>current</span> : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Linked network</h2><Network size={13} style={{ color: 'var(--secondary)' }} /></div>
            <div className="panel-pad">
              {incident.network_id ? (
                <Link href={`/app/networks/${incident.network_id}`} className="link-arrow">{incident.network_name} network detail</Link>
              ) : <span className="tiny muted">No network linked.</span>}
              <div className="tiny muted mt-8">
                {formatNumber(events.length)} events · {incident.source === 'incident_correlation' ? 'correlated from source state' : 'operator-authored'}
              </div>
            </div>
          </section>
        </div>
      </div>

      <DataNote>
        This incident is a record of evidence, not an assertion of fault or liability. The source
        commitment binds the stored summary, timeline and remediation fields. It does not prove their
        truth to a third party and is not a token, bond or escrow.
      </DataNote>
    </>
  );
}
