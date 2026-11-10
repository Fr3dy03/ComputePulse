import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import type { NetworkCollectionResult } from '../adapters/types.js';

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'computepulse_' });

const providerTotal = new Gauge({
  name: 'computepulse_provider_total',
  help: 'Providers currently persisted for a network',
  labelNames: ['network'],
  registers: [registry],
});

const providerHealth = new Gauge({
  name: 'computepulse_provider_health',
  help: 'Persisted provider health states from the latest collection',
  labelNames: ['network', 'state'],
  registers: [registry],
});

const sourceLatency = new Gauge({
  name: 'computepulse_source_latency_ms',
  help: 'Duration of the most recent source collection request in milliseconds',
  labelNames: ['network'],
  registers: [registry],
});

const collectionSuccessTimestamp = new Gauge({
  name: 'computepulse_collection_success_timestamp_seconds',
  help: 'Unix timestamp of the last successful source collection',
  labelNames: ['network'],
  registers: [registry],
});

const collectionRuns = new Counter({
  name: 'computepulse_collection_runs',
  help: 'Collection attempts by network and status',
  labelNames: ['network', 'status'],
  registers: [registry],
});

const observationsWritten = new Counter({
  name: 'computepulse_observations_written',
  help: 'Observation rows written by the collector',
  labelNames: ['network'],
  registers: [registry],
});

const monitorGauge = new Gauge({
  name: 'computepulse_monitor_success',
  help: '1 when the latest endpoint monitor check succeeded, 0 otherwise',
  labelNames: ['monitor', 'network'],
  registers: [registry],
});

const monitorLatency = new Gauge({
  name: 'computepulse_monitor_latency_ms',
  help: 'Response time of the most recent endpoint monitor check',
  labelNames: ['monitor', 'network'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'computepulse_http_request_duration_seconds',
  help: 'ComputePulse API request duration',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export function observeCollectionMetrics(
  networkId: string,
  result: NetworkCollectionResult,
  _trigger: string,
): void {
  sourceLatency.labels(networkId).set(result.sourceLatencyMs);
  if (result.providers.length > 0 || result.networkMetrics.length > 0) {
    collectionSuccessTimestamp
      .labels(networkId)
      .set(Math.floor(Date.now() / 1000));
    collectionRuns.labels(networkId, result.status).inc();
    observationsWritten
      .labels(networkId)
      .inc(
        result.providers.reduce(
          (sum, provider) =>
            sum + provider.metrics.filter((metric) => metric.value !== null).length,
          result.networkMetrics.filter((metric) => metric.value !== null).length,
        ),
      );
  }
  if (result.providers.length > 0) {
    providerTotal.labels(networkId).set(result.providers.length);
    const counts: Record<string, number> = {
      healthy: 0,
      degraded: 0,
      down: 0,
      unknown: 0,
    };
    for (const provider of result.providers) {
      counts[provider.healthState] = (counts[provider.healthState] ?? 0) + 1;
    }
    for (const [state, count] of Object.entries(counts)) {
      providerHealth.labels(networkId, state).set(count);
    }
  }
}

export function observeMonitorMetrics(
  monitor: { id: string; network_id: string | null },
  success: boolean,
  latencyMs: number | null,
): void {
  monitorGauge
    .labels(monitor.id, monitor.network_id ?? 'unassigned')
    .set(success ? 1 : 0);
  if (latencyMs !== null) {
    monitorLatency
      .labels(monitor.id, monitor.network_id ?? 'unassigned')
      .set(latencyMs);
  }
}

export async function renderMetrics(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
