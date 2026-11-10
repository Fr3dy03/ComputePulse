import type { Database } from '../db/client.js';
import { getDb } from '../db/client.js';
import { describeFreshness } from '../lib/time.js';

interface NetworkRow {
  id: string;
  name: string;
  slug: string;
  kind: string;
  chain_id: string | number | null;
  source_adapter: string;
  source_url: string | null;
  explorer_url: string | null;
  docs_url: string | null;
  description: string | null;
  health_state: string;
  health_reason: string | null;
  last_observed_at: string | null;
  supported_metrics: string[];
  limitations: string[];
  brand_color: string;
  enabled: boolean;
}

interface SourceRow {
  network_id: string;
  state: string;
  stale_after_seconds: number;
  expected_interval_seconds: number;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  source_latency_ms: number | null;
}

export async function getNetworkSummaries(dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const [networksResult, sourcesResult, providerCounts, healthCounts, monitorCounts, incidentCounts, adapterRows, lastRuns, capacityCounts] =
    await Promise.all([
      db.query<NetworkRow>('SELECT * FROM networks WHERE enabled=true ORDER BY created_at ASC'),
      db.query<SourceRow>('SELECT * FROM data_source_status'),
      db.query<{ network_id: string; count: string }>(
        `SELECT network_id, count(*)::text AS count FROM providers GROUP BY network_id`,
      ),
      db.query<{ network_id: string; health_state: string; count: string }>(
        `SELECT network_id, health_state, count(*)::text AS count FROM providers GROUP BY network_id, health_state`,
      ),
      db.query<{
        network_id: string;
        total: string;
        up: string;
        down: string;
      }>(
        `SELECT network_id, count(*)::text AS total,
           count(*) FILTER (WHERE last_status='up')::text AS up,
           count(*) FILTER (WHERE last_status='down')::text AS down
         FROM monitors WHERE enabled=true AND network_id IS NOT NULL GROUP BY network_id`,
      ),
      db.query<{ network_id: string; count: string }>(
        `SELECT network_id, count(*)::text AS count FROM incidents
         WHERE status NOT IN ('resolved','closed') AND network_id IS NOT NULL GROUP BY network_id`,
      ),
      db.query<{
        network_id: string;
        version: string;
        source_url: string;
        last_run_at: string | null;
        last_success_at: string | null;
        last_error: string | null;
      }>('SELECT network_id, version, source_url, last_run_at, last_success_at, last_error FROM network_adapters'),
      db.query<{
        network_id: string;
        id: string;
        status: string;
        started_at: string;
        finished_at: string | null;
        providers_seen: number;
        observations_written: number;
        source_latency_ms: number | null;
        error: string | null;
      }>(
        `SELECT DISTINCT ON (network_id) network_id, id, status, started_at, finished_at, providers_seen,
           observations_written, source_latency_ms, error
         FROM collection_runs ORDER BY network_id, started_at DESC`,
      ),
      db.query<{ network_id: string; count: string }>(
        `SELECT network_id, count(*)::text AS count FROM providers
         WHERE capacity_evidence IN ('reported','observed') GROUP BY network_id`,
      ),
    ]);

  const sourceMap = new Map(sourcesResult.rows.map((row) => [row.network_id, row]));
  const providerCountMap = new Map(
    providerCounts.rows.map((row) => [row.network_id, Number(row.count)]),
  );
  const monitorMap = new Map(
    monitorCounts.rows.map((row) => [row.network_id, row]),
  );
  const incidentMap = new Map(
    incidentCounts.rows.map((row) => [row.network_id, Number(row.count)]),
  );
  const adapterMap = new Map(adapterRows.rows.map((row) => [row.network_id, row]));
  const lastRunMap = new Map(lastRuns.rows.map((row) => [row.network_id, row]));
  const capacityMap = new Map(
    capacityCounts.rows.map((row) => [row.network_id, Number(row.count)]),
  );
  const healthMap = new Map<string, Record<string, number>>();
  for (const row of healthCounts.rows) {
    const current = healthMap.get(row.network_id) ?? {
      healthy: 0,
      degraded: 0,
      down: 0,
      unknown: 0,
    };
    current[row.health_state] = Number(row.count);
    healthMap.set(row.network_id, current);
  }

  return networksResult.rows.map((network) => {
    const source = sourceMap.get(network.id);
    const freshness = describeFreshness(
      source?.last_success_at ?? null,
      source?.stale_after_seconds ?? 1800,
      source?.expected_interval_seconds ?? 300,
    );
    const monitor = monitorMap.get(network.id);
    const counts = healthMap.get(network.id) ?? {
      healthy: 0,
      degraded: 0,
      down: 0,
      unknown: 0,
    };
    return {
      id: network.id,
      name: network.name,
      slug: network.slug,
      kind: network.kind,
      chainId: network.chain_id === null ? null : Number(network.chain_id),
      sourceAdapter: network.source_adapter,
      sourceUrl: network.source_url,
      explorerUrl: network.explorer_url,
      docsUrl: network.docs_url,
      description: network.description,
      healthState: network.health_state,
      healthReason: network.health_reason,
      lastObservedAt: network.last_observed_at,
      supportedMetrics: network.supported_metrics ?? [],
      limitations: network.limitations ?? [],
      brandColor: network.brand_color,
      adapter: adapterMap.get(network.id) ?? null,
      providerCount: providerCountMap.get(network.id) ?? 0,
      healthCounts: counts,
      capacityProviders: capacityMap.get(network.id) ?? 0,
      monitoredEndpoints: Number(monitor?.total ?? 0),
      healthyEndpoints: Number(monitor?.up ?? 0),
      failedEndpoints: Number(monitor?.down ?? 0),
      activeIncidents: incidentMap.get(network.id) ?? 0,
      sourceFreshness: freshness,
      source: source
        ? {
            state: source.state,
            lastAttemptAt: source.last_attempt_at,
            lastSuccessAt: source.last_success_at,
            lastError: source.last_error,
            consecutiveFailures: source.consecutive_failures,
            latencyMs: source.source_latency_ms,
            expectedIntervalSeconds: source.expected_interval_seconds,
            staleAfterSeconds: source.stale_after_seconds,
          }
        : null,
      lastRun: lastRunMap.get(network.id) ?? null,
    };
  });
}

export async function getNetworkDetail(networkId: string, dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const summaries = await getNetworkSummaries(db);
  const summary = summaries.find((network) => network.id === networkId);
  if (!summary) return null;

  const [providers, runs, metrics, monitors, incidents, metricDefinitions] =
    await Promise.all([
      db.query(
        `SELECT id, external_id, name, country, region, health_state, health_signal,
           health_reason, capacity_evidence, last_seen_at, latest_metrics, current_capacity
         FROM providers WHERE network_id=$1
         ORDER BY
           CASE health_state WHEN 'down' THEN 0 WHEN 'degraded' THEN 1 WHEN 'healthy' THEN 2 ELSE 3 END,
           last_seen_at DESC
         LIMIT 12`,
        [networkId],
      ),
      db.query(
        `SELECT * FROM collection_runs WHERE network_id=$1 ORDER BY started_at DESC LIMIT 12`,
        [networkId],
      ),
      db.query(
        `SELECT DISTINCT ON (metric_key) metric_key, value, unit, observed_at, collected_at, status
         FROM observations WHERE network_id=$1 AND provider_id IS NULL
         ORDER BY metric_key, observed_at DESC`,
        [networkId],
      ),
      db.query(
        `SELECT m.id, m.name, m.kind, m.target_url, m.interval_seconds, m.timeout_ms, m.retries,
           m.enabled, m.last_status, m.last_latency_ms, m.last_checked_at, m.consecutive_failures
         FROM monitors m WHERE m.network_id=$1 ORDER BY m.name`,
        [networkId],
      ),
      db.query(
        `SELECT i.id, i.title, i.severity, i.status, i.started_at, i.source
         FROM incidents i WHERE i.network_id=$1 ORDER BY i.started_at DESC LIMIT 8`,
        [networkId],
      ),
      db.query(
        `SELECT * FROM metric_definitions WHERE key = ANY($1::text[])`,
        [
          [
            'network.source_latency_ms',
            'network.providers_listed',
            'network.providers_source_online',
            'network.providers_with_reported_capacity',
            'flux.node_count',
            'flux.head_height',
            'flux.median_confirmation_lag_blocks',
            'chain.rpc_latency_ms',
            'chain.chain_id',
            'chain.block_height',
            'chain.block_age_seconds',
          ],
        ],
      ),
    ]);

  return {
    ...summary,
    providers: providers.rows,
    recentRuns: runs.rows,
    latestMetrics: metrics.rows,
    monitors: monitors.rows,
    recentIncidents: incidents.rows,
    metricDefinitions: metricDefinitions.rows,
  };
}
