export type HealthState = 'healthy' | 'degraded' | 'down' | 'unknown';
export type EvidenceType =
  | 'observed'
  | 'reported'
  | 'estimated'
  | 'unavailable';

export interface NormalizedCapacity {
  evidence: EvidenceType;
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
  raw?: Record<string, unknown>;
}

export interface ProviderMetricPoint {
  metricKey: string;
  value: number | null;
  unit: string;
  evidenceType: EvidenceType;
  dimensions?: Record<string, unknown>;
}

export interface NormalizedProvider {
  externalId: string;
  name: string | null;
  operatorAddress: string | null;
  hostUri: string | null;
  region: string | null;
  country: string | null;
  city: string | null;
  locationSource: string | null;
  hardware: Record<string, unknown>;
  metadata: Record<string, unknown>;
  healthState: HealthState;
  healthSignal: 'source_reported' | 'observed' | 'estimated' | 'unavailable';
  healthReason: string;
  availability1d: number | null;
  availability7d: number | null;
  availability30d: number | null;
  availabilityMethod: string | null;
  latestMetrics: Record<string, number | string | boolean | null>;
  capacity: NormalizedCapacity | null;
  capacityEvidence: EvidenceType;
  sourceUrl: string;
  sourceObservedAt: Date | null;
  metrics: ProviderMetricPoint[];
}

export interface NetworkMetricPoint {
  metricKey: string;
  value: number | null;
  unit: string;
  evidenceType: EvidenceType;
  dimensions?: Record<string, unknown>;
}

export interface NetworkCollectionResult {
  networkId: string;
  status: 'success' | 'degraded';
  healthState: HealthState;
  healthReason: string;
  providers: NormalizedProvider[];
  networkMetrics: NetworkMetricPoint[];
  sourceLatencyMs: number;
  sourceObservedAt: Date;
  detail: Record<string, unknown>;
}

export interface AdapterMetadata {
  id: string;
  networkId: string;
  name: string;
  version: string;
  sourceUrl: string;
  docsUrl: string;
  authMethod: 'none' | 'api_key';
  rateLimit: string;
  description: string;
  evidenceSummary: string;
}

export interface ProviderAdapter {
  readonly metadata: AdapterMetadata;
  collect(context: { signal?: AbortSignal; now: Date }): Promise<NetworkCollectionResult>;
}
