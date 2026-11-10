import type { Database } from '../db/client.js';
import { getDb } from '../db/client.js';
import { getNetworkSummaries } from './networks.js';
import { getCollectorStatus } from './collector.js';

export async function getOverview(dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const [
    networks,
    providerTotals,
    evidenceMix,
    monitorTotals,
    incidentTotals,
    collections,
    observationStats,
    latestIncidents,
    alertStats,
    integrationRows,
    coverageRows,
  ] = await Promise.all([
    getNetworkSummaries(db),
    db.query<{ total: string; healthy: string; degraded: string; down: string; unknown: string }>(
      `SELECT count(*)::text AS total,
         count(*) FILTER (WHERE health_state='healthy')::text AS healthy,
         count(*) FILTER (WHERE health_state='degraded')::text AS degraded,
         count(*) FILTER (WHERE health_state='down')::text AS down,
         count(*) FILTER (WHERE health_state='unknown')::text AS unknown
       FROM providers`,
    ),
    db.query<{ evidence: string; count: string }>(
      `SELECT capacity_evidence AS evidence, count(*)::text AS count
       FROM providers GROUP BY capacity_evidence ORDER BY count DESC`,
    ),
    db.query<{ total: string; up: string; down: string; pending: string; availability_24h: number | null }>(
      `SELECT count(*)::text AS total,
         count(*) FILTER (WHERE last_status='up')::text AS up,
         count(*) FILTER (WHERE last_status='down')::text AS down,
         count(*) FILTER (WHERE last_status='pending')::text AS pending,
         avg(CASE WHEN c.total > 0 THEN c.success::double precision / c.total END) AS availability_24h
       FROM monitors m
       LEFT JOIN LATERAL (
         SELECT count(*) AS total, count(*) FILTER (WHERE success) AS success
         FROM monitor_checks mc
         WHERE mc.monitor_id=m.id AND mc.checked_at > now() - interval '24 hours'
       ) c ON true`,
    ),
    db.query<{ total: string; active: string; critical: string }>(
      `SELECT count(*)::text AS total,
         count(*) FILTER (WHERE status NOT IN ('resolved','closed'))::text AS active,
         count(*) FILTER (WHERE status NOT IN ('resolved','closed') AND severity='critical')::text AS critical
       FROM incidents`,
    ),
    db.query<{ total: string; succeeded: string; failed: string; degraded: string; avg_latency_ms: number | null }>(
      `SELECT count(*)::text AS total,
         count(*) FILTER (WHERE status='success')::text AS succeeded,
         count(*) FILTER (WHERE status='failed')::text AS failed,
         count(*) FILTER (WHERE status='degraded')::text AS degraded,
         avg(source_latency_ms) AS avg_latency_ms
       FROM collection_runs WHERE started_at > now() - interval '24 hours'`,
    ),
    db.query<{ total: string; last_24h: string; providers_with_metrics: string }>(
      `SELECT count(*)::text AS total,
         count(*) FILTER (WHERE observed_at > now() - interval '24 hours')::text AS last_24h,
         count(DISTINCT provider_id)::text AS providers_with_metrics
       FROM observations`,
    ),
    db.query<Record<string, unknown>>(
      `SELECT i.id, i.title, i.severity, i.status, i.started_at, i.detected_at,
         i.source, i.network_id, n.name AS network_name, p.name AS provider_name,
         p.external_id AS provider_external_id, i.anchor_status
       FROM incidents i
       LEFT JOIN networks n ON n.id=i.network_id
       LEFT JOIN providers p ON p.id=i.provider_id
       ORDER BY
         CASE i.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 WHEN 'investigating' THEN 2 WHEN 'mitigated' THEN 3 ELSE 4 END,
         i.started_at DESC
       LIMIT 8`,
    ),
    db.query<{ total: string; delivered: string; failed: string; skipped: string }>(
      `SELECT count(*)::text AS total,
         count(*) FILTER (WHERE status='delivered')::text AS delivered,
         count(*) FILTER (WHERE status='failed')::text AS failed,
         count(*) FILTER (WHERE status='skipped')::text AS skipped
       FROM alert_deliveries WHERE created_at > now() - interval '7 days'`,
    ),
    db.query<Record<string, unknown>>(
      `SELECT id, kind, name, status, last_sync_at FROM integrations ORDER BY kind`,
    ),
    db.query<{ network_id: string; metric_key: string; coverage: string }>(
      `SELECT network_id, metric_key,
         (count(DISTINCT floor(extract(epoch FROM observed_at) / 300))::text) AS coverage
       FROM observations
       WHERE observed_at > now() - interval '6 hours' AND provider_id IS NULL
       GROUP BY network_id, metric_key`,
    ),
  ]);

  const providers = providerTotals.rows[0] ?? {
    total: '0',
    healthy: '0',
    degraded: '0',
    down: '0',
    unknown: '0',
  };
  const monitors = monitorTotals.rows[0] ?? {
    total: '0',
    up: '0',
    down: '0',
    pending: '0',
    availability_24h: null,
  };
  const incidents = incidentTotals.rows[0] ?? {
    total: '0',
    active: '0',
    critical: '0',
  };
  const runs = collections.rows[0] ?? {
    total: '0',
    succeeded: '0',
    failed: '0',
    degraded: '0',
    avg_latency_ms: null,
  };

  return {
    generatedAt: new Date().toISOString(),
    networks,
    providerCounts: {
      total: Number(providers.total),
      healthy: Number(providers.healthy),
      degraded: Number(providers.degraded),
      down: Number(providers.down),
      unknown: Number(providers.unknown),
      note:
        'Provider states are not uniform: Akash exposes online flags, while Flux does not expose liveness. These counts are not a network health score.',
    },
    evidenceMix: evidenceMix.rows.map((row) => ({
      evidence: row.evidence,
      count: Number(row.count),
    })),
    monitors: {
      total: Number(monitors.total),
      up: Number(monitors.up),
      down: Number(monitors.down),
      pending: Number(monitors.pending),
      availability24h: monitors.availability_24h,
    },
    incidents: {
      total: Number(incidents.total),
      active: Number(incidents.active),
      critical: Number(incidents.critical),
    },
    latestIncidents: latestIncidents.rows,
    collection: {
      windowHours: 24,
      runs: Number(runs.total),
      succeeded: Number(runs.succeeded),
      failed: Number(runs.failed),
      degraded: Number(runs.degraded),
      avgLatencyMs: runs.avg_latency_ms,
    },
    observations: {
      total: Number(observationStats.rows[0]?.total ?? 0),
      last24h: Number(observationStats.rows[0]?.last_24h ?? 0),
      providersWithMetrics: Number(
        observationStats.rows[0]?.providers_with_metrics ?? 0,
      ),
    },
    alertDeliveries: alertStats.rows[0] ?? {
      total: '0',
      delivered: '0',
      failed: '0',
      skipped: '0',
    },
    integrations: integrationRows.rows,
    collectionStatus: await getCollectorStatus(),
    networkMetricCoverage: coverageRows.rows,
    disclaimer:
      'ComputePulse reports source-specific evidence. There is no universal network health percentage because network sources expose different signals.',
  };
}
