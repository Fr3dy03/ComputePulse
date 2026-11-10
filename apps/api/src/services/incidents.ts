import type { Database } from '../db/client.js';
import { getDb } from '../db/client.js';
import { env } from '../env.js';
import { hmacSha256Hex, sha256Hex, decryptJson } from '../lib/crypto.js';
import { safeFetch } from '../lib/ssrf.js';
import { uuid } from '../lib/ids.js';
import { iso } from '../lib/time.js';

export type IncidentStatus =
  | 'open'
  | 'acknowledged'
  | 'investigating'
  | 'mitigated'
  | 'resolved'
  | 'closed';

export type IncidentSeverity = 'critical' | 'major' | 'minor' | 'warning' | 'info';

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['acknowledged', 'investigating', 'mitigated', 'resolved'],
  acknowledged: ['investigating', 'mitigated', 'resolved'],
  investigating: ['mitigated', 'resolved'],
  mitigated: ['resolved'],
  resolved: ['closed', 'investigating'],
  closed: [],
};

export interface IncidentRow {
  id: string;
  organisation_id: string;
  network_id: string | null;
  provider_id: string | null;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: string;
  source_ref: string | null;
  source_url: string | null;
  source_observed_at: string | null;
  metadata: Record<string, unknown>;
  started_at: string;
  detected_at: string;
  acknowledged_at: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  remediation: string | null;
  contract_incident_id: string | null;
  onchain_tx_hash: string | null;
  anchor_status: string;
  created_at: string;
  updated_at: string;
  network_name?: string;
  provider_name?: string;
  provider_external_id?: string;
}

export interface CreateIncidentInput {
  title: string;
  summary: string;
  severity: IncidentSeverity;
  networkId?: string | null;
  providerId?: string | null;
  source: string;
  sourceRef?: string | null;
  sourceUrl?: string | null;
  sourceObservedAt?: string | null;
  startedAt?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

async function insertEvent(
  db: Database,
  incidentId: string,
  eventType: string,
  actor: string,
  note: string | null,
  data: Record<string, unknown> = {},
) {
  await db.query(
    `INSERT INTO incident_events (incident_id, event_type, actor, note, data, created_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
    [incidentId, eventType, actor, note, JSON.stringify(data), new Date().toISOString()],
  );
}

export async function audit(
  db: Database,
  action: string,
  entityType: string,
  entityId: string | null,
  data: Record<string, unknown>,
  actor = 'operator@computepulse.local',
) {
  await db.query(
    `INSERT INTO audit_logs (organisation_id, actor, action, entity_type, entity_id, data, created_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [
      env.DEMO_ORG_ID,
      actor,
      action,
      entityType,
      entityId,
      JSON.stringify(data),
      new Date().toISOString(),
    ],
  );
}

export async function createIncident(
  input: CreateIncidentInput,
  dbOverride?: Database,
): Promise<IncidentRow> {
  const db = dbOverride ?? (await getDb());
  const id = uuid('inc');
  const now = new Date().toISOString();
  const startedAt = input.startedAt ?? now;
  await db.query(
    `INSERT INTO incidents
      (id, organisation_id, network_id, provider_id, title, summary, severity, status, source, source_ref,
       source_url, source_observed_at, metadata, started_at, detected_at, anchor_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9,$10,$11,$12::jsonb,$13,$14,'not_anchored')`,
    [
      id,
      env.DEMO_ORG_ID,
      input.networkId ?? null,
      input.providerId ?? null,
      input.title,
      input.summary,
      input.severity,
      input.source,
      input.sourceRef ?? null,
      input.sourceUrl ?? null,
      input.sourceObservedAt ?? null,
      JSON.stringify(input.metadata ?? {}),
      startedAt,
      now,
    ],
  );
  await insertEvent(db, id, 'created', input.actor ?? 'correlation-engine', input.summary, {
    source: input.source,
    source_ref: input.sourceRef ?? null,
    severity: input.severity,
    started_at: startedAt,
    onset_note:
      'started_at is the detection/open time unless a source supplied an authoritative onset.',
  });
  await audit(db, 'incident.created', 'incident', id, {
    title: input.title,
    severity: input.severity,
    source: input.source,
  });
  const incident = await getIncident(id, db);
  if (!incident) throw new Error('Incident could not be read after creation');
  await deliverAlert(incident, db);
  return incident;
}

export async function getIncident(
  id: string,
  dbOverride?: Database,
): Promise<(IncidentRow & { events: unknown[] }) | null> {
  const db = dbOverride ?? (await getDb());
  const result = await db.query<IncidentRow>(
    `SELECT i.*, n.name AS network_name, p.name AS provider_name, p.external_id AS provider_external_id
     FROM incidents i
     LEFT JOIN networks n ON n.id = i.network_id
     LEFT JOIN providers p ON p.id = i.provider_id
     WHERE i.id = $1`,
    [id],
  );
  const incident = result.rows[0];
  if (!incident) return null;
  const events = await db.query(
    `SELECT id, event_type, actor, note, data, created_at
     FROM incident_events WHERE incident_id=$1 ORDER BY created_at ASC, id ASC`,
    [id],
  );
  return { ...incident, events: events.rows };
}

export async function listIncidents(
  filters: {
    status?: string;
    severity?: string;
    networkId?: string;
    providerId?: string;
    search?: string;
    limit?: number;
  } = {},
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (filters.status) {
    if (filters.status === 'active') {
      where.push(`i.status NOT IN ('resolved','closed')`);
    } else if (filters.status === 'closed') {
      where.push(`i.status IN ('resolved','closed')`);
    } else {
      add('i.status = ?', filters.status);
    }
  }
  if (filters.severity) add('i.severity = ?', filters.severity);
  if (filters.networkId) add('i.network_id = ?', filters.networkId);
  if (filters.providerId) add('i.provider_id = ?', filters.providerId);
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const placeholder = `$${params.length}`;
    where.push(
      `(i.title ILIKE ${placeholder} OR i.summary ILIKE ${placeholder} OR p.name ILIKE ${placeholder} OR p.external_id ILIKE ${placeholder})`,
    );
  }
  params.push(filters.limit ?? 100);
  const result = await db.query<IncidentRow & { event_count: string }>(
    `SELECT i.*, n.name AS network_name, p.name AS provider_name, p.external_id AS provider_external_id,
       (SELECT count(*)::text FROM incident_events e WHERE e.incident_id=i.id) AS event_count
     FROM incidents i
     LEFT JOIN networks n ON n.id=i.network_id
     LEFT JOIN providers p ON p.id=i.provider_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY
       CASE i.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 WHEN 'investigating' THEN 2 WHEN 'mitigated' THEN 3 WHEN 'resolved' THEN 4 ELSE 5 END,
       i.started_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}

export async function actOnIncident(
  id: string,
  action: string,
  input: {
    note?: string;
    actor?: string;
    assignee?: string;
    remediation?: string;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
  } = {},
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const existing = await db.query<IncidentRow>('SELECT * FROM incidents WHERE id=$1', [id]);
  const incident = existing.rows[0];
  if (!incident) return { error: 'not_found' as const };
  const actor = input.actor ?? 'operator@computepulse.local';
  const note = input.note?.trim() || null;
  const now = new Date().toISOString();

  if (action === 'note') {
    if (!note) return { error: 'note_required' as const };
    await insertEvent(db, id, 'note', actor, note);
    await db.query('UPDATE incidents SET updated_at=$2 WHERE id=$1', [id, now]);
  } else if (action === 'assign') {
    if (!input.assignee) return { error: 'assignee_required' as const };
    await db.query('UPDATE incidents SET assigned_to=$2, updated_at=$3 WHERE id=$1', [
      id,
      input.assignee,
      now,
    ]);
    await insertEvent(db, id, 'assigned', actor, note, { assignee: input.assignee });
  } else if (action === 'acknowledge') {
    if (incident.status === 'closed') return { error: 'closed_incident' as const };
    await db.query(
      `UPDATE incidents SET status='acknowledged', acknowledged_at=COALESCE(acknowledged_at,$2), updated_at=$2 WHERE id=$1`,
      [id, now],
    );
    await insertEvent(db, id, 'acknowledged', actor, note);
  } else if (action === 'investigate') {
    if (incident.status === 'closed') return { error: 'closed_incident' as const };
    await db.query(
      `UPDATE incidents SET status='investigating', updated_at=$2 WHERE id=$1`,
      [id, now],
    );
    await insertEvent(db, id, 'investigation', actor, note);
  } else if (action === 'mitigate') {
    if (!input.remediation) return { error: 'remediation_required' as const };
    if (['resolved', 'closed'].includes(incident.status)) {
      return { error: 'already_resolved' as const };
    }
    await db.query(
      `UPDATE incidents SET status='mitigated', remediation=$2, updated_at=$3 WHERE id=$1`,
      [id, input.remediation, now],
    );
    await insertEvent(db, id, 'mitigation', actor, note, {
      remediation: input.remediation,
    });
  } else if (action === 'resolve') {
    if (incident.status === 'closed') return { error: 'closed_incident' as const };
    await db.query(
      `UPDATE incidents SET status='resolved', resolved_at=$2, remediation=COALESCE($3,remediation), updated_at=$2 WHERE id=$1`,
      [id, now, input.remediation ?? null],
    );
    await insertEvent(db, id, 'resolved', actor, note, {
      remediation: input.remediation ?? null,
    });
  } else if (action === 'close') {
    if (incident.status !== 'resolved') return { error: 'must_resolve_first' as const };
    await db.query(
      `UPDATE incidents SET status='closed', closed_at=$2, updated_at=$2 WHERE id=$1`,
      [id, now],
    );
    await insertEvent(db, id, 'closed', actor, note);
  } else if (action === 'severity') {
    if (!input.severity) return { error: 'severity_required' as const };
    await db.query('UPDATE incidents SET severity=$2, updated_at=$3 WHERE id=$1', [
      id,
      input.severity,
      now,
    ]);
    await insertEvent(db, id, 'severity_changed', actor, note, {
      severity: input.severity,
    });
  } else if (action === 'transition') {
    if (!input.status) return { error: 'status_required' as const };
    if (!ALLOWED_TRANSITIONS[incident.status]?.includes(input.status)) {
      return { error: 'invalid_transition' as const, from: incident.status, to: input.status };
    }
    await db.query(
      `UPDATE incidents SET status=$2,
        acknowledged_at = CASE WHEN $2='acknowledged' THEN COALESCE(acknowledged_at,$3) ELSE acknowledged_at END,
        resolved_at = CASE WHEN $2='resolved' THEN COALESCE(resolved_at,$3) ELSE resolved_at END,
        updated_at=$3
       WHERE id=$1`,
      [id, input.status, now],
    );
    await insertEvent(db, id, input.status, actor, note);
  } else {
    return { error: 'unknown_action' as const };
  }

  await audit(db, `incident.${action}`, 'incident', id, {
    action,
    note,
    status: input.status ?? null,
  }, actor);
  return { incident: await getIncident(id, db) };
}

export async function findOpenIncidentBySourceRef(
  sourceRef: string,
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const result = await db.query<IncidentRow>(
    `SELECT * FROM incidents WHERE source_ref=$1 AND status NOT IN ('resolved','closed') ORDER BY started_at DESC LIMIT 1`,
    [sourceRef],
  );
  return result.rows[0] ?? null;
}

export async function seedCorrelatedIncident(db: Database): Promise<IncidentRow | null> {
  const existing = await db.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM incidents',
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return null;
  const provider = await db.query<{
    id: string;
    name: string | null;
    external_id: string;
    host_uri: string | null;
    health_reason: string;
    status_observed_at: string | null;
    network_id: string;
    network_name: string;
    source_url: string | null;
  }>(
    `SELECT p.id, p.name, p.external_id, p.host_uri, p.health_reason, p.status_observed_at,
            p.network_id, n.name AS network_name, p.source_url
     FROM providers p JOIN networks n ON n.id=p.network_id
     WHERE p.health_state='down' AND p.network_id='akash-mainnet'
     ORDER BY p.last_seen_at DESC, p.external_id ASC
     LIMIT 1`,
  );
  const row = provider.rows[0];
  if (!row) return null;
  const label =
    row.name?.trim() || `${row.external_id.slice(0, 18)}…`;
  const observed = row.status_observed_at
    ? new Date(row.status_observed_at).toISOString()
    : new Date().toISOString();
  return createIncident(
    {
      title: `Provider reported offline: ${label}`,
      summary: `${row.network_name} reports this provider offline in the collected provider index. The source returned this state at ${observed}. The actual outage onset is not established by the source and is not inferred.`,
      severity: 'critical',
      networkId: row.network_id,
      providerId: row.id,
      source: 'incident_correlation',
      sourceRef: row.id,
      sourceUrl: row.source_url,
      sourceObservedAt: observed,
      actor: 'correlation-engine',
      metadata: {
        rule: 'source_observed_offline',
        provider_external_id: row.external_id,
        provider_endpoint_reference: row.host_uri,
        health_reason: row.health_reason,
        evidence: 'reported',
        limitation:
          'The source does not expose outage onset; started_at is the ComputePulse detection time.',
      },
    },
    db,
  );
}

async function deliverAlert(incident: IncidentRow, db: Database) {
  const integrations = await db.query<{
    id: string;
    kind: string;
    name: string;
    status: string;
    config: Record<string, unknown>;
  }>(
    `SELECT id, kind, name, status, config FROM integrations
     WHERE organisation_id=$1 AND kind IN ('webhook','email')`,
    [env.DEMO_ORG_ID],
  );

  // In-app delivery is always recorded so the operational timeline is complete.
  await db.query(
    `INSERT INTO alert_deliveries
      (id, rule_id, incident_id, channel, destination, status, attempts, payload, created_at, delivered_at)
     VALUES ($1,NULL,$2,'in_app','Operations timeline','delivered',1,$3::jsonb,$4,$4)`,
    [
      uuid('del'),
      incident.id,
      JSON.stringify({
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        network_id: incident.network_id,
        provider_id: incident.provider_id,
      }),
      new Date().toISOString(),
    ],
  );

  for (const integration of integrations.rows) {
    if (integration.status !== 'configured') {
      await db.query(
        `INSERT INTO alert_deliveries
          (id, rule_id, incident_id, channel, destination, status, attempts, last_error, payload, created_at)
         VALUES ($1,NULL,$2,$3,NULL,'skipped',0,$4,$5::jsonb,$6)`,
        [
          uuid('del'),
          incident.id,
          integration.kind,
          `${integration.name} is not configured`,
          JSON.stringify({ title: incident.title }),
          new Date().toISOString(),
        ],
      );
      continue;
    }

    if (integration.kind === 'webhook') {
      const config = integration.config ?? {};
      const destination =
        typeof config.webhook_url === 'string' ? config.webhook_url : '';
      if (!destination) {
        await db.query(
          `INSERT INTO alert_deliveries
            (id, rule_id, incident_id, channel, destination, status, attempts, last_error, payload, created_at)
           VALUES ($1,NULL,$2,'webhook',NULL,'skipped',0,'No webhook URL configured',$3::jsonb,$4)`,
          [
            uuid('del'),
            incident.id,
            JSON.stringify({ title: incident.title }),
            new Date().toISOString(),
          ],
        );
        continue;
      }
      const deliveredAt = new Date().toISOString();
      const payload = JSON.stringify({
        event: 'incident.created',
        incident_id: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        network_id: incident.network_id,
        provider_id: incident.provider_id,
        source: incident.source,
        source_url: incident.source_url,
        created_at: deliveredAt,
      });
      try {
        const secret =
          typeof config.secret === 'string' && config.secret.length > 0
            ? config.secret
            : typeof config.secret_encrypted === 'string'
              ? decryptJson<{ secret: string }>(config.secret_encrypted).secret
              : env.WEBHOOK_SECRET;
        const result = await safeFetch(destination, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-computepulse-event': 'incident.created',
            ...(secret
              ? {
                  'x-computepulse-signature': `sha256=${hmacSha256Hex(payload, secret)}`,
                }
              : {}),
          },
          body: payload,
          timeoutMs: 10_000,
        });
        await db.query(
          `INSERT INTO alert_deliveries
            (id, rule_id, incident_id, channel, destination, status, attempts, payload, created_at, delivered_at)
           VALUES ($1,NULL,$2,'webhook',$3,$4,1,$5::jsonb,$6,$6)`,
          [
            uuid('del'),
            incident.id,
            destination,
            result.statusCode >= 200 && result.statusCode < 300 ? 'delivered' : 'failed',
            payload,
            deliveredAt,
          ],
        );
      } catch (error) {
        await db.query(
          `INSERT INTO alert_deliveries
            (id, rule_id, incident_id, channel, destination, status, attempts, last_error, payload, created_at)
           VALUES ($1,NULL,$2,'webhook',$3,'failed',1,$4,$5::jsonb,$6)`,
          [
            uuid('del'),
            incident.id,
            destination,
            error instanceof Error ? error.message : String(error),
            payload,
            new Date().toISOString(),
          ],
        );
      }
    }

    if (integration.kind === 'email') {
      await db.query(
        `INSERT INTO alert_deliveries
          (id, rule_id, incident_id, channel, destination, status, attempts, last_error, payload, created_at)
         VALUES ($1,NULL,$2,'email',NULL,'skipped',0,$3,$4::jsonb,$5)`,
        [
          uuid('del'),
          incident.id,
          env.SMTP_URL
            ? 'SMTP transport is configured but no recipient preference is set for this rule'
            : 'SMTP transport is not configured',
          JSON.stringify({ title: incident.title }),
          new Date().toISOString(),
        ],
      );
    }
  }
}

export function incidentSourceCommitment(incident: IncidentRow): string {
  return sha256Hex(
    JSON.stringify({
      id: incident.id,
      summary: incident.summary,
      source: incident.source,
      source_url: incident.source_url,
      source_observed_at: iso(incident.source_observed_at),
      provider_id: incident.provider_id,
      network_id: incident.network_id,
    }),
  );
}
