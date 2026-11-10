import type { Database } from '../db/client.js';
import { getDb } from '../db/client.js';
import { getNetworkSummaries } from './networks.js';

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getCapacityOverview(dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const [networkRows, latestRows, historyRows] = await Promise.all([
    getNetworkSummaries(db),
    db.query<Record<string, unknown>>(
      `SELECT c.*, p.name AS provider_name, p.external_id, p.country, p.region,
         n.name AS network_name, n.slug AS network_slug, n.brand_color
       FROM capacity_snapshots c
       JOIN providers p ON p.id=c.provider_id
       JOIN networks n ON n.id=c.network_id
       JOIN (
         SELECT provider_id, max(observed_at) AS latest
         FROM capacity_snapshots GROUP BY provider_id
       ) x ON x.provider_id=c.provider_id AND x.latest=c.observed_at`,
    ),
    db.query<{
      network_id: string;
      bucket: string;
      cpu_available: number | null;
      memory_available: number | null;
      storage_available: number | null;
      gpu_available: number | null;
      providers: number | null;
    }>(
      `SELECT network_id,
         to_timestamp(floor(extract(epoch FROM observed_at) / 3600) * 3600) AS bucket,
         sum(cpu_available_cores) AS cpu_available,
         sum(memory_available_bytes) AS memory_available,
         sum(storage_available_bytes) AS storage_available,
         sum(gpu_available) AS gpu_available,
         count(DISTINCT provider_id) AS providers
       FROM capacity_snapshots
       WHERE observed_at > now() - interval '30 days'
       GROUP BY network_id, bucket ORDER BY bucket ASC`,
    ),
  ]);

  const byNetwork = new Map<string, {
    networkId: string;
    networkName: string;
    slug: string;
    brandColor: string;
    providers: number;
    cpuTotal: number;
    cpuAvailable: number;
    cpuActive: number;
    memoryTotal: number;
    memoryAvailable: number;
    storageTotal: number;
    storageAvailable: number;
    gpuTotal: number;
    gpuAvailable: number;
    gpuModels: Record<string, number>;
    observedAt: string | null;
  }>();

  for (const row of latestRows.rows) {
    const networkId = String(row.network_id);
    const existing = byNetwork.get(networkId) ?? {
      networkId,
      networkName: String(row.network_name),
      slug: String(row.network_slug),
      brandColor: String(row.brand_color),
      providers: 0,
      cpuTotal: 0,
      cpuAvailable: 0,
      cpuActive: 0,
      memoryTotal: 0,
      memoryAvailable: 0,
      storageTotal: 0,
      storageAvailable: 0,
      gpuTotal: 0,
      gpuAvailable: 0,
      gpuModels: {},
      observedAt: null,
    };
    existing.providers += 1;
    existing.cpuTotal += numberOrNull(row.cpu_total_cores) ?? 0;
    existing.cpuAvailable += numberOrNull(row.cpu_available_cores) ?? 0;
    existing.cpuActive += numberOrNull(row.cpu_active_cores) ?? 0;
    existing.memoryTotal += numberOrNull(row.memory_total_bytes) ?? 0;
    existing.memoryAvailable += numberOrNull(row.memory_available_bytes) ?? 0;
    existing.storageTotal += numberOrNull(row.storage_total_bytes) ?? 0;
    existing.storageAvailable += numberOrNull(row.storage_available_bytes) ?? 0;
    existing.gpuTotal += numberOrNull(row.gpu_total) ?? 0;
    existing.gpuAvailable += numberOrNull(row.gpu_available) ?? 0;
    const models = Array.isArray(row.gpu_models) ? row.gpu_models : [];
    for (const model of models) {
      const key =
        typeof model === 'object' && model !== null
          ? String(
              (model as Record<string, unknown>).model ??
                (model as Record<string, unknown>).name ??
                'Unspecified GPU',
            )
          : 'Unspecified GPU';
      existing.gpuModels[key] = (existing.gpuModels[key] ?? 0) + 1;
    }
    if (
      !existing.observedAt ||
      String(row.observed_at) > existing.observedAt
    ) {
      existing.observedAt = String(row.observed_at);
    }
    byNetwork.set(networkId, existing);
  }

  const networks = networkRows.map((network) => ({
    ...network,
    capacity: byNetwork.get(network.id) ?? null,
  }));

  return {
    generatedAt: new Date().toISOString(),
    networks,
    providers: latestRows.rows.map((row) => ({
      providerId: row.provider_id,
      providerName: row.provider_name,
      externalId: row.external_id,
      networkId: row.network_id,
      networkName: row.network_name,
      networkSlug: row.network_slug,
      brandColor: row.brand_color,
      country: row.country,
      region: row.region,
      observedAt: row.observed_at,
      evidence: row.evidence_type,
      cpuTotalCores: numberOrNull(row.cpu_total_cores),
      cpuAvailableCores: numberOrNull(row.cpu_available_cores),
      cpuActiveCores: numberOrNull(row.cpu_active_cores),
      memoryTotalBytes: numberOrNull(row.memory_total_bytes),
      memoryAvailableBytes: numberOrNull(row.memory_available_bytes),
      memoryActiveBytes: numberOrNull(row.memory_active_bytes),
      storageTotalBytes: numberOrNull(row.storage_total_bytes),
      storageAvailableBytes: numberOrNull(row.storage_available_bytes),
      gpuTotal: numberOrNull(row.gpu_total),
      gpuAvailable: numberOrNull(row.gpu_available),
      gpuActive: numberOrNull(row.gpu_active),
      gpuModels: row.gpu_models,
      sourceEndpoint: row.source_endpoint,
    })),
    history: historyRows.rows,
    methodology: {
      evidence: 'reported',
      source: 'Akash Console provider index (stats fields).',
      unitConversions:
        'CPU millicores are divided by 1000. Memory and storage values are bytes.',
      warning:
        'Reported capacity is upstream evidence, not an independent measurement of schedulable resources. Totals should not be read as guaranteed available compute.',
      flux:
        'Flux does not expose capacity in its public node-list API, so Flux capacity is UNAVAILABLE rather than estimated.',
    },
  };
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * p)),
  );
  return sorted[index] ?? null;
}

export async function getBenchmarks(dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const [networks, metricDefinitions, latestNetworkMetrics, providers, coverageRows] =
    await Promise.all([
      getNetworkSummaries(db),
      db.query<Record<string, unknown>>(
        `SELECT * FROM metric_definitions ORDER BY comparability_group, key`,
      ),
      db.query<Record<string, unknown>>(
        `SELECT DISTINCT ON (network_id, metric_key)
           network_id, metric_key, value, unit, observed_at, status, dimensions
         FROM observations
         WHERE provider_id IS NULL
         ORDER BY network_id, metric_key, observed_at DESC`,
      ),
      db.query<{
        network_id: string;
        health_state: string;
        availability_1d: number | null;
        availability_7d: number | null;
        availability_30d: number | null;
        capacity_evidence: string;
      }>(
        `SELECT network_id, health_state, availability_1d, availability_7d,
           availability_30d, capacity_evidence FROM providers`,
      ),
      db.query<{
        network_id: string;
        metric_key: string;
        observations: string;
        first_observed: string | null;
        last_observed: string | null;
      }>(
        `SELECT network_id, metric_key, count(*)::text AS observations,
           min(observed_at)::text AS first_observed, max(observed_at)::text AS last_observed
         FROM observations GROUP BY network_id, metric_key`,
      ),
    ]);

  const latestByNetwork = new Map<string, Map<string, Record<string, unknown>>>();
  for (const row of latestNetworkMetrics.rows) {
    const key = String(row.network_id);
    const map = latestByNetwork.get(key) ?? new Map();
    map.set(String(row.metric_key), row);
    latestByNetwork.set(key, map);
  }

  const providerStats = new Map<string, {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
    unknown: number;
    withAvailability: number;
    availability1d: number[];
    availability7d: number[];
    availability30d: number[];
    capacityEvidence: Record<string, number>;
  }>();
  for (const row of providers.rows) {
    const stats = providerStats.get(row.network_id) ?? {
      total: 0,
      healthy: 0,
      degraded: 0,
      down: 0,
      unknown: 0,
      withAvailability: 0,
      availability1d: [],
      availability7d: [],
      availability30d: [],
      capacityEvidence: {},
    };
    stats.total += 1;
    const state = row.health_state as 'healthy' | 'degraded' | 'down' | 'unknown';
    if (state in stats) stats[state] += 1;
    if (row.availability_1d !== null) {
      stats.withAvailability += 1;
      stats.availability1d.push(row.availability_1d);
    }
    if (row.availability_7d !== null) stats.availability7d.push(row.availability_7d);
    if (row.availability_30d !== null) stats.availability30d.push(row.availability_30d);
    stats.capacityEvidence[row.capacity_evidence] =
      (stats.capacityEvidence[row.capacity_evidence] ?? 0) + 1;
    providerStats.set(row.network_id, stats);
  }

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const definition of metricDefinitions.rows) {
    const group = String(definition.comparability_group);
    const rows = groups.get(group) ?? [];
    rows.push(definition);
    groups.set(group, rows);
  }

  return {
    generatedAt: new Date().toISOString(),
    comparabilityGroups: [...groups.entries()].map(([group, definitions]) => ({
      group,
      definitions,
      note:
        'Metrics are only comparable inside the same group and unit. Network coverage differs and does not imply operator quality.',
    })),
    networks: networks.map((network) => {
      const stats = providerStats.get(network.id);
      const metrics = latestByNetwork.get(network.id) ?? new Map();
      return {
        id: network.id,
        name: network.name,
        slug: network.slug,
        kind: network.kind,
        brandColor: network.brandColor,
        healthState: network.healthState,
        freshness: network.sourceFreshness,
        providerCounts: stats
          ? {
              total: stats.total,
              healthy: stats.healthy,
              degraded: stats.degraded,
              down: stats.down,
              unknown: stats.unknown,
              withAvailability: stats.withAvailability,
              availabilityCoverage:
                stats.total > 0 ? stats.withAvailability / stats.total : null,
            }
          : {
              total: 0,
              healthy: 0,
              degraded: 0,
              down: 0,
              unknown: 0,
              withAvailability: 0,
              availabilityCoverage: null,
            },
        availabilityPercentiles: stats
          ? {
              day1: {
                p50: percentile(stats.availability1d, 0.5),
                p90: percentile(stats.availability1d, 0.9),
                p99: percentile(stats.availability1d, 0.99),
                samples: stats.availability1d.length,
              },
              day7: {
                p50: percentile(stats.availability7d, 0.5),
                p90: percentile(stats.availability7d, 0.9),
                p99: percentile(stats.availability7d, 0.99),
                samples: stats.availability7d.length,
              },
              day30: {
                p50: percentile(stats.availability30d, 0.5),
                p90: percentile(stats.availability30d, 0.9),
                p99: percentile(stats.availability30d, 0.99),
                samples: stats.availability30d.length,
              },
            }
          : null,
        capacityEvidence: stats?.capacityEvidence ?? {},
        metrics: [...metrics.values()].map((row) => ({
          key: row.metric_key,
          value: row.value,
          unit: row.unit,
          observedAt: row.observed_at,
          evidence: row.status,
        })),
        coverage: coverageRows.rows
          .filter((row) => row.network_id === network.id)
          .map((row) => ({
            metricKey: row.metric_key,
            observations: Number(row.observations),
            firstObserved: row.first_observed,
            lastObserved: row.last_observed,
          })),
      };
    }),
    caveats: [
      'Source APIs differ in payload size, caching and collection method. Source latency is only compared within the documented collection method.',
      'Akash exposes source-reported uptime windows. Flux exposes no liveness field, so its provider health is UNAVAILABLE.',
      'Capacity is provider-reported for Akash and unavailable for Flux. It is not verified schedulable capacity.',
      'No composite provider score is calculated. A single ranking would hide incompatible evidence types.',
    ],
  };
}

export async function getReports(
  options: { days?: number } = {},
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const days = Math.min(90, Math.max(1, options.days ?? 7));
  const [
    networks,
    runs,
    monitors,
    incidents,
    deliveries,
    observationStats,
    capacityStats,
    auditRows,
  ] = await Promise.all([
    getNetworkSummaries(db),
    db.query<Record<string, unknown>>(
      `SELECT network_id, status, count(*)::text AS count, avg(source_latency_ms) AS avg_latency,
         sum(providers_seen)::text AS providers_seen, sum(observations_written)::text AS observations_written
       FROM collection_runs
       WHERE started_at > now() - make_interval(days => $1)
       GROUP BY network_id, status ORDER BY network_id, status`,
      [days],
    ),
    db.query<Record<string, unknown>>(
      `SELECT m.id, m.name, m.network_id, count(c.id)::text AS checks,
         count(c.id) FILTER (WHERE c.success)::text AS successful,
         avg(c.latency_ms) AS avg_latency
       FROM monitors m
       LEFT JOIN monitor_checks c ON c.monitor_id=m.id
         AND c.checked_at > now() - make_interval(days => $1)
       GROUP BY m.id, m.name, m.network_id ORDER BY m.name`,
      [days],
    ),
    db.query<Record<string, unknown>>(
      `SELECT severity, status, count(*)::text AS count
       FROM incidents WHERE started_at > now() - make_interval(days => $1)
       GROUP BY severity, status ORDER BY severity, status`,
      [days],
    ),
    db.query<Record<string, unknown>>(
      `SELECT channel, status, count(*)::text AS count
       FROM alert_deliveries WHERE created_at > now() - make_interval(days => $1)
       GROUP BY channel, status ORDER BY channel, status`,
      [days],
    ),
    db.query<{ network_id: string; metric_key: string; observations: string; last_observed: string | null }>(
      `SELECT network_id, metric_key, count(*)::text AS observations, max(observed_at)::text AS last_observed
       FROM observations WHERE observed_at > now() - make_interval(days => $1)
       GROUP BY network_id, metric_key ORDER BY network_id, metric_key`,
      [days],
    ),
    db.query<{ network_id: string; evidence: string; providers: string }>(
      `SELECT network_id, capacity_evidence AS evidence, count(*)::text AS providers
       FROM providers GROUP BY network_id, capacity_evidence ORDER BY network_id`,
    ),
    db.query<Record<string, unknown>>(
      `SELECT action, count(*)::text AS count
       FROM audit_logs WHERE created_at > now() - make_interval(days => $1)
       GROUP BY action ORDER BY count DESC LIMIT 20`,
      [days],
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    windowDays: days,
    title: `ComputePulse operational evidence report (${days}d)`,
    networks: networks.map((network) => ({
      id: network.id,
      name: network.name,
      kind: network.kind,
      healthState: network.healthState,
      freshness: network.sourceFreshness,
      providerCount: network.providerCount,
      activeIncidents: network.activeIncidents,
      monitors: {
        total: network.monitoredEndpoints,
        healthy: network.healthyEndpoints,
        failed: network.failedEndpoints,
      },
      runs: runs.rows.filter((row) => row.network_id === network.id),
      observationCoverage: observationStats.rows.filter(
        (row) => row.network_id === network.id,
      ),
      capacityEvidence: capacityStats.rows.filter(
        (row) => row.network_id === network.id,
      ),
    })),
    monitors: monitors.rows.map((row) => ({
      ...row,
      checks: Number(row.checks ?? 0),
      successful: Number(row.successful ?? 0),
      availability:
        Number(row.checks ?? 0) > 0
          ? Number(row.successful ?? 0) / Number(row.checks ?? 0)
          : null,
    })),
    incidents: incidents.rows,
    alertDeliveries: deliveries.rows,
    auditActivity: auditRows.rows,
    notes: [
      'A failed check or an offline provider report is not a universal availability measurement.',
      'Missing observations are reported as gaps; they are never imputed as zero.',
      'Report data is generated from persisted observations and monitor checks at the time shown above.',
    ],
  };
}
