'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { apiSend } from '@/lib/api';

export function IncidentActions({
  id,
  status,
  assignedTo,
  severity,
}: {
  id: string;
  status: string;
  assignedTo: string | null;
  severity: string;
}) {
  const router = useRouter();
  const [actor, setActor] = useState('operator');
  const [note, setNote] = useState('');
  const [remediation, setRemediation] = useState('');
  const [assignee, setAssignee] = useState(assignedTo ?? '');
  const [severityValue, setSeverityValue] = useState(severity);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const run = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(action);
    setMessage(null);
    const response = await apiSend(`/api/v1/incidents/${id}/actions`, 'POST', {
      action,
      actor: actor || 'operator',
      ...body,
    });
    setBusy(null);
    setError(!response.ok);
    const payload = response.data as { message?: string; error?: string } | null;
    setMessage(
      response.ok
        ? 'Incident event recorded.'
        : payload?.message ?? `Action rejected (HTTP ${response.status}).`,
    );
    if (response.ok) {
      setNote('');
      setRemediation('');
      router.refresh();
    }
  };

  const allowed = (target: string) => {
    const order = ['open', 'acknowledged', 'investigating', 'mitigated', 'resolved', 'closed'];
    const currentIndex = order.indexOf(status);
    if (target === 'acknowledged') return order.indexOf(status) <= 1;
    if (target === 'investigating') return ['open', 'acknowledged'].includes(status);
    if (target === 'mitigated') return ['open', 'acknowledged', 'investigating'].includes(status);
    if (target === 'resolved') return ['open', 'acknowledged', 'investigating', 'mitigated'].includes(status);
    if (target === 'closed') return ['resolved', 'mitigated'].includes(status) || currentIndex < 5;
    return true;
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Incident actions</h2>
        <span className="tiny muted">Recorded in the event log · operator-authored</span>
      </div>
      <div className="panel-pad stack">
        {message ? (
          <div className={error ? 'error-banner' : 'success-banner'} style={{ margin: 0 }}>{message}</div>
        ) : null}
        <div className="form-grid">
          <label className="field">
            <span>Actor</span>
            <input value={actor} onChange={(event) => setActor(event.target.value)} maxLength={120} />
          </label>
          <label className="field">
            <span>Severity</span>
            <select value={severityValue} onChange={(event) => setSeverityValue(event.target.value)}>
              <option value="critical">critical</option>
              <option value="major">major</option>
              <option value="minor">minor</option>
              <option value="warning">warning</option>
              <option value="info">info</option>
            </select>
          </label>
          <label className="field">
            <span>Assignee</span>
            <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="sre-oncall" maxLength={120} />
          </label>
          <div className="field">
            <span>Assignment</span>
            <button
              className="btn btn-sm"
              type="button"
              disabled={!assignee || busy !== null}
              onClick={() => void run('assign', { assignee })}
            >
              {busy === 'assign' ? <Loader2 size={12} className="spin" /> : null} Assign incident
            </button>
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-sm" type="button" disabled={!allowed('acknowledged') || busy !== null} onClick={() => void run('acknowledge')}>
            Acknowledge
          </button>
          <button className="btn btn-sm" type="button" disabled={!allowed('investigating') || busy !== null} onClick={() => void run('investigate')}>
            Investigate
          </button>
          <button className="btn btn-sm btn-success" type="button" disabled={!allowed('mitigated') || busy !== null} onClick={() => void run('mitigate')}>
            Mitigate
          </button>
          <button className="btn btn-sm btn-ghost" type="button" disabled={busy !== null} onClick={() => void run('severity', { severity: severityValue })}>
            Update severity
          </button>
        </div>

        <hr />

        <label className="field">
          <span>Resolution remediation note</span>
          <textarea
            value={remediation}
            onChange={(event) => setRemediation(event.target.value)}
            placeholder="What changed, what was verified, and what remains uncertain. This is hashed into the incident commitment when resolved."
          />
        </label>
        <div className="btn-row">
          <button
            className="btn btn-success"
            type="button"
            disabled={!allowed('resolved') || !remediation.trim() || busy !== null}
            onClick={() => void run('resolve', { remediation })}
          >
            {busy === 'resolve' ? <Loader2 size={12} className="spin" /> : null} Resolve incident
          </button>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            disabled={!allowed('closed') || busy !== null}
            onClick={() => void run('close')}
          >
            Close
          </button>
        </div>

        <hr />

        <label className="field">
          <span>Operator note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Corroborating evidence, external reference, or next action. Notes are not source observations."
            style={{ minHeight: 76 }}
          />
        </label>
        <div className="btn-row">
          <button
            className="btn btn-sm"
            type="button"
            disabled={!note.trim() || busy !== null}
            onClick={() => void run('note', { note })}
          >
            {busy === 'note' ? <Loader2 size={12} className="spin" /> : <Send size={12} />} Add note
          </button>
        </div>
        <div className="tiny muted">
          Transitions are validated server-side. A resolve action requires remediation text. The
          incident digest binds the reported source state, timeline and remediation for optional
          on-chain anchoring.
        </div>
      </div>
    </section>
  );
}
