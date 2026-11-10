import { env } from '../env.js';
import { fetchTextTimed, parseJson } from '../lib/http.js';
import type {
  NetworkCollectionResult,
  NormalizedProvider,
  ProviderAdapter,
  ProviderMetricPoint,
} from './types.js';

const SOURCE_URL = 'https://api.runonflux.io/daemon/listfluxnodes';
const HEAD_URL = 'https://api.runonflux.io/daemon/getblockcount';
const DOCS_URL = 'https://docs.runonflux.io/fluxapi/';

interface FluxNode {
  collateral?: string;
  txhash?: string;
  outidx?: string;
  ip?: string;
  network?: string;
  added_height?: number;
  confirmed_height?: number;
  last_confirmed_height?: number;
  last_paid_height?: number;
  tier?: string;
  payment_address?: string;
  pubkey?: string;
  activesince?: string;
  lastpaid?: string;
  amount?: string;
  rank?: number;
}

interface FluxResponse {
  status: string;
  data: unknown;
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNode(
  raw: FluxNode,
  headHeight: number | null,
  collectedAt: Date,
): NormalizedProvider | null {
  if (!raw.txhash || raw.outidx === undefined || !raw.ip) return null;
  const externalId = `${raw.txhash}:${raw.outidx}`;
  const tier = (raw.tier ?? 'UNKNOWN').toUpperCase();
  const addedHeight = numberOrNull(raw.added_height);
  const lastConfirmed = numberOrNull(raw.last_confirmed_height);
  const lag =
    headHeight !== null && lastConfirmed !== null
      ? Math.max(0, headHeight - lastConfirmed)
      : null;
  const activeSince = numberOrNull(raw.activesince);
  const nodeAgeSeconds =
    activeSince !== null
      ? Math.max(0, Math.round(collectedAt.getTime() / 1000 - activeSince))
      : null;

  const metrics: ProviderMetricPoint[] = [];
  if (lastConfirmed !== null) {
    metrics.push({
      metricKey: 'flux.last_confirmed_height',
      value: lastConfirmed,
      unit: 'block',
      evidenceType: 'reported',
    });
  }
  if (lag !== null) {
    metrics.push({
      metricKey: 'flux.confirmation_lag_blocks',
      value: lag,
      unit: 'blocks',
      evidenceType: 'estimated',
      dimensions: {
        method: 'network_head_minus_last_confirmed_height',
        note: 'A recency signal for chain confirmation, not endpoint liveness.',
      },
    });
  }
  if (nodeAgeSeconds !== null) {
    metrics.push({
      metricKey: 'flux.node_age_seconds',
      value: nodeAgeSeconds,
      unit: 'seconds',
      evidenceType: 'estimated',
      dimensions: { sourceField: 'activesince' },
    });
  }

  return {
    externalId,
    name: `${tier.charAt(0)}${tier.slice(1).toLowerCase()} node`,
    operatorAddress: raw.payment_address ?? null,
    hostUri: raw.ip ?? null,
    region: null,
    country: null,
    city: null,
    locationSource: null,
    hardware: {},
    metadata: {
      tier,
      rank: raw.rank ?? null,
      network: raw.network ?? null,
      collateral: raw.collateral ?? null,
      addedHeight,
      confirmedHeight: numberOrNull(raw.confirmed_height),
      lastConfirmedHeight: lastConfirmed,
      lastPaidHeight: numberOrNull(raw.last_paid_height),
      lastPaid: raw.lastpaid ?? null,
      collateralAmountFlux: raw.amount ?? null,
      pubkey: raw.pubkey ?? null,
      confirmationLagBlocks: lag,
      nodeAgeSeconds,
      hostReference:
        'The public list exposes an IP reference only. ComputePulse does not probe it by default.',
      healthMethod:
        'No online flag is exposed by the public node list. Confirmation lag is displayed as an estimated chain-recency signal.',
      capacityMethod:
        'The public node-list endpoint does not expose capacity. A separate per-node benchmark endpoint exists and is documented as a limitation, not mass-collected.',
    },
    healthState: 'unknown',
    healthSignal: 'unavailable',
    healthReason:
      'The Flux public node list does not expose a liveness or online field. Registration and chain-confirmation recency are shown without converting them into an endpoint-health claim.',
    availability1d: null,
    availability7d: null,
    availability30d: null,
    availabilityMethod: null,
    latestMetrics: {
      'flux.tier': tier,
      'flux.rank': raw.rank ?? null,
      'flux.confirmation_lag_blocks': lag,
      'flux.last_confirmed_height': lastConfirmed,
      'flux.node_age_seconds': nodeAgeSeconds,
      'flux.last_paid_height': numberOrNull(raw.last_paid_height),
    },
    capacity: null,
    capacityEvidence: 'unavailable',
    sourceUrl: SOURCE_URL,
    sourceObservedAt: collectedAt,
    metrics,
  };
}

export class FluxAdapter implements ProviderAdapter {
  readonly metadata = {
    id: 'flux-daemon',
    networkId: 'flux-mainnet',
    name: 'Flux Public Daemon API',
    version: 'flux-daemon@1.0.0',
    sourceUrl: SOURCE_URL,
    docsUrl: DOCS_URL,
    authMethod: 'none' as const,
    rateLimit: 'One full node-list collection per 10 minutes.',
    description:
      'Discovers FluxNodes from the documented public daemon API. The source exposes node registration, tier, collateral and confirmation heights, but no online flag or capacity in the list response.',
    evidenceSummary:
      'Node registry data is source-reported. Confirmation lag is estimated by ComputePulse from the current chain head. No provider endpoint is probed.',
  };

  async collect(context: {
    signal?: AbortSignal;
    now: Date;
  }): Promise<NetworkCollectionResult> {
    const started = performance.now();
    const [listResult, headResult] = await Promise.allSettled([
      fetchTextTimed(SOURCE_URL, {
        timeoutMs: env.ADAPTER_TIMEOUT_MS,
        retries: 2,
        signal: context.signal,
        maxBytes: 24 * 1024 * 1024,
      }),
      fetchTextTimed(HEAD_URL, {
        timeoutMs: 20_000,
        retries: 1,
        signal: context.signal,
        maxBytes: 64 * 1024,
      }),
    ]);

    if (listResult.status === 'rejected') {
      throw listResult.reason instanceof Error
        ? listResult.reason
        : new Error('Flux node-list request failed');
    }

    const payload = parseJson<FluxResponse>(
      listResult.value.text,
      'Flux daemon API',
    );
    if (payload.status !== 'success' || !Array.isArray(payload.data)) {
      throw new Error('Flux daemon API returned an unexpected node-list shape');
    }
    const rawNodes = payload.data.filter(
      (item): item is FluxNode =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as FluxNode).txhash === 'string' &&
        typeof (item as FluxNode).ip === 'string',
    );
    if (payload.data.length > 0 && rawNodes.length < payload.data.length * 0.9) {
      throw new Error(
        `Flux node payload changed shape: ${rawNodes.length}/${payload.data.length} valid records`,
      );
    }

    let headHeight: number | null = null;
    let headError: string | null = null;
    if (headResult.status === 'fulfilled') {
      try {
        const headPayload = parseJson<{
          status: string;
          data: number | string;
        }>(headResult.value.text, 'Flux block count');
        headHeight = numberOrNull(headPayload.data);
      } catch (error) {
        headError = error instanceof Error ? error.message : 'Invalid head response';
      }
    } else {
      headError =
        headResult.reason instanceof Error
          ? headResult.reason.message
          : 'Flux head request failed';
    }

    const seen = new Set<string>();
    const providers: NormalizedProvider[] = [];
    for (const node of rawNodes) {
      const provider = normalizeNode(node, headHeight, context.now);
      if (!provider || seen.has(provider.externalId)) continue;
      seen.add(provider.externalId);
      providers.push(provider);
    }

    const lags = providers
      .map((provider) => provider.latestMetrics['flux.confirmation_lag_blocks'])
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => a - b);
    const medianLag =
      lags.length > 0 ? lags[Math.floor((lags.length - 1) / 2)] : null;
    const tiers = providers.reduce<Record<string, number>>((acc, provider) => {
      const tier = String(provider.latestMetrics['flux.tier'] ?? 'UNKNOWN');
      acc[tier] = (acc[tier] ?? 0) + 1;
      return acc;
    }, {});

    const latencyMs = Math.round(performance.now() - started);
    const degraded = headHeight === null;
    return {
      networkId: this.metadata.networkId,
      status: degraded ? 'degraded' : 'success',
      healthState: degraded ? 'degraded' : 'healthy',
      healthReason: degraded
        ? `Node list succeeded but chain head was unavailable: ${headError}`
        : `Node list and chain head responded in ${latencyMs} ms. Provider liveness is not exposed by this source.`,
      providers,
      networkMetrics: [
        {
          metricKey: 'network.source_latency_ms',
          value: latencyMs,
          unit: 'milliseconds',
          evidenceType: 'observed',
          dimensions: { source: 'flux_node_list_plus_head' },
        },
        {
          metricKey: 'flux.node_count',
          value: providers.length,
          unit: 'nodes',
          evidenceType: 'observed',
        },
        {
          metricKey: 'flux.head_height',
          value: headHeight,
          unit: 'block',
          evidenceType: 'observed',
        },
        {
          metricKey: 'flux.median_confirmation_lag_blocks',
          value: medianLag,
          unit: 'blocks',
          evidenceType: 'estimated',
          dimensions: { method: 'median_of_head_minus_last_confirmed' },
        },
      ],
      sourceLatencyMs: latencyMs,
      sourceObservedAt: context.now,
      detail: {
        recordsReceived: payload.data.length,
        validRecords: rawNodes.length,
        duplicatesSkipped: rawNodes.length - providers.length,
        tiers,
        headHeight,
        headError,
        responseBytes: listResult.value.bytes,
      },
    };
  }
}
