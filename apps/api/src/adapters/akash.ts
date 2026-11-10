import { env } from '../env.js';
import { fetchTextTimed, parseJson } from '../lib/http.js';
import type {
  NetworkCollectionResult,
  NormalizedProvider,
  ProviderAdapter,
  ProviderMetricPoint,
} from './types.js';

const SOURCE_URL = 'https://console-api.akash.network/v1/providers';
const DOCS_URL =
  'https://akash.network/docs/api-documentation/rest-api/providers-api/';

interface AkashResource {
  active?: number;
  available?: number;
  pending?: number;
  total?: number;
}

interface AkashStats {
  cpu?: AkashResource;
  gpu?: AkashResource;
  memory?: AkashResource;
  storage?: {
    ephemeral?: AkashResource;
    persistent?: AkashResource;
    total?: AkashResource;
  };
}

interface AkashProvider {
  owner: string;
  name?: string | null;
  hostUri: string;
  createdHeight?: number;
  email?: string | null;
  website?: string | null;
  lastCheckDate?: string | null;
  isOnline?: boolean;
  isAudited?: boolean;
  isValidVersion?: boolean;
  akashVersion?: string | null;
  cosmosSdkVersion?: string | null;
  uptime1d?: number;
  uptime7d?: number;
  uptime30d?: number;
  ipRegion?: string | null;
  ipRegionCode?: string | null;
  ipCountry?: string | null;
  ipCountryCode?: string | null;
  country?: string | null;
  city?: string | null;
  timezone?: string | null;
  hardwareCpu?: string | null;
  hardwareCpuArch?: string | null;
  hardwareGpuVendor?: string | null;
  hardwareGpuModels?: string[];
  hardwareMemory?: string | null;
  hardwareDisk?: string[];
  gpuModels?: Array<{
    vendor?: string;
    model?: string;
    ram?: string;
    interface?: string;
  }>;
  networkProvider?: string | null;
  networkSpeedDown?: number;
  networkSpeedUp?: number;
  featPersistentStorage?: boolean;
  featEndpointCustomDomain?: boolean;
  featEndpointIp?: boolean;
  attributes?: Array<{ key: string; value: string; auditedBy?: string[] }>;
  stats?: AkashStats;
  tier?: string | null;
}

function ratio(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(1, value)
    : null;
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeProvider(
  raw: AkashProvider,
  sourceLatencyMs: number,
  collectedAt: Date,
): NormalizedProvider {
  const online = raw.isOnline === true;
  const validVersion = raw.isValidVersion !== false;
  const uptime1d = ratio(raw.uptime1d);
  const uptime7d = ratio(raw.uptime7d);
  const uptime30d = ratio(raw.uptime30d);

  let healthState: NormalizedProvider['healthState'] = 'unknown';
  let healthReason = 'The index did not return an interpretable online state.';
  if (typeof raw.isOnline === 'boolean') {
    if (!online) {
      healthState = 'down';
      healthReason = 'Akash Console API reports this provider offline.';
    } else if (!validVersion) {
      healthState = 'degraded';
      healthReason =
        'Provider is online but the index marks its software version invalid.';
    } else if (uptime1d !== null && uptime1d < 0.95) {
      healthState = 'degraded';
      healthReason = `Provider is online but source-reported 24h uptime is ${(
        uptime1d * 100
      ).toFixed(2)}%.`;
    } else {
      healthState = 'healthy';
      healthReason =
        'Provider is online with a valid software version and source-reported 24h uptime at or above 95%.';
    }
  }

  const lastCheck = raw.lastCheckDate ? new Date(raw.lastCheckDate) : null;
  const sourceAgeSeconds =
    lastCheck && !Number.isNaN(lastCheck.getTime())
      ? Math.max(0, Math.round((collectedAt.getTime() - lastCheck.getTime()) / 1000))
      : null;

  const metrics: ProviderMetricPoint[] = [];
  if (typeof raw.isOnline === 'boolean') {
    metrics.push({
      metricKey: 'provider.online',
      value: raw.isOnline ? 1 : 0,
      unit: 'state',
      evidenceType: 'reported',
    });
  }
  for (const [key, value] of [
    ['akash.uptime_1d', uptime1d],
    ['akash.uptime_7d', uptime7d],
    ['akash.uptime_30d', uptime30d],
  ] as const) {
    if (value !== null) {
      metrics.push({
        metricKey: key,
        value,
        unit: 'ratio',
        evidenceType: 'reported',
      });
    }
  }
  if (sourceAgeSeconds !== null) {
    metrics.push({
      metricKey: 'akash.source_age_seconds',
      value: sourceAgeSeconds,
      unit: 'seconds',
      evidenceType: 'observed',
      dimensions: { sourceField: 'lastCheckDate' },
    });
  }

  const latestMetrics: NormalizedProvider['latestMetrics'] = {
    'akash.uptime_1d': uptime1d,
    'akash.uptime_7d': uptime7d,
    'akash.uptime_30d': uptime30d,
    'akash.source_age_seconds': sourceAgeSeconds,
    'akash.source_latency_ms': sourceLatencyMs,
    'akash.online': typeof raw.isOnline === 'boolean' ? (raw.isOnline ? 1 : 0) : null,
    'akash.valid_version':
      typeof raw.isValidVersion === 'boolean' ? raw.isValidVersion : null,
    'akash.version': raw.akashVersion ?? null,
    'akash.audited': raw.isAudited === true,
  };

  const cpu = raw.stats?.cpu;
  const memory = raw.stats?.memory;
  const gpu = raw.stats?.gpu;
  const storage = raw.stats?.storage?.total ?? raw.stats?.storage?.ephemeral;

  const cpuTotal = numeric(cpu?.total);
  const memoryTotal = numeric(memory?.total);
  const gpuTotal = numeric(gpu?.total);
  const storageTotal = numeric(storage?.total);

  let capacity: NormalizedProvider['capacity'] = null;
  if (
    (cpuTotal !== null && cpuTotal > 0) ||
    (memoryTotal !== null && memoryTotal > 0) ||
    (gpuTotal !== null && gpuTotal > 0) ||
    (storageTotal !== null && storageTotal > 0)
  ) {
    capacity = {
      evidence: 'reported',
      cpuTotalCores: cpuTotal !== null ? cpuTotal / 1000 : null,
      cpuAvailableCores:
        numeric(cpu?.available) !== null ? (numeric(cpu?.available) as number) / 1000 : null,
      cpuActiveCores:
        numeric(cpu?.active) !== null ? (numeric(cpu?.active) as number) / 1000 : null,
      memoryTotalBytes: memoryTotal,
      memoryAvailableBytes: numeric(memory?.available),
      memoryActiveBytes: numeric(memory?.active),
      storageTotalBytes: storageTotal,
      storageAvailableBytes: numeric(storage?.available),
      gpuTotal,
      gpuAvailable: numeric(gpu?.available),
      gpuActive: numeric(gpu?.active),
      gpuModels: (raw.gpuModels ?? []).map((model) => ({ ...model })),
      raw: {
        cpu: cpu ?? null,
        gpu: gpu ?? null,
        memory: memory ?? null,
        storage: raw.stats?.storage ?? null,
        sourceField: 'stats',
        unitNotes:
          'CPU values divided by 1000 (millicores to cores); memory and storage are bytes.',
      },
    };
    for (const [key, value, unit] of [
      ['akash.cpu.available_cores', capacity.cpuAvailableCores, 'cores'],
      ['akash.cpu.total_cores', capacity.cpuTotalCores, 'cores'],
      ['akash.gpu.available', capacity.gpuAvailable, 'gpu'],
      ['akash.memory.available_bytes', capacity.memoryAvailableBytes, 'bytes'],
    ] as const) {
      if (value !== null && value !== undefined) {
        metrics.push({
          metricKey: key,
          value,
          unit,
          evidenceType: 'reported',
          dimensions: { evidence: 'provider-reported index capacity' },
        });
      }
    }
    latestMetrics['akash.cpu.available_cores'] =
      capacity.cpuAvailableCores ?? null;
    latestMetrics['akash.cpu.total_cores'] = capacity.cpuTotalCores ?? null;
    latestMetrics['akash.gpu.available'] = capacity.gpuAvailable ?? null;
    latestMetrics['akash.memory.available_bytes'] =
      capacity.memoryAvailableBytes ?? null;
  }

  const attributes = Array.isArray(raw.attributes) ? raw.attributes : [];
  const hardware = {
    cpu: raw.hardwareCpu ?? null,
    cpuArch: raw.hardwareCpuArch ?? null,
    gpuVendor: raw.hardwareGpuVendor ?? null,
    gpuModels: raw.hardwareGpuModels ?? [],
    memory: raw.hardwareMemory ?? null,
    disk: raw.hardwareDisk ?? [],
    networkProvider: raw.networkProvider ?? null,
    networkSpeedDown: raw.networkSpeedDown ?? null,
    networkSpeedUp: raw.networkSpeedUp ?? null,
  };

  return {
    externalId: raw.owner,
    name: raw.name?.trim() || null,
    operatorAddress: raw.owner,
    hostUri: raw.hostUri ?? null,
    region:
      raw.ipRegion ??
      raw.ipRegionCode ??
      attributes.find((attribute) => attribute.key === 'region')?.value ??
      null,
    country: raw.ipCountryCode ?? raw.ipCountry ?? raw.country ?? null,
    city: raw.city ?? null,
    locationSource:
      raw.ipCountryCode || raw.ipCountry || raw.city
        ? 'Akash Console API IP geolocation / declared location'
        : null,
    hardware,
    metadata: {
      createdHeight: raw.createdHeight ?? null,
      website: raw.website ?? null,
      emailPresent: Boolean(raw.email),
      isAudited: raw.isAudited ?? null,
      isValidVersion: raw.isValidVersion ?? null,
      akashVersion: raw.akashVersion ?? null,
      cosmosSdkVersion: raw.cosmosSdkVersion ?? null,
      tier: raw.tier ?? null,
      timezone: raw.timezone ?? null,
      attributes,
      features: {
        persistentStorage: raw.featPersistentStorage ?? null,
        customDomain: raw.featEndpointCustomDomain ?? null,
        dedicatedIp: raw.featEndpointIp ?? null,
      },
      sourceLastCheckDate: lastCheck?.toISOString() ?? null,
      sourceLastCheckAgeSeconds: sourceAgeSeconds,
      sourceLatencyMs,
      healthMethod:
        'isOnline + isValidVersion + source-reported uptime1d from the Akash Console provider index.',
      capacityUnits:
        'Console API CPU millicores converted to cores. Values are provider-reported, not independently measured.',
    },
    healthState,
    healthSignal: 'source_reported',
    healthReason,
    availability1d: uptime1d,
    availability7d: uptime7d,
    availability30d: uptime30d,
    availabilityMethod: 'akash_console_reported_uptime',
    latestMetrics,
    capacity,
    capacityEvidence: capacity ? 'reported' : 'unavailable',
    sourceUrl: SOURCE_URL,
    sourceObservedAt: lastCheck && !Number.isNaN(lastCheck.getTime()) ? lastCheck : collectedAt,
    metrics,
  };
}

export class AkashAdapter implements ProviderAdapter {
  readonly metadata = {
    id: 'akash-console',
    networkId: 'akash-mainnet',
    name: 'Akash Console Provider API',
    version: 'akash-console@1.0.0',
    sourceUrl: SOURCE_URL,
    docsUrl: DOCS_URL,
    authMethod: 'none' as const,
    rateLimit: 'One collection per scheduled interval; no per-provider probing.',
    description:
      'Discovers Akash providers through the public Console API, including source-reported online state, uptime windows, location, hardware and provider-reported resource stats.',
    evidenceSummary:
      'Health and uptime are source-reported. Capacity is provider-reported by the index. No independent availability probes are made.',
  };

  async collect(context: {
    signal?: AbortSignal;
    now: Date;
  }): Promise<NetworkCollectionResult> {
    const response = await fetchTextTimed(SOURCE_URL, {
      timeoutMs: env.ADAPTER_TIMEOUT_MS,
      retries: 2,
      signal: context.signal,
      maxBytes: 16 * 1024 * 1024,
    });
    const payload = parseJson<unknown>(response.text, 'Akash Console API');
    if (!Array.isArray(payload)) {
      throw new Error('Akash Console API did not return a provider array');
    }
    const rawProviders = payload.filter(
      (item): item is AkashProvider =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as AkashProvider).owner === 'string' &&
        typeof (item as AkashProvider).hostUri === 'string',
    );
    if (payload.length > 0 && rawProviders.length < payload.length * 0.5) {
      throw new Error(
        `Akash provider payload changed shape: ${rawProviders.length}/${payload.length} valid records`,
      );
    }

    const seen = new Set<string>();
    const providers: NormalizedProvider[] = [];
    for (const raw of rawProviders) {
      if (seen.has(raw.owner)) continue;
      seen.add(raw.owner);
      providers.push(
        normalizeProvider(raw, response.latencyMs, context.now),
      );
    }

    const online = providers.filter(
      (provider) => provider.healthState === 'healthy' || provider.healthState === 'degraded',
    ).length;
    const withCapacity = providers.filter(
      (provider) => provider.capacityEvidence === 'reported',
    ).length;

    return {
      networkId: this.metadata.networkId,
      status: 'success',
      healthState: 'healthy',
      healthReason: `Provider index responded successfully in ${response.latencyMs} ms.`,
      providers,
      networkMetrics: [
        {
          metricKey: 'network.source_latency_ms',
          value: response.latencyMs,
          unit: 'milliseconds',
          evidenceType: 'observed',
          dimensions: { source: 'akash_console_list' },
        },
        {
          metricKey: 'network.providers_listed',
          value: providers.length,
          unit: 'providers',
          evidenceType: 'observed',
        },
        {
          metricKey: 'network.providers_source_online',
          value: online,
          unit: 'providers',
          evidenceType: 'reported',
        },
        {
          metricKey: 'network.providers_with_reported_capacity',
          value: withCapacity,
          unit: 'providers',
          evidenceType: 'reported',
        },
      ],
      sourceLatencyMs: response.latencyMs,
      sourceObservedAt: context.now,
      detail: {
        recordsReceived: payload.length,
        validRecords: rawProviders.length,
        duplicatesSkipped: rawProviders.length - providers.length,
        responseBytes: response.bytes,
      },
    };
  }
}
