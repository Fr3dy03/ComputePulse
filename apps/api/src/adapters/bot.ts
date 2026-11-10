import { createPublicClient, http, type Chain } from 'viem';
import type {
  NetworkCollectionResult,
  ProviderAdapter,
} from './types.js';

const CHAINS = {
  'bot-mainnet': {
    id: 677,
    name: 'BOT Chain',
    nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.botchain.ai'] } },
    blockExplorers: {
      default: { name: 'BOTScan', url: 'https://scan.botchain.ai' },
    },
  } satisfies Chain,
  'bot-bohr': {
    id: 968,
    name: 'Bohr Testnet',
    nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
    blockExplorers: {
      default: { name: 'BohrScan', url: 'https://scan.bohr.life' },
    },
    testnet: true,
  } satisfies Chain,
} as const;

type BotNetworkId = keyof typeof CHAINS;

export class BotAdapter implements ProviderAdapter {
  readonly metadata;

  constructor(private readonly networkId: BotNetworkId) {
    const chain = CHAINS[networkId];
    this.metadata = {
      id: `${networkId}-rpc`,
      networkId,
      name: `${chain.name} JSON-RPC`,
      version: 'bot-rpc@1.0.0',
      sourceUrl: chain.rpcUrls.default.http[0],
      docsUrl:
        'https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/',
      authMethod: 'none' as const,
      rateLimit: 'One RPC health sample per minute.',
      description:
        'Measures JSON-RPC responsiveness, verifies chain ID and records head height and block age. BOT is a monitored settlement network and the optional incident-commitment layer, not a compute-provider marketplace.',
      evidenceSummary:
        'RPC latency and block age are directly observed by the ComputePulse worker. Chain identity is verified against the documented chain ID.',
    };
  }

  async collect(context: {
    signal?: AbortSignal;
    now: Date;
  }): Promise<NetworkCollectionResult> {
    const chain = CHAINS[this.networkId];
    const client = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0], {
        timeout: 20_000,
        retryCount: 1,
        retryDelay: 500,
      }),
    });

    const started = performance.now();
    const [chainId, blockNumber, block] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
      client.getBlock({ blockTag: 'latest' }),
    ]);
    const latencyMs = Math.round(performance.now() - started);

    const observedAtSeconds = Number(block.timestamp);
    const blockAgeSeconds = Math.max(
      0,
      Math.round(context.now.getTime() / 1000 - observedAtSeconds),
    );
    const chainIdMatches = chainId === chain.id;
    let healthState: NetworkCollectionResult['healthState'] = 'healthy';
    let healthReason = `Chain ID ${chain.id} verified; head ${blockNumber.toString()} responded in ${latencyMs} ms.`;
    if (!chainIdMatches) {
      healthState = 'down';
      healthReason = `RPC returned chain ID ${chainId}, expected ${chain.id}.`;
    } else if (blockAgeSeconds > 600) {
      healthState = 'down';
      healthReason = `Latest block is ${blockAgeSeconds}s old, beyond the 10 minute failure threshold.`;
    } else if (blockAgeSeconds > 120) {
      healthState = 'degraded';
      healthReason = `Latest block is ${blockAgeSeconds}s old, beyond the 2 minute degraded threshold.`;
    }

    return {
      networkId: this.networkId,
      status: healthState === 'healthy' ? 'success' : 'degraded',
      healthState,
      healthReason,
      providers: [],
      networkMetrics: [
        {
          metricKey: 'chain.rpc_latency_ms',
          value: latencyMs,
          unit: 'milliseconds',
          evidenceType: 'observed',
          dimensions: { method: 'eth_chainId+eth_getBlockByNumber' },
        },
        {
          metricKey: 'chain.chain_id',
          value: chainId,
          unit: 'chain_id',
          evidenceType: 'observed',
          dimensions: { expected: chain.id, matches: chainIdMatches },
        },
        {
          metricKey: 'chain.block_height',
          value: Number(blockNumber),
          unit: 'block',
          evidenceType: 'observed',
        },
        {
          metricKey: 'chain.block_age_seconds',
          value: blockAgeSeconds,
          unit: 'seconds',
          evidenceType: 'observed',
        },
      ],
      sourceLatencyMs: latencyMs,
      sourceObservedAt: context.now,
      detail: {
        expectedChainId: chain.id,
        observedChainId: chainId,
        blockNumber: blockNumber.toString(),
        blockTimestamp: new Date(observedAtSeconds * 1000).toISOString(),
        explorer: chain.blockExplorers?.default.url,
      },
    };
  }
}

export const botAdapters = [
  new BotAdapter('bot-mainnet'),
  new BotAdapter('bot-bohr'),
];
