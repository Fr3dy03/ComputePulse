import { AkashAdapter } from './akash.js';
import { botAdapters } from './bot.js';
import { FluxAdapter } from './flux.js';
import type { ProviderAdapter } from './types.js';

export const adapters: ProviderAdapter[] = [
  new AkashAdapter(),
  new FluxAdapter(),
  ...botAdapters,
];

export function getAdapter(networkId: string): ProviderAdapter {
  const adapter = adapters.find(
    (candidate) => candidate.metadata.networkId === networkId,
  );
  if (!adapter) {
    throw new Error(`No adapter registered for network "${networkId}"`);
  }
  return adapter;
}

export function getAdapterMetadata() {
  return adapters.map((adapter) => adapter.metadata);
}
