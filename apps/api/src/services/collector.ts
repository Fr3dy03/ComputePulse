import { hostname } from 'node:os';
import type { Database } from '../db/client.js';
import { getDb, withTransaction } from '../db/client.js';
import { env } from '../env.js';
import { getAdapter, adapters } from '../adapters/registry.js';
import type {
  NetworkCollectionResult,
  NormalizedProvider,
} from '../adapters/types.js';
import { stableProviderId, uuid } from '../lib/ids.js';
import { observeCollectionMetrics } from '../observability/metrics.js';

const workerId = `${hostname()}-${process.pid}`;
const inFlight = new Map<string, Promise<unknown>>();

interface BulkOptions {
  jsonColumns?: Set<string>;
  conflictClause?: string;
  chunkSize?: number;
}

function placeholders(
  rowCount: number,
  columnCount: number,
  startIndex: number,
  jsonColumns?: Set<string>,
  columns?: string[],
): string {
  const groups: string[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    const values: string[] = [];
    for (let column = 0; column < columnCount; column += 1) {
      const index = startIndex + row * columnCount + column;
      const name = columns?.[column];
      values.push(
        name && jsonColumns?.has(name) ? `$${index}::jsonb` : `$${index}`,
      );
    }
    groups.push(`(${values.join(',')})`);
  }
  return groups.join(',');
}

async function bulkInsert(
  db: Database,
  table: string,
  columns: string[],
  rows: unknown[][],
  options: BulkOptions = {},
): Promise<void> {
  if (rows.length === 0) return;
  const chunkSize = options.chunkSize ?? 400;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const params: unknown[] = [];
    const values: string[] = [];
    for (let rowIndex = 0; rowIndex < chunk.length; rowIndex += 1) {
      const row = chunk[rowIndex];
      const placeholdersForRow: string[] = [];
      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const value = row[columnIndex];
        const paramIndex = params.length + 1;
        if (options.jsonColumns?.has(columns[columnIndex])) {
          params.push(value === null || value === undefined ? null : JSON.stringify(value));
          placeholdersForRow.push(`$${paramIndex}::jsonb`);
        } else {
          params.push(value ?? null);
          placeholdersForRow.push(`$${paramIndex}`);
        }
      }
      values.push(`(${placeholdersForRow.join(',')})`);
    }
    await db.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${values.join(',')} ${
        options.conflictClause ?? ''
      }`,
      params,
    );
  }
}

async function persistProviders(
  db: Database,
  networkId: string,
  providers: NormalizedProvider[],
  collectedAt: Date,
) {
  const providerColumns = [
    'id',
    'network_id',
    'external_id',
    'name',
    'operator_address',
    'host_uri',
    'region',
    'country',
    'city',
    'location_source',
    'hardware',
    'metadata',
    'health_state',
    'health_signal',
    'health_reason',
    'availability_1d',
    'availability_7d',
    'availability_30d',
    'availability_method',
    'latest_metrics',
    'current_capacity',
    'capacity_evidence',
    'source_url',
    'status_observed_at',
    'first_seen_at',
    'last_seen_at',
  ];
  const providerRows = providers.map((provider) => {
    const id = stableProviderId(networkId, provider.externalId);
    return [
      id,
      networkId,
      provider.externalId,
      provider.name,
      provider.operatorAddress,
      provider.hostUri,
      provider.region,
      provider.country,
      provider.city,
      provider.locationSource,
      provider.hardware,
      provider.metadata,
      provider.healthState,
      provider.healthSignal,
      provider.healthReason,
      provider.availability1d,
      provider.availability7d,
      provider.availability30d,
      provider.availabilityMethod,
      { ...provider.latestMetrics, collectedAt: collectedAt.toISOString() },
      provider.capacity,
      provider.capacityEvidence,
      provider.sourceUrl,
      collectedAt,
      collectedAt,
      collectedAt,
    ];
  });

  await bulkInsert(db, 'providers', providerColumns, providerRows, {
    jsonColumns: new Set(['hardware', 'metadata', 'latest_metrics', 'current_capacity']),
    chunkSize: 250,
    conflictClause: `ON CONFLICT (network_id, external_id) DO UPDATE SET
      name = EXCLUDED.name,
      operator_address = EXCLUDED.operator_address,
      host_uri = EXCLUDED.host_uri,
      region = EXCLUDED.region,
      country = EXCLUDED.country,
      city = EXCLUDED.city,
      location_source = EXCLUDED.location_source,
      hardware = EXCLUDED.hardware,
      metadata = EXCLUDED.metadata,
      health_state = EXCLUDED.health_state,
      health_signal = EXCLUDED.health_signal,
      health_reason = EXCLUDED.health_reason,
      availability_1d = EXCLUDED.availability_1d,
      availability_7d = EXCLUDED.availability_7d,
      availability_30d = EXCLUDED.availability_30d,
      availability_method = EXCLUDED.availability_method,
      latest_metrics = EXCLUDED.latest_metrics,
      current_capacity = EXCLUDED.current_capacity,
      capacity_evidence = EXCLUDED.capacity_evidence,
      source_url = EXCLUDED.source_url,
      status_observed_at = EXCLUDED.status_observed_at,
      first_seen_at = providers.first_seen_at,
      last_seen_at = EXCLUDED.last_seen_at,
      updated_at = now()`,
  });

  return providers.map((provider) => ({
    provider,
    id: stableProviderId(networkId, provider.externalId),
  }));
}

async function persistObservations(
  db: Database,
  runId: string,
  adapterVersion: string,
  networkId: string,
  providers: NormalizedProvider[],
  networkResult: NetworkCollectionResult,
  collectedAt: Date,
  sourceEndpoint: string,
) {
  const rows: unknown[][] = [];
  const columns = [
    'network_id',
    'provider_id',
    'metric_key',
    'value',
    'unit',
    'observed_at',
    'collected_at',
    'source_endpoint',
    'adapter_version',
    'collection_run_id',
    'status',
    'success',
    'error',
    'dimensions',
  ];
  for (const provider of providers) {
    const providerId = stableProviderId(networkId, provider.externalId);
    for (const metric of provider.metrics) {
      if (metric.value === null) continue;
      rows.push([
        networkId,
        providerId,
        metric.metricKey,
        metric.value,
        metric.unit,
        collectedAt,
        collectedAt,
        provider.sourceUrl,
        adapterVersion,
        runId,
        metric.evidenceType,
        true,
        null,
        metric.dimensions ?? {},
      ]);
    }
  }
  for (const metric of networkResult.networkMetrics) {
    if (metric.value === null) continue;
    rows.push([
      networkId,
      null,
      metric.metricKey,
      metric.value,
      metric.unit,
      collectedAt,
      collectedAt,
      sourceEndpoint,
      adapterVersion,
      runId,
      metric.evidenceType,
      true,
      null,
      metric.dimensions ?? {},
    ]);
  }
  await bulkInsert(db, 'observations', columns, rows, {
    jsonColumns: new Set(['dimensions']),
    chunkSize: 700,
  });
  return rows.length;
}

async function persistCapacity(
  db: Database,
  networkId: string,
  providers: NormalizedProvider[],
  collectedAt: Date,
) {
  const rows = providers
    .filter((provider) => provider.capacity?.evidence === 'reported')
    .map((provider) => {
      const capacity = provider.capacity!;
      return [
        networkId,
        stableProviderId(networkId, provider.externalId),
        collectedAt,
        collectedAt,
        provider.sourceUrl,
        capacity.evidence,
        capacity.cpuTotalCores ?? null,
        capacity.cpuAvailableCores ?? null,
        capacity.cpuActiveCores ?? null,
        capacity.memoryTotalBytes ?? null,
        capacity.memoryAvailableBytes ?? null,
        capacity.memoryActiveBytes ?? null,
        capacity.storageTotalBytes ?? null,
        capacity.storageAvailableBytes ?? null,
        capacity.gpuTotal ?? null,
        capacity.gpuAvailable ?? null,
        capacity.gpuActive ?? null,
        capacity.gpuModels ?? [],
        capacity.raw ?? {},
      ];
    });
  await bulkInsert(
    db,
    'capacity_snapshots',
    [
      'network_id',
      'provider_id',
      'observed_at',
      'collected_at',
      'source_endpoint',
      'evidence_type',
      'cpu_total_cores',
      'cpu_available_cores',
      'cpu_active_cores',
      'memory_total_bytes',
      'memory_available_bytes',
      'memory_active_bytes',
      'storage_total_bytes',
      'storage_available_bytes',
      'gpu_total',
      'gpu_available',
      'gpu_active',
      'gpu_models',
      'raw',
    ],
    rows,
    {
      jsonColumns: new Set(['gpu_models', 'raw']),
      chunkSize: 250,
    },
  );
  return rows.length;
}

async function markRunSuccess(
  db: Database,
  runId: string,
  result: NetworkCollectionResult,
  observationCount: number,
  providerCount: number,
) {
  await db.query(
    `UPDATE collection_runs SET status=$2, finished_at=now(), providers_seen=$3,
       observations_written=$4, source_latency_ms=$5
     WHERE id=$1`,
    [
      runId,
      result.status === 'success' ? 'success' : 'degraded',
      providerCount,
      observationCount,
      result.sourceLatencyMs,
    ],
  );
}

async function updateSourceSuccess(
  db: Database,
  networkId: string,
  result: NetworkCollectionResult,
) {
  await db.query(
    `UPDATE data_source_status SET
       state = $2,
       last_attempt_at = now(),
       last_success_at = now(),
       last_error = NULL,
       consecutive_failures = 0,
       source_latency_ms = $3,
       updated_at = now()
     WHERE network_id = $1`,
    [networkId, result.status === 'success' ? 'active' : 'degraded', result.sourceLatencyMs],
  );
  await db.query(
    `UPDATE networks SET health_state=$2, health_reason=$3, last_observed_at=now(), updated_at=now()
     WHERE id=$1`,
    [networkId, result.healthState, result.healthReason],
  );
  await db.query(
    `UPDATE network_adapters SET last_run_at=now(), last_success_at=now(), last_error=NULL
     WHERE network_id=$1`,
    [networkId],
  );
}

async function updateSourceFailure(
  db: Database,
  networkId: string,
  error: Error,
) {
  const current = await db.query<{ consecutive_failures: number }>(
    'SELECT consecutive_failures FROM data_source_status WHERE network_id=$1',
    [networkId],
  );
  const failures = (current.rows[0]?.consecutive_failures ?? 0) + 1;
  const state = failures >= 2 ? 'failing' : 'degraded';
  await db.query(
    `UPDATE data_source_status SET
       state=$2,
       last_attempt_at=now(),
       last_error=$3,
       consecutive_failures=$4,
       updated_at=now()
     WHERE network_id=$1`,
    [networkId, state, error.message.slice(0, 1000), failures],
  );
  await db.query(
    `UPDATE networks SET
       health_state=$2,
       health_reason=$3,
       updated_at=now()
     WHERE id=$1`,
    [
      networkId,
      failures >= 2 ? 'down' : 'degraded',
      `Source collection failed (${failures} consecutive failure${failures === 1 ? '' : 's'}): ${error.message}`,
    ],
  );
  await db.query(
    `UPDATE network_adapters SET last_run_at=now(), last_error=$2 WHERE network_id=$1`,
    [networkId, error.message.slice(0, 1000)],
  );
}

async function executeCollection(
  db: Database,
  networkId: string,
  trigger: string,
): Promise<{ runId: string; status: string; providerCount: number; observations: number }> {
  const adapter = getAdapter(networkId);
  const runId = uuid('run');
  const now = new Date();
  await db.query(
    `INSERT INTO collection_runs
      (id, network_id, adapter_id, adapter_version, status, started_at, worker_id)
     VALUES ($1,$2,$3,$4,'running',$5,$6)`,
    [runId, networkId, adapter.metadata.id, adapter.metadata.version, now, workerId],
  );

  try {
    const result = await adapter.collect({ now });
    await withTransaction(db, async (tx) => {
      const persisted = await persistProviders(
        tx,
        networkId,
        result.providers,
        now,
      );
      // Persist normalized provider identity for every row even when the adapter
      // returns an empty provider set (BOT is a network-only adapter).
      void persisted;
      const observations = await persistObservations(
        tx,
        runId,
        adapter.metadata.version,
        networkId,
        result.providers,
        result,
        now,
        adapter.metadata.sourceUrl,
      );
      const capacityCount = await persistCapacity(
        tx,
        networkId,
        result.providers,
        now,
      );
      await markRunSuccess(tx, runId, result, observations, result.providers.length);
      await updateSourceSuccess(tx, networkId, result);
      await tx.query(
        `UPDATE network_adapters SET last_run_at=now(), last_success_at=now(), last_error=NULL WHERE network_id=$1`,
        [networkId],
      );
      result.detail.capacitySnapshotsWritten = capacityCount;
    });
    observeCollectionMetrics(networkId, result, trigger);
    return {
      runId,
      status: result.status,
      providerCount: result.providers.length,
      observations: result.providers.reduce(
        (sum, provider) => sum + provider.metrics.filter((metric) => metric.value !== null).length,
        result.networkMetrics.filter((metric) => metric.value !== null).length,
      ),
    };
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    await db.query(
      `UPDATE collection_runs SET status='failed', finished_at=now(), error=$2 WHERE id=$1`,
      [runId, normalized.message.slice(0, 2000)],
    );
    await updateSourceFailure(db, networkId, normalized);
    observeCollectionMetrics(
      networkId,
      {
        networkId,
        status: 'degraded',
        healthState: 'degraded',
        healthReason: normalized.message,
        providers: [],
        networkMetrics: [],
        sourceLatencyMs: 0,
        sourceObservedAt: now,
        detail: {},
      },
      trigger,
    );
    throw normalized;
  }
}

export async function collectNetwork(
  networkId: string,
  trigger = 'manual',
  dbOverride?: Database,
) {
  const existing = inFlight.get(networkId);
  if (existing) return existing as Promise<Awaited<ReturnType<typeof executeCollection>>>;
  const db = dbOverride ?? (await getDb());
  const promise = executeCollection(db, networkId, trigger).finally(() => {
    inFlight.delete(networkId);
  });
  inFlight.set(networkId, promise);
  return promise;
}

export async function collectAll(trigger = 'manual', networkIds?: string[]) {
  const db = await getDb();
  const ids =
    networkIds ??
    adapters
      .map((adapter) => adapter.metadata.networkId)
      .filter((value, index, array) => array.indexOf(value) === index);
  const results: Record<string, unknown> = {};
  for (const networkId of ids) {
    try {
      results[networkId] = await collectNetwork(networkId, trigger, db);
    } catch (error) {
      results[networkId] = {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return results;
}

export async function getCollectorStatus() {
  const db = await getDb();
  const [sources, recent] = await Promise.all([
    db.query(
      `SELECT s.*, n.name AS network_name FROM data_source_status s
       JOIN networks n ON n.id = s.network_id ORDER BY s.updated_at DESC`,
    ),
    db.query(
      `SELECT * FROM collection_runs ORDER BY started_at DESC LIMIT 20`,
    ),
  ]);
  return { sources: sources.rows, recentRuns: recent.rows };
}

export { workerId };
