import type { Database } from '../db/client.js';
import { getDb } from '../db/client.js';
import { describeFreshness } from '../lib/time.js';

export interface ProviderListFilters {
  networkId?: string;
  health?: string;
  evidence?: string;
  search?: string;
  country?: string;
  region?: string;
  hasIncident?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
  availabilityWindow?: string;
}

const SORTABLE: Record<string, string> = {
  name: 'p.name ASC NULLS LAST',
  last_seen: 'p.last_seen_at DESC',
  health: `CASE p.health_state WHEN 'down' THEN 0 WHEN 'degraded' THEN 1 WHEN 'healthy' THEN 2 ELSE 3 END`,
  availability: 'availability_value DESC NULLS LAST',
  cpu: '(p.current_capacity->>\'cpuAvailableCores\')::double precision DESC NULLS LAST',
};

function availabilityColumn(window?: string): {
  column: string;
  label: string;
} {
  if (window === '7d') {
    return { column: 'p.availability_7d', label: '7d source-reported uptime' };
  }
  if (window === '30d') {
    return { column: 'p.availability_30d', label: '30d source-reported uptime' };
  }
  return { column: 'p.availability_1d', label: '24h source-reported uptime' };
}

export async function listProviders(
  filters: ProviderListFilters,
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const availability = availabilityColumn(filters.availabilityWindow);
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (filters.networkId) add('p.network_id = ?', filters.networkId);
  if (filters.health) add('p.health_state = ?', filters.health);
  if (filters.evidence) add('p.capacity_evidence = ?', filters.evidence);
  if (filters.country) add('p.country = ?', filters.country);
  if (filters.region) add('p.region = ?', filters.region);
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const placeholder = `$${params.length}`;
    where.push(
      `(p.name ILIKE ${placeholder} OR p.external_id ILIKE ${placeholder} OR p.operator_address ILIKE ${placeholder} OR p.country ILIKE ${placeholder} OR p.region ILIKE ${placeholder})`,
    );
  }
  if (filters.hasIncident) {
    where.push(
      `EXISTS (SELECT 1 FROM incidents i WHERE i.provider_id=p.id AND i.status NOT IN ('resolved','closed'))`,
    );
  }

  const order = SORTABLE[filters.sort ?? 'health'] ?? SORTABLE.health;
  const countResult = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM providers p ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );

  const rowsResult = await db.query<Record<string, unknown>>(
    `SELECT p.id, p.network_id, p.external_id, p.name, p.operator_address, p.host_uri,
       p.region, p.country, p.city, p.health_state, p.health_signal, p.health_reason,
       p.availability_1d, p.availability_7d, p.availability_30d, p.availability_method,
       p.current_capacity, p.capacity_evidence, p.latest_metrics, p.status_observed_at,
       p.first_seen_at, p.last_seen_at,
       ${availability.column} AS availability_value,
       n.name AS network_name, n.slug AS network_slug, n.brand_color,
       s.state AS source_state, s.last_success_at, s.stale_after_seconds,
       s.expected_interval_seconds, s.source_latency_ms,
       (SELECT count(*)::text FROM incidents i
         WHERE i.provider_id=p.id AND i.status NOT IN ('resolved','closed')) AS active_incidents
     FROM providers p
     JOIN networks n ON n.id=p.network_id
     LEFT JOIN data_source_status s ON s.network_id=p.network_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  const total = Number(countResult.rows[0]?.count ?? 0);
  return {
    data: rowsResult.rows.map((row) => {
      const freshness = describeFreshness(
        String(row.last_success_at ?? '') || null,
        Number(row.stale_after_seconds ?? 1800),
        Number(row.expected_interval_seconds ?? 300),
      );
      return {
        id: row.id,
        networkId: row.network_id,
        networkName: row.network_name,
        networkSlug: row.network_slug,
        brandColor: row.brand_color,
        externalId: row.external_id,
        name: row.name,
        operatorAddress: row.operator_address,
        hostReference: row.host_uri,
        hostNote:
          'Endpoint reference supplied by the source. It is not probed unless an operator creates an explicit monitor.',
        region: row.region,
        country: row.country,
        city: row.city,
        healthState: row.health_state,
        healthSignal: row.health_signal,
        healthReason: row.health_reason,
        availability: {
          value: row.availability_value,
          window: filters.availabilityWindow ?? '24h',
          label: availability.label,
          method: row.availability_method,
          evidence: row.availability_method ? 'reported' : 'unavailable',
        },
        availability1d: row.availability_1d,
        availability7d: row.availability_7d,
        availability30d: row.availability_30d,
        capacity: row.current_capacity,
        capacityEvidence: row.capacity_evidence,
        latestMetrics: row.latest_metrics,
        statusObservedAt: row.status_observed_at,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
        sourceLatencyMs: row.source_latency_ms,
        sourceState: row.source_state,
        freshness,
        activeIncidents: Number(row.active_incidents ?? 0),
      };
    }),
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      availabilityWindow: filters.availabilityWindow ?? '24h',
    },
  };
}

export async function getProviderDetail(
  id: string,
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const result = await db.query<Record<string, unknown>>(
    `SELECT p.*, n.name AS network_name, n.slug AS network_slug, n.brand_color,
       n.source_url AS network_source_url, n.docs_url AS network_docs_url,
       s.state AS source_state, s.last_success_at, s.last_attempt_at,
       s.stale_after_seconds, s.expected_interval_seconds, s.source_latency_ms,
       s.consecutive_failures, na.version AS adapter_version,
       na.rate_limit AS adapter_rate_limit, na.source_url AS adapter_source_url
     FROM providers p
     JOIN networks n ON n.id=p.network_id
     LEFT JOIN data_source_status s ON s.network_id=p.network_id
     LEFT JOIN network_adapters na ON na.network_id=p.network_id
     WHERE p.id=$1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;

  const [observations, capacityHistory, incidents, incidentsCount, definitions] =
    await Promise.all([
      db.query<Record<string, unknown>>(
        `SELECT DISTINCT ON (o.metric_key) o.metric_key, o.value, o.unit, o.status,
           o.observed_at, o.collected_at, o.source_endpoint, o.adapter_version, o.dimensions,
           d.name, d.description, d.evidence_type, d.comparability_group, d.direction
         FROM observations o
         LEFT JOIN metric_definitions d ON d.key=o.metric_key
         WHERE o.provider_id=$1
         ORDER BY o.metric_key, o.observed_at DESC`,
        [id],
      ),
      db.query<Record<string, unknown>>(
        `SELECT observed_at, collected_at, evidence_type, cpu_total_cores, cpu_available_cores,
           cpu_active_cores, memory_total_bytes, memory_available_bytes, memory_active_bytes,
           storage_total_bytes, storage_available_bytes, gpu_total, gpu_available, gpu_active,
           gpu_models, source_endpoint
         FROM capacity_snapshots WHERE provider_id=$1 ORDER BY observed_at DESC LIMIT 50`,
        [id],
      ),
      db.query<Record<string, unknown>>(
        `SELECT i.id, i.title, i.severity, i.status, i.started_at, i.detected_at,
           i.resolved_at, i.source, i.source_url, i.anchor_status
         FROM incidents i WHERE i.provider_id=$1
         ORDER BY i.started_at DESC LIMIT 20`,
        [id],
      ),
      db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM incidents
         WHERE provider_id=$1 AND status NOT IN ('resolved','closed')`,
        [id],
      ),
      db.query<Record<string, unknown>>(
        `SELECT DISTINCT ON (o.metric_key) o.metric_key, o.unit, o.status
         FROM observations o WHERE o.provider_id=$1 ORDER BY o.metric_key, o.observed_at DESC`,
        [id],
      ),
    ]);

  const freshness = describeFreshness(
    (row.last_success_at as string | null) ?? null,
    Number(row.stale_after_seconds ?? 1800),
    Number(row.expected_interval_seconds ?? 300),
  );

  return {
    id: row.id,
    network: {
      id: row.network_id,
      name: row.network_name,
      slug: row.network_slug,
      brandColor: row.brand_color,
      sourceUrl: row.network_source_url,
      docsUrl: row.network_docs_url,
    },
    externalId: row.external_id,
    name: row.name,
    operatorAddress: row.operator_address,
    hostReference: row.host_uri,
    hostNote:
      'The source exposes this host reference. ComputePulse does not probe it by default and does not treat it as verified availability evidence.',
    region: row.region,
    country: row.country,
    city: row.city,
    locationSource: row.location_source,
    hardware: row.hardware,
    metadata: row.metadata,
    healthState: row.health_state,
    healthSignal: row.health_signal,
    healthReason: row.health_reason,
    availability: {
      day1: row.availability_1d,
      day7: row.availability_7d,
      day30: row.availability_30d,
      method: row.availability_method,
      evidence: row.availability_method ? 'reported' : 'unavailable',
      note:
        'These windows are supplied by the upstream source. ComputePulse does not derive or independently verify them.',
    },
    capacity: row.current_capacity,
    capacityEvidence: row.capacity_evidence,
    sourceUrl: row.source_url,
    statusObservedAt: row.status_observed_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    source: {
      state: row.source_state,
      lastSuccessAt: row.last_success_at,
      lastAttemptAt: row.last_attempt_at,
      consecutiveFailures: row.consecutive_failures,
      latencyMs: row.source_latency_ms,
      staleAfterSeconds: row.stale_after_seconds,
      expectedIntervalSeconds: row.expected_interval_seconds,
      adapterVersion: row.adapter_version,
      adapterRateLimit: row.adapter_rate_limit,
      adapterSourceUrl: row.adapter_source_url,
    },
    freshness,
    activeIncidents: Number(incidentsCount.rows[0]?.count ?? 0),
    observations: observations.rows,
    availableMetricKeys: definitions.rows,
    capacityHistory: capacityHistory.rows,
    incidents: incidents.rows,
    provenance: {
      sourceName: row.network_name,
      sourceUrl: row.source_url,
      adapterVersion: row.adapter_version,
      collectionMethod:
        'Scheduled server-side collection of the documented public source. No arbitrary provider probing.',
      sourceObservedAt: row.status_observed_at,
      collectedAt:
        observations.rows[0]?.collected_at ?? row.last_seen_at,
      measurementWindow: 'Point-in-time provider record from the latest collection.',
      freshness,
      evidence: row.health_signal,
      limitations: row.metadata,
    },
  };
}

export function parseWindow(
  value: string | undefined,
): { label: string; fromSeconds: number; bucketSeconds: number } {
  switch (value) {
    case '1h':
      return { label: '1h', fromSeconds: 3600, bucketSeconds: 60 };
    case '7d':
      return { label: '7d', fromSeconds: 604_800, bucketSeconds: 3600 };
    case '30d':
      return { label: '30d', fromSeconds: 2_592_000, bucketSeconds: 14_400 };
    case 'custom':
      return { label: 'custom', fromSeconds: 86_400, bucketSeconds: 300 };
    default:
      return { label: '24h', fromSeconds: 86_400, bucketSeconds: 300 };
  }
}

export async function getProviderHistory(
  providerId: string,
  options: {
    metricKey?: string;
    window?: string;
    from?: string;
    to?: string;
    bucketSeconds?: number;
  },
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const provider = await db.query<{
    id: string;
    network_id: string;
    name: string | null;
    external_id: string;
  }>(
    `SELECT p.id, p.network_id, p.name, p.external_id, n.name AS network_name
     FROM providers p JOIN networks n ON n.id=p.network_id WHERE p.id=$1`,
    [providerId],
  );
  if (!provider.rows[0]) return null;

  const parsed = parseWindow(options.window);
  const to = options.to ? new Date(options.to) : new Date();
  const from = options.from
    ? new Date(options.from)
    : new Date(to.getTime() - parsed.fromSeconds * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new Error('Invalid observation window');
  }
  const windowSeconds = Math.round((to.getTime() - from.getTime()) / 1000);
  const bucketSeconds = Math.min(
    86_400,
    Math.max(30, options.bucketSeconds ?? parsed.bucketSeconds),
  );

  const metricKey =
    options.metricKey ??
    (provider.rows[0].network_id === 'flux-mainnet'
      ? 'flux.confirmation_lag_blocks'
      : provider.rows[0].network_id === 'akash-mainnet'
        ? 'akash.uptime_1d'
        : 'chain.rpc_latency_ms');

  const result = await db.query<{
    bucket: string;
    value: number | null;
    sample_count: string;
    min_value: number | null;
    max_value: number | null;
    unit: string;
    status: string;
    evidence_type: string | null;
  }>(
    `SELECT to_timestamp(floor(extract(epoch FROM o.observed_at) / $4) * $4) AS bucket,
       avg(o.value) AS value, count(*)::text AS sample_count, min(o.value) AS min_value,
       max(o.value) AS max_value, min(o.unit) AS unit, min(o.status) AS status,
       min(d.evidence_type) AS evidence_type
     FROM observations o
     LEFT JOIN metric_definitions d ON d.key=o.metric_key
     WHERE o.provider_id=$1 AND o.metric_key=$2 AND o.observed_at >= $3 AND o.observed_at <= $5
     GROUP BY bucket ORDER BY bucket ASC`,
    [providerId, metricKey, from.toISOString(), bucketSeconds, to.toISOString()],
  );

  const expectedBuckets = Math.max(1, Math.floor(windowSeconds / bucketSeconds));
  return {
    providerId,
    metricKey,
    window: {
      label: parsed.label,
      from: from.toISOString(),
      to: to.toISOString(),
      seconds: windowSeconds,
      bucketSeconds,
    },
    coverage: {
      expectedBuckets,
      observedBuckets: result.rows.length,
      ratio: result.rows.length / expectedBuckets,
      missingBuckets: Math.max(0, expectedBuckets - result.rows.length),
      note:
        'Coverage counts buckets containing at least one observation. Sparse history is displayed as a gap rather than interpolated.',
    },
    points: result.rows.map((row) => ({
      at: new Date(row.bucket).toISOString(),
      value: row.value === null ? null : Number(row.value),
      min: row.min_value === null ? null : Number(row.min_value),
      max: row.max_value === null ? null : Number(row.max_value),
      samples: Number(row.sample_count),
      unit: row.unit,
      status: row.status,
      evidence: row.evidence_type,
    })),
  };
}

export async function getNetworkHistory(
  networkId: string,
  options: {
    metricKey?: string;
    window?: string;
    from?: string;
    to?: string;
    bucketSeconds?: number;
  },
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const parsed = parseWindow(options.window);
  const to = options.to ? new Date(options.to) : new Date();
  const from = options.from
    ? new Date(options.from)
    : new Date(to.getTime() - parsed.fromSeconds * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new Error('Invalid observation window');
  }
  const windowSeconds = Math.round((to.getTime() - from.getTime()) / 1000);
  const bucketSeconds = Math.min(
    86_400,
    Math.max(30, options.bucketSeconds ?? parsed.bucketSeconds),
  );
  const metricKey = options.metricKey ?? 'network.source_latency_ms';
  const result = await db.query<{
    bucket: string;
    value: number | null;
    sample_count: string;
    min_value: number | null;
    max_value: number | null;
    unit: string;
    evidence_type: string | null;
  }>(
    `SELECT to_timestamp(floor(extract(epoch FROM o.observed_at) / $4) * $4) AS bucket,
       avg(o.value) AS value, count(*)::text AS sample_count, min(o.value) AS min_value,
       max(o.value) AS max_value, min(o.unit) AS unit, min(d.evidence_type) AS evidence_type
     FROM observations o
     LEFT JOIN metric_definitions d ON d.key=o.metric_key
     WHERE o.network_id=$1 AND o.provider_id IS NULL AND o.metric_key=$2
       AND o.observed_at >= $3 AND o.observed_at <= $5
     GROUP BY bucket ORDER BY bucket ASC`,
    [networkId, metricKey, from.toISOString(), bucketSeconds, to.toISOString()],
  );
  const expectedBuckets = Math.max(1, Math.floor(windowSeconds / bucketSeconds));
  return {
    networkId,
    metricKey,
    window: {
      label: parsed.label,
      from: from.toISOString(),
      to: to.toISOString(),
      seconds: windowSeconds,
      bucketSeconds,
    },
    coverage: {
      expectedBuckets,
      observedBuckets: result.rows.length,
      ratio: result.rows.length / expectedBuckets,
      missingBuckets: Math.max(0, expectedBuckets - result.rows.length),
      note:
        'Coverage counts buckets containing at least one collection. Missing buckets are gaps, not zeroes.',
    },
    points: result.rows.map((row) => ({
      at: new Date(row.bucket).toISOString(),
      value: row.value === null ? null : Number(row.value),
      min: row.min_value === null ? null : Number(row.min_value),
      max: row.max_value === null ? null : Number(row.max_value),
      samples: Number(row.sample_count),
      unit: row.unit,
      evidence: row.evidence_type,
    })),
  };
}
