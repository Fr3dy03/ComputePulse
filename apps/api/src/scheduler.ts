import type { FastifyBaseLogger } from 'fastify';
import { getDb } from './db/client.js';
import { env } from './env.js';
import { collectNetwork } from './services/collector.js';
import { runDueMonitors } from './services/monitors.js';

let started = false;
let tickRunning = false;
let timer: NodeJS.Timeout | null = null;
let lastRetentionRun = 0;

async function collectDueNetworks(log: FastifyBaseLogger) {
  if (!env.COLLECTOR_ENABLED) return;
  const db = await getDb();
  const due = await db.query<{
    network_id: string;
    expected_interval_seconds: number;
    last_attempt_at: string | null;
  }>(
    `SELECT network_id, expected_interval_seconds, last_attempt_at
     FROM data_source_status
     WHERE last_attempt_at IS NULL
        OR last_attempt_at <= now() - make_interval(secs => expected_interval_seconds)
     ORDER BY COALESCE(last_attempt_at, '1970-01-01'::timestamptz) ASC`,
  );
  for (const row of due.rows) {
    try {
      log.info({ networkId: row.network_id }, 'scheduled collection starting');
      await collectNetwork(row.network_id, 'scheduler');
    } catch (error) {
      log.error(
        { err: error, networkId: row.network_id },
        'scheduled collection failed',
      );
    }
  }
}

async function applyRetention(log: FastifyBaseLogger) {
  if (Date.now() - lastRetentionRun < 3_600_000) return;
  lastRetentionRun = Date.now();
  const db = await getDb();
  const settings = await db.query<{ key: string; value: number }>(
    `SELECT key, value FROM settings WHERE organisation_id=$1
       AND key IN ('retention.observations_days','retention.monitor_checks_days')`,
    [env.DEMO_ORG_ID],
  );
  const values = new Map(settings.rows.map((row) => [row.key, Number(row.value)]));
  const observationDays = Math.min(
    365,
    Math.max(1, values.get('retention.observations_days') ?? 30),
  );
  const monitorDays = Math.min(
    365,
    Math.max(1, values.get('retention.monitor_checks_days') ?? 14),
  );
  const [observations, checks, deliveries] = await Promise.all([
    db.query(
      `DELETE FROM observations WHERE observed_at < now() - make_interval(days => $1)`,
      [observationDays],
    ),
    db.query(
      `DELETE FROM monitor_checks WHERE checked_at < now() - make_interval(days => $1)`,
      [monitorDays],
    ),
    db.query(
      `DELETE FROM alert_deliveries WHERE created_at < now() - make_interval(days => $1)`,
      [90],
    ),
  ]);
  log.info(
    {
      observationsRetainedDays: observationDays,
      monitorChecksRetainedDays: monitorDays,
      deleted: {
        observations: observations.rowCount,
        monitorChecks: checks.rowCount,
        alertDeliveries: deliveries.rowCount,
      },
    },
    'retention applied',
  );
}

async function refreshStaleness() {
  const db = await getDb();
  await db.query(
    `UPDATE data_source_status SET
       state = CASE
         WHEN last_success_at IS NULL THEN state
         WHEN last_success_at < now() - make_interval(secs => stale_after_seconds) THEN 'stale'
         WHEN consecutive_failures >= 2 THEN 'failing'
         WHEN consecutive_failures = 1 THEN 'degraded'
         ELSE 'active'
       END,
       updated_at = now()
     WHERE last_success_at IS NOT NULL`,
  );
}

async function tick(log: FastifyBaseLogger) {
  if (tickRunning) return;
  tickRunning = true;
  try {
    if (env.MONITOR_SCHEDULER_ENABLED) {
      const outcomes = await runDueMonitors('scheduler');
      if (outcomes.length > 0) {
        log.info({ checked: outcomes.length }, 'endpoint monitors checked');
      }
    }
    await collectDueNetworks(log);
    await refreshStaleness();
    await applyRetention(log);
  } catch (error) {
    log.error({ err: error }, 'scheduler tick failed');
  } finally {
    tickRunning = false;
  }
}

export function startSchedulers(log: FastifyBaseLogger) {
  if (started) return;
  started = true;
  // Stagger the first tick so an API restart does not burst on the sources.
  timer = setInterval(() => void tick(log), env.MONITOR_TICK_MS);
  timer.unref?.();
  setTimeout(() => void tick(log), 15_000).unref?.();
  log.info(
    {
      monitorScheduler: env.MONITOR_SCHEDULER_ENABLED,
      collector: env.COLLECTOR_ENABLED,
      tickMs: env.MONITOR_TICK_MS,
    },
    'schedulers started',
  );
}

export function stopSchedulers() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
