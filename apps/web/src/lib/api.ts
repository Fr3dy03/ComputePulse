export const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:8787';

export const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

export type FreshnessState =
  | 'fresh'
  | 'delayed'
  | 'stale'
  | 'unavailable'
  | 'pending';

export interface Freshness {
  state: FreshnessState;
  ageSeconds: number | null;
  message: string;
}

export interface SourceRuntime {
  state: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  latencyMs: number | null;
  expectedIntervalSeconds: number;
  staleAfterSeconds: number;
}

export interface NetworkSummary {
  id: string;
  name: string;
  slug: string;
  kind: string;
  chainId: number | null;
  sourceAdapter: string;
  sourceUrl: string | null;
  explorerUrl: string | null;
  docsUrl: string | null;
  description: string | null;
  healthState: string;
  healthReason: string | null;
  lastObservedAt: string | null;
  supportedMetrics: string[];
  limitations: string[];
  brandColor: string;
  adapter: {
    network_id: string;
    version: string;
    source_url: string;
    last_run_at: string | null;
    last_success_at: string | null;
    last_error: string | null;
  } | null;
  providerCount: number;
  healthCounts: Record<string, number>;
  capacityProviders: number;
  monitoredEndpoints: number;
  healthyEndpoints: number;
  failedEndpoints: number;
  activeIncidents: number;
  sourceFreshness: Freshness;
  source: SourceRuntime | null;
  lastRun: {
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    providers_seen: number;
    observations_written: number;
    source_latency_ms: number | null;
    error: string | null;
  } | null;
}

export interface NetworkDetail extends NetworkSummary {
  providers: ProviderListItem[];
  recentRuns: Array<Record<string, unknown>>;
  latestMetrics: Array<{
    metric_key: string;
    value: number;
    unit: string;
    observed_at: string;
    collected_at: string;
    status: string;
  }>;
  monitors: Array<Record<string, unknown>>;
  recentIncidents: Array<Record<string, unknown>>;
  metricDefinitions: Array<Record<string, unknown>>;
}

export interface ProviderListItem {
  id: string;
  networkId: string;
  networkName: string;
  networkSlug: string;
  brandColor: string;
  externalId: string;
  name: string | null;
  operatorAddress: string | null;
  hostReference: string | null;
  hostNote: string;
  region: string | null;
  country: string | null;
  city: string | null;
  healthState: string;
  healthSignal: string;
  healthReason: string | null;
  availability: {
    value: number | null;
    window: string;
    label: string;
    method: string | null;
    evidence: string;
  };
  availability1d: number | null;
  availability7d: number | null;
  availability30d: number | null;
  capacity: Capacity | null;
  capacityEvidence: string;
  latestMetrics: Record<string, string | number | boolean | null>;
  statusObservedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  sourceLatencyMs: number | null;
  sourceState: string | null;
  freshness: Freshness;
  activeIncidents: number;
}

export interface Capacity {
  evidence: string;
  cpuTotalCores?: number | null;
  cpuAvailableCores?: number | null;
  cpuActiveCores?: number | null;
  memoryTotalBytes?: number | null;
  memoryAvailableBytes?: number | null;
  memoryActiveBytes?: number | null;
  storageTotalBytes?: number | null;
  storageAvailableBytes?: number | null;
  gpuTotal?: number | null;
  gpuAvailable?: number | null;
  gpuActive?: number | null;
  gpuModels?: Array<Record<string, unknown>>;
}

export interface ProviderObservation {
  metric_key: string;
  value: number | null;
  unit: string;
  status: string;
  observed_at: string;
  collected_at: string;
  source_endpoint: string;
  adapter_version: string;
  dimensions: Record<string, unknown>;
  name: string | null;
  description: string | null;
  evidence_type: string | null;
  comparability_group: string | null;
  direction: string | null;
}

export interface ProviderDetail {
  id: string;
  network: {
    id: string;
    name: string;
    slug: string;
    brandColor: string;
    sourceUrl: string;
    docsUrl: string;
  };
  externalId: string;
  name: string | null;
  operatorAddress: string | null;
  hostReference: string | null;
  hostNote: string;
  region: string | null;
  country: string | null;
  city: string | null;
  locationSource: string | null;
  hardware: Record<string, unknown>;
  metadata: Record<string, unknown>;
  healthState: string;
  healthSignal: string;
  healthReason: string | null;
  availability: {
    day1: number | null;
    day7: number | null;
    day30: number | null;
    method: string | null;
    evidence: string;
    note: string;
  };
  capacity: Capacity | null;
  capacityEvidence: string;
  sourceUrl: string;
  statusObservedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  source: {
    state: string;
    lastSuccessAt: string | null;
    lastAttemptAt: string | null;
    consecutiveFailures: number;
    latencyMs: number | null;
    staleAfterSeconds: number;
    expectedIntervalSeconds: number;
    adapterVersion: string;
    adapterRateLimit: string;
    adapterSourceUrl: string;
  };
  freshness: Freshness;
  activeIncidents: number;
  observations: ProviderObservation[];
  availableMetricKeys: Array<{
    metric_key: string;
    unit: string;
    status: string;
  }>;
  capacityHistory: Array<Record<string, unknown>>;
  incidents: Array<Record<string, unknown>>;
  provenance: Record<string, unknown>;
}

export interface HistoryPoint {
  at: string;
  value: number | null;
  min: number | null;
  max: number | null;
  samples: number;
  unit: string;
  evidence: string | null;
  status?: string;
}

export interface History {
  providerId?: string;
  networkId?: string;
  metricKey: string;
  window: {
    label: string;
    from: string;
    to: string;
    seconds: number;
    bucketSeconds: number;
  };
  coverage: {
    expectedBuckets: number;
    observedBuckets: number;
    ratio: number;
    missingBuckets: number;
    note: string;
  };
  points: HistoryPoint[];
}

export interface Overview {
  generatedAt: string;
  networks: NetworkSummary[];
  providerCounts: {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
    unknown: number;
    note: string;
  };
  evidenceMix: Array<{ evidence: string; count: number }>;
  monitors: {
    total: number;
    up: number;
    down: number;
    pending: number;
    availability24h: number | null;
  };
  incidents: {
    total: number;
    active: number;
    critical: number;
  };
  latestIncidents: IncidentSummary[];
  collection: {
    windowHours: number;
    runs: number;
    succeeded: number;
    failed: number;
    degraded: number;
    avgLatencyMs: number | null;
  };
  observations: {
    total: number;
    last24h: number;
    providersWithMetrics: number;
  };
  alertDeliveries: Record<string, string>;
  integrations: Array<Record<string, unknown>>;
  collectionStatus: {
    sources: Array<Record<string, unknown>>;
    recentRuns: Array<Record<string, unknown>>;
  };
  networkMetricCoverage: Array<Record<string, unknown>>;
  disclaimer: string;
}

export interface IncidentSummary {
  id: string;
  title: string;
  summary?: string;
  severity: string;
  status: string;
  started_at: string;
  detected_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
  acknowledged_at?: string | null;
  source: string;
  source_ref?: string | null;
  source_observed_at?: string | null;
  source_url?: string | null;
  summary_digest?: string | null;
  remediation_digest?: string | null;
  source_commitment?: string | null;
  contract_incident_id?: string | null;
  onchain_tx_hash?: string | null;
  network_id: string | null;
  network_name: string | null;
  provider_id?: string | null;
  provider_name: string | null;
  provider_external_id: string | null;
  event_count?: string;
  anchor_status?: string;
  assigned_to?: string | null;
  remediation?: string | null;
  metadata?: Record<string, unknown>;
  events?: Array<{
    id: number;
    event_type: string;
    actor: string;
    note: string | null;
    data: Record<string, unknown>;
    created_at: string;
  }>;
  sourceCommitment?: string;
}

export interface MonitorSummary {
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
  auth_type: string;
  interval_seconds: number;
  timeout_ms: number;
  retries: number;
  enabled: boolean;
  last_status: string;
  last_latency_ms: number | null;
  last_status_code: number | null;
  last_checked_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  network_name: string | null;
  provider_name: string | null;
  provider_external_id: string | null;
  checks_24h: number;
  successful_24h: number;
  has_credentials: boolean;
  availability_24h: number | null;
  latest_check?: Record<string, unknown> | null;
}

export interface MonitorDetail extends MonitorSummary {
  created_at: string;
  updated_at: string;
  total_checks: string;
  checks: Array<{
    checked_at: string;
    latency_ms: number | null;
    status_code: number | null;
    success: boolean;
    attempt: number;
    error: string | null;
    source: string;
  }>;
  latestCheck: Record<string, unknown> | null;
  incidents: IncidentSummary[];
}

export interface CapacityProvider {
  providerId: string;
  providerName: string | null;
  externalId: string;
  networkId: string;
  networkName: string;
  networkSlug: string;
  brandColor: string;
  country: string | null;
  region: string | null;
  observedAt: string;
  evidence: string;
  cpuTotalCores: number | null;
  cpuAvailableCores: number | null;
  cpuActiveCores: number | null;
  memoryTotalBytes: number | null;
  memoryAvailableBytes: number | null;
  memoryActiveBytes: number | null;
  storageTotalBytes: number | null;
  storageAvailableBytes: number | null;
  gpuTotal: number | null;
  gpuAvailable: number | null;
  gpuActive: number | null;
  gpuModels: Array<Record<string, unknown>>;
  sourceEndpoint: string;
}

export interface CapacityOverview {
  generatedAt: string;
  networks: Array<
    NetworkSummary & {
      capacity: {
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
      } | null;
    }
  >;
  providers: CapacityProvider[];
  history: Array<Record<string, unknown>>;
  methodology: Record<string, unknown>;
}

export interface Benchmarks {
  generatedAt: string;
  comparabilityGroups: Array<{
    group: string;
    definitions: Array<Record<string, unknown>>;
    note: string;
  }>;
  networks: Array<
    Omit<NetworkSummary, 'sourceFreshness'> & {
      freshness?: Freshness;
      providerCounts: Record<string, unknown>;
      availabilityPercentiles: Record<string, unknown> | null;
      capacityEvidence: Record<string, number>;
      metrics: Array<Record<string, unknown>>;
      coverage: Array<Record<string, unknown>>;
    }
  >;
  caveats: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  metric_key: string;
  comparator: string;
  threshold: string;
  window_seconds: number;
  severity: string;
  network_name: string | null;
  provider_id?: string | null;
  channel_ids?: string[];
  cooldown_seconds?: number;
  deliveries: number;
  failed_deliveries: number;
  last_fired_at: string | null;
}

export interface Integration {
  id: string;
  kind: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  has_secret: boolean;
  last_sync_at: string | null;
}

export interface SettingsPayload {
  organisation: Record<string, unknown> | null;
  settings: Array<{ key: string; value: unknown; updated_at: string }>;
  sourceFreshnessPolicy: Array<Record<string, unknown>>;
  environment: Record<string, unknown>;
  retention: Record<string, unknown>;
}

export interface Report {
  generatedAt: string;
  windowDays: number;
  title: string;
  networks: Array<
    Omit<NetworkSummary, 'sourceFreshness'> & {
      freshness?: Freshness;
      runs: Array<{
        network_id: string;
        status: string;
        count: string;
        avg_latency: number | null;
        providers_seen: string;
        observations_written: string;
      }>;
      observationCoverage: Array<{
        network_id: string;
        metric_key: string;
        observations: string;
        last_observed: string | null;
      }>;
      capacityEvidence: Array<{ network_id: string; evidence: string; providers: string }>;
    }
  >;
  monitors: Array<{
    id: string;
    name: string;
    network_id: string | null;
    checks: number;
    successful: number;
    availability: number | null;
    avg_latency: number | null;
  }>;
  incidents: Array<Record<string, string>>;
  alertDeliveries: Array<Record<string, string>>;
  auditActivity: Array<Record<string, string>>;
  notes: string[];
}

export async function apiGet<T>(path: string): Promise<{
  data: T | null;
  error: string | null;
}> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      return {
        data: null,
        error: `API returned HTTP ${response.status}`,
      };
    }
    return { data: (await response.json()) as T, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : 'The ComputePulse API is unreachable.',
    };
  }
}

export async function apiSend(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(`${PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}
