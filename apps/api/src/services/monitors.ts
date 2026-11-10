import { hostname } from 'node:os';
import type { Database } from '../db/client.js';
import { getDb } from '../db/client.js';
import { env } from '../env.js';
import { decryptJson } from '../lib/crypto.js';
import { safeFetch } from '../lib/ssrf.js';
import { uuid } from '../lib/ids.js';
import { redactSecrets } from '../lib/crypto.js';
import { observeMonitorMetrics } from '../observability/metrics.js';
import {
  actOnIncident,
  audit,
  createIncident,
  findOpenIncidentBySourceRef,
} from './incidents.js';

const workerId = `${hostname()}-${process.pid}`;

interface MonitorRow {
  id: string;
  organisation_id: string;
  network_id: string | null;
  provider_id: string | null;
  name: string;
  kind: string;
  target_url: string;
  method: string;
  request_body: string | null;
  expected_status: number;
  expected_body_contains: string | null;
  headers_encrypted: string | null;
  auth_type: string;
  interval_seconds: number;
  timeout_ms: number;
  retries: number;
  enabled: boolean;
  last_checked_at: string | null;
  last_status: string;
  last_latency_ms: number | null;
  last_status_code: number | null;
  last_error: string | null;
  consecutive_failures: number;
}

export interface MonitorCheckResult {
  monitorId: string;
  success: boolean;
  attempts: number;
  latencyMs: number | null;
  statusCode: number | null;
  error: string | null;
  checkedAt: string;
}

async function updateFailureIncident(
  db: Database,
  monitor: MonitorRow,
  result: MonitorCheckResult,
) {
  if (result.success) {
    if (monitor.consecutive_failures >= 2) {
      const incident = await findOpenIncidentBySourceRef(`monitor:${monitor.id}`, db);
      if (incident) {
        await actOnIncident(
          incident.id,
          'note',
          {
            actor: 'alert-engine',
            note: `Endpoint recovered: the monitor succeeded in ${result.latencyMs ?? '—'} ms after ${monitor.consecutive_failures} consecutive failures. Recovery does not auto-close this incident; an operator must verify and resolve it.`,
          },
          db,
        );
        await db.query(
          `INSERT INTO alert_deliveries
            (id, rule_id, incident_id, channel, destination, status, attempts, payload, created_at, delivered_at)
           VALUES ($1,NULL,$2,'in_app','Operations timeline','delivered',1,$3::jsonb,$4,$4)`,
          [
            uuid('del'),
            incident.id,
            JSON.stringify({
              event: 'monitor.recovered',
              monitor: monitor.name,
              latency_ms: result.latencyMs,
            }),
            new Date().toISOString(),
          ],
        );
        await audit(
          db,
          'alert.recovery',
          'monitor',
          monitor.id,
          { incident_id: incident.id, latency_ms: result.latencyMs },
          'alert-engine',
        );
      }
    }
    return;
  }

  if (monitor.consecutive_failures + 1 < 2) return;
  const existing = await findOpenIncidentBySourceRef(`monitor:${monitor.id}`, db);
  if (existing) return;

  const incident = await createIncident(
    {
      title: `Endpoint monitor failing: ${monitor.name}`,
      summary: `The endpoint monitor recorded ${monitor.consecutive_failures + 1} consecutive failed checks. Last error: ${result.error ?? 'unknown error'}. Source: ComputePulse monitor worker. This incident describes an observed endpoint check failure, not provider-wide reliability.`,
      severity: 'critical',
      networkId: monitor.network_id,
      providerId: monitor.provider_id,
      source: 'endpoint_monitor',
      sourceRef: `monitor:${monitor.id}`,
      sourceUrl: monitor.target_url,
      sourceObservedAt: result.checkedAt,
      actor: 'alert-engine',
      metadata: {
        monitor_id: monitor.id,
        monitor_kind: monitor.kind,
        target_url: monitor.target_url,
        consecutive_failures: monitor.consecutive_failures + 1,
        last_error: result.error,
        measurement_method: `${monitor.method} request with ${monitor.timeout_ms}ms timeout`,
        limitation:
          'A failed HTTP check does not prove provider reliability, workload execution quality or full-service outage.',
      },
    },
    db,
  );
  await db.query(
    `UPDATE alert_rules SET last_fired_at=$1 WHERE id='rule_monitor_failure'`,
    [new Date().toISOString()],
  );
  await audit(
    db,
    'alert.fired',
    'monitor',
    monitor.id,
    { incident_id: incident.id, rule: 'rule_monitor_failure' },
    'alert-engine',
  );
}

export async function runMonitor(
  monitorId: string,
  trigger = 'manual',
  dbOverride?: Database,
): Promise<MonitorCheckResult> {
  const db = dbOverride ?? (await getDb());
  const monitorResult = await db.query<MonitorRow>(
    'SELECT * FROM monitors WHERE id=$1',
    [monitorId],
  );
  const monitor = monitorResult.rows[0];
  if (!monitor) throw new Error('Monitor not found');
  if (!monitor.enabled && trigger !== 'manual') {
    throw new Error('Monitor is disabled');
  }

  let headers: Record<string, string> = {};
  if (monitor.headers_encrypted) {
    try {
      headers = decryptJson<Record<string, string>>(monitor.headers_encrypted);
    } catch {
      throw new Error('Stored monitor headers could not be decrypted');
    }
  }
  if (
    monitor.method === 'POST' &&
    monitor.request_body &&
    !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
  ) {
    headers['content-type'] = 'application/json';
  }

  let attempts = 0;
  let lastError: string | null = null;
  let lastStatusCode: number | null = null;
  let lastLatency: number | null = null;
  let success = false;

  for (let attempt = 1; attempt <= Math.max(1, monitor.retries + 1); attempt += 1) {
    attempts = attempt;
    try {
      const result = await safeFetch(monitor.target_url, {
        method: monitor.method,
        headers,
        body: monitor.method === 'GET' ? undefined : monitor.request_body ?? undefined,
        timeoutMs: monitor.timeout_ms,
        // Provider indexes can legitimately exceed 1 MiB. Keep a bounded
        // response while allowing the documented source APIs to be checked.
        maxBytes: 12 * 1024 * 1024,
      });
      lastStatusCode = result.statusCode;
      lastLatency = result.latencyMs;
      lastError = null;
      if (result.statusCode !== monitor.expected_status) {
        lastError = `Expected HTTP ${monitor.expected_status}, received ${result.statusCode}`;
        continue;
      }
      if (
        monitor.expected_body_contains &&
        !result.body.includes(monitor.expected_body_contains)
      ) {
        lastError = `Response body did not contain expected marker "${monitor.expected_body_contains}"`;
        continue;
      }
      success = true;
      break;
    } catch (error) {
      lastLatency = null;
      lastStatusCode = null;
      lastError = redactSecrets(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const checkedAt = new Date().toISOString();
  const failures = success ? 0 : monitor.consecutive_failures + 1;
  await db.query(
    `INSERT INTO monitor_checks
      (monitor_id, checked_at, latency_ms, status_code, success, attempt, error, source, worker_id, response_bytes, freshness_seconds)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      monitor.id,
      checkedAt,
      lastLatency,
      lastStatusCode,
      success,
      attempts,
      lastError,
      trigger,
      workerId,
      null,
      0,
    ],
  );
  await db.query(
    `UPDATE monitors SET
      last_checked_at=$2,
      last_status=$3,
      last_latency_ms=$4,
      last_status_code=$5,
      last_error=$6,
      consecutive_failures=$7,
      updated_at=$2
     WHERE id=$1`,
    [
      monitor.id,
      checkedAt,
      success ? 'up' : 'down',
      lastLatency,
      lastStatusCode,
      lastError,
      failures,
    ],
  );
  observeMonitorMetrics(monitor, success, lastLatency);
  await updateFailureIncident(db, monitor, {
    monitorId: monitor.id,
    success,
    attempts,
    latencyMs: lastLatency,
    statusCode: lastStatusCode,
    error: lastError,
    checkedAt,
  });

  return {
    monitorId: monitor.id,
    success,
    attempts,
    latencyMs: lastLatency,
    statusCode: lastStatusCode,
    error: lastError,
    checkedAt,
  };
}

export async function runDueMonitors(trigger = 'scheduler') {
  const db = await getDb();
  const result = await db.query<{ id: string }>(
    `SELECT id FROM monitors
     WHERE enabled=true
       AND (last_checked_at IS NULL OR last_checked_at <= now() - make_interval(secs => interval_seconds))
     ORDER BY COALESCE(last_checked_at, '1970-01-01'::timestamptz) ASC
     LIMIT 20`,
  );
  const outcomes: MonitorCheckResult[] = [];
  for (const row of result.rows) {
    try {
      outcomes.push(await runMonitor(row.id, trigger, db));
    } catch (error) {
      outcomes.push({
        monitorId: row.id,
        success: false,
        attempts: 0,
        latencyMs: null,
        statusCode: null,
        error: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      });
    }
  }
  return outcomes;
}

export async function listMonitors(dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const result = await db.query(
    `SELECT m.*, n.name AS network_name, p.name AS provider_name, p.external_id AS provider_external_id,
       (SELECT row_to_json(c) FROM monitor_checks c WHERE c.monitor_id=m.id ORDER BY c.checked_at DESC LIMIT 1) AS latest_check,
       (SELECT count(*)::text FROM monitor_checks c WHERE c.monitor_id=m.id AND c.checked_at > now() - interval '24 hours') AS checks_24h,
       (SELECT count(*)::text FROM monitor_checks c WHERE c.monitor_id=m.id AND c.success=true AND c.checked_at > now() - interval '24 hours') AS successful_24h
     FROM monitors m
     LEFT JOIN networks n ON n.id=m.network_id
     LEFT JOIN providers p ON p.id=m.provider_id
     ORDER BY m.created_at ASC`,
  );
  return result.rows.map((row: Record<string, unknown>) => {
    const checks = Number(row.checks_24h ?? 0);
    const successful = Number(row.successful_24h ?? 0);
    const hasCredentials = Boolean(row.headers_encrypted);
    return {
      ...row,
      headers_encrypted: undefined,
      has_credentials: hasCredentials,
      availability_24h: checks > 0 ? successful / checks : null,
      checks_24h: checks,
      successful_24h: successful,
    };
  });
}

export async function getMonitorChecks(
  monitorId: string,
  hours = 24,
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const result = await db.query(
    `SELECT checked_at, latency_ms, status_code, success, attempt, error, source
     FROM monitor_checks
     WHERE monitor_id=$1 AND checked_at > now() - make_interval(hours => $2)
     ORDER BY checked_at ASC`,
    [monitorId, Math.min(Math.max(hours, 1), 24 * 30)],
  );
  return result.rows;
}


export interface CreateMonitorInput {
  name: string;
  networkId?: string | null;
  providerId?: string | null;
  kind?: string;
  targetUrl: string;
  method?: string;
  requestBody?: string | null;
  expectedStatus?: number;
  expectedBodyContains?: string | null;
  headers?: Record<string, string> | null;
  intervalSeconds?: number;
  timeoutMs?: number;
  retries?: number;
  enabled?: boolean;
}

export async function createMonitor(
  input: CreateMonitorInput,
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const { assertSafeHttpUrl } = await import('../lib/ssrf.js');
  await assertSafeHttpUrl(input.targetUrl);
  const { encryptJson } = await import('../lib/crypto.js');
  const id = uuid('mon');
  const encryptedHeaders =
    input.headers && Object.keys(input.headers).length > 0
      ? encryptJson(input.headers)
      : null;
  await db.query(
    `INSERT INTO monitors
      (id, organisation_id, network_id, provider_id, name, kind, target_url, method, request_body,
       expected_status, expected_body_contains, headers_encrypted, auth_type, interval_seconds,
       timeout_ms, retries, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      id,
      env.DEMO_ORG_ID,
      input.networkId ?? null,
      input.providerId ?? null,
      input.name,
      input.kind ?? 'http',
      input.targetUrl,
      input.method ?? 'GET',
      input.requestBody ?? null,
      input.expectedStatus ?? 200,
      input.expectedBodyContains ?? null,
      encryptedHeaders,
      encryptedHeaders ? 'header' : 'none',
      Math.min(86_400, Math.max(30, input.intervalSeconds ?? 300)),
      Math.min(60_000, Math.max(1_000, input.timeoutMs ?? 10_000)),
      Math.min(5, Math.max(0, input.retries ?? 2)),
      input.enabled ?? true,
    ],
  );
  const { audit } = await import('./incidents.js');
  await audit(db, 'monitor.created', 'monitor', id, {
    name: input.name,
    target_url: input.targetUrl,
    network_id: input.networkId ?? null,
    provider_id: input.providerId ?? null,
  });
  return getMonitorDetail(id, db);
}

export async function updateMonitor(
  id: string,
  input: Partial<CreateMonitorInput> & { enabled?: boolean },
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const existing = await db.query<MonitorRow>('SELECT * FROM monitors WHERE id=$1', [id]);
  const monitor = existing.rows[0];
  if (!monitor) return null;
  if (input.targetUrl && input.targetUrl !== monitor.target_url) {
    const { assertSafeHttpUrl } = await import('../lib/ssrf.js');
    await assertSafeHttpUrl(input.targetUrl);
  }
  let encryptedHeaders = monitor.headers_encrypted;
  if (input.headers !== undefined) {
    const { encryptJson } = await import('../lib/crypto.js');
    encryptedHeaders =
      input.headers && Object.keys(input.headers).length > 0
        ? encryptJson(input.headers)
        : null;
  }
  await db.query(
    `UPDATE monitors SET
       name=COALESCE($2,name), network_id=COALESCE($3,network_id),
       provider_id=COALESCE($4,provider_id), target_url=COALESCE($5,target_url),
       method=COALESCE($6,method), request_body=COALESCE($7,request_body),
       expected_status=COALESCE($8,expected_status),
       expected_body_contains=COALESCE($9,expected_body_contains),
       headers_encrypted=$10, auth_type=$11, interval_seconds=COALESCE($12,interval_seconds),
       timeout_ms=COALESCE($13,timeout_ms), retries=COALESCE($14,retries),
       enabled=COALESCE($15,enabled), updated_at=now()
     WHERE id=$1`,
    [
      id,
      input.name ?? null,
      input.networkId ?? null,
      input.providerId ?? null,
      input.targetUrl ?? null,
      input.method ?? null,
      input.requestBody === undefined ? null : input.requestBody,
      input.expectedStatus ?? null,
      input.expectedBodyContains === undefined ? null : input.expectedBodyContains,
      encryptedHeaders,
      encryptedHeaders ? 'header' : 'none',
      input.intervalSeconds ?? null,
      input.timeoutMs ?? null,
      input.retries ?? null,
      input.enabled ?? null,
    ],
  );
  const { audit } = await import('./incidents.js');
  await audit(db, 'monitor.updated', 'monitor', id, {
    enabled: input.enabled ?? null,
    target_url: input.targetUrl ?? null,
  });
  return getMonitorDetail(id, db);
}

export async function getMonitorDetail(
  id: string,
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const result = await db.query<MonitorRow & Record<string, unknown>>(
    `SELECT m.*, n.name AS network_name, p.name AS provider_name,
       p.external_id AS provider_external_id,
       (SELECT count(*)::text FROM monitor_checks c WHERE c.monitor_id=m.id) AS total_checks,
       (SELECT count(*)::text FROM monitor_checks c
         WHERE c.monitor_id=m.id AND c.checked_at > now() - interval '24 hours') AS checks_24h,
       (SELECT count(*)::text FROM monitor_checks c
         WHERE c.monitor_id=m.id AND c.success=true AND c.checked_at > now() - interval '24 hours') AS successful_24h
     FROM monitors m
     LEFT JOIN networks n ON n.id=m.network_id
     LEFT JOIN providers p ON p.id=m.provider_id
     WHERE m.id=$1`,
    [id],
  );
  const monitor = result.rows[0];
  if (!monitor) return null;
  const [checks, incidents] = await Promise.all([
    getMonitorChecks(id, 24, db),
    db.query<Record<string, unknown>>(
      `SELECT id, title, severity, status, started_at, resolved_at, source_ref
       FROM incidents WHERE source_ref=$1 ORDER BY started_at DESC LIMIT 10`,
      [`monitor:${id}`],
    ),
  ]);
  const latest = checks[checks.length - 1] as Record<string, unknown> | undefined;
  const { headers_encrypted, ...safe } = monitor;
  return {
    ...safe,
    has_credentials: Boolean(headers_encrypted),
    checks_24h: Number(monitor.checks_24h ?? 0),
    successful_24h: Number(monitor.successful_24h ?? 0),
    availability_24h:
      Number(monitor.checks_24h ?? 0) > 0
        ? Number(monitor.successful_24h ?? 0) / Number(monitor.checks_24h ?? 0)
        : null,
    checks,
    latestCheck: latest ?? null,
    incidents: incidents.rows,
  };
}
