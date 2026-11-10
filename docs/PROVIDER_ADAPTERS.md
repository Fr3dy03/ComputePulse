# Provider adapters

ComputePulse collects provider-level and network-level evidence through adapters. An adapter is responsible for one source contract: fetch, validate, normalize and report limitations. It is not responsible for UI wording, alert policy or scoring.

## 1. Adapter contract

Defined in `apps/api/src/adapters/types.ts`:

```ts
interface ProviderAdapter {
  readonly metadata: AdapterMetadata;
  collect(context: { signal?: AbortSignal; now: Date }): Promise<NetworkCollectionResult>;
}
```

### Metadata

Every adapter publishes:

- `id` and `version`
- `networkId`
- source URL and documentation URL
- `authMethod` (`none` or `api_key`)
- documented rate limit
- description and evidence summary

This metadata is stored in `network_adapters` and exposed at `/api/v1/adapters`.

### Collection result

```ts
interface NetworkCollectionResult {
  networkId: string;
  status: 'success' | 'degraded';
  healthState: 'healthy' | 'degraded' | 'down' | 'unknown';
  healthReason: string;
  providers: NormalizedProvider[];
  networkMetrics: NetworkMetricPoint[];
  sourceLatencyMs: number;
  sourceObservedAt: Date;
  detail: Record<string, unknown>;
}
```

### Normalized provider

Each provider carries:

- stable external ID and optional display name
- operator address and host reference
- region, country, city and location source
- hardware and source metadata
- `healthState` and `healthSignal`
- availability windows and the method that produced them
- latest metric map
- current capacity and capacity evidence
- source URL and source observation time
- a list of metric points with unit and evidence type

## 2. Akash adapter

File: `apps/api/src/adapters/akash.ts`

### Source contract

- `GET https://console-api.akash.network/v1/providers`
- Public, no authentication.
- Response: JSON array.
- One request per collection. No per-provider calls.

### Field mapping

| Source field | Normalized use | Evidence |
| --- | --- | --- |
| `owner` | `externalId`, operator address | reported |
| `name` | display name | reported |
| `hostUri` | host reference; not probed | reported |
| `isOnline` | health state | reported |
| `isValidVersion` | health state modifier | reported |
| `uptime1d`, `uptime7d`, `uptime30d` | availability windows | reported |
| `lastCheckDate` | source observation time | reported |
| `ipRegion`, `ipCountryCode`, `city` | location | reported |
| `stats.cpu.*` | CPU capacity | reported |
| `stats.memory.*` | memory capacity | reported |
| `stats.storage.*` | storage capacity | reported |
| `stats.gpu.*`, `gpuModels` | GPU capacity | reported |
| `attributes` | declared attributes | reported |

### Health rule

```text
isOnline missing or non-boolean  -> unknown
isOnline === false               -> down
isOnline === true and isValidVersion === false -> degraded
isOnline === true and uptime1d < 0.95          -> degraded
otherwise                                       -> healthy
```

The reason string always names the inputs used. The adapter never probes `hostUri`.

### Capacity units

- CPU: Console API values are millicores. ComputePulse divides by 1,000 and stores cores.
- Memory and storage: bytes.
- GPU: count.
- Evidence: `reported`. This is provider-reported index data, not independently measured schedulable capacity.

### Validation guard

The adapter rejects the payload when it is not an array. It also rejects a payload where fewer than 50% of records have the required `owner` and `hostUri` fields. This prevents a source schema change from producing a misleading near-empty estate.

### Duplicates

Provider records are deduplicated by `owner`. The count skipped is stored in `detail.duplicatesSkipped`.

## 3. Flux adapter

File: `apps/api/src/adapters/flux.ts`

### Source contract

- `GET https://api.runonflux.io/daemon/listfluxnodes`
- `GET https://api.runonflux.io/daemon/getblockcount`
- Public, no authentication.
- Two requests per collection, run concurrently.
- The node list may be large; the byte limit is 24 MiB.

### Field mapping

| Source field | Normalized use | Evidence |
| --- | --- | --- |
| `txhash` + `outidx` | stable node ID | reported |
| `tier` | tier metadata and display name | reported |
| `payment_address` | operator address | reported |
| `ip` | host reference only | reported |
| `added_height` | registration height | reported |
| `last_confirmed_height` | last confirmed height metric | reported |
| `last_paid_height` | payment reference | reported |
| `activesince` | node age | estimated |
| `rank`, `amount`, `collateral`, `pubkey` | metadata | reported |
| chain head | confirmation lag calculation | observed |

### Health semantics

The public node list has **no online or liveness field**. Therefore:

```text
healthState     = unknown
healthSignal    = unavailable
availability*   = null
capacity        = null
capacityEvidence = unavailable
```

The reason string explicitly says that registration and confirmation recency are not endpoint health.

### Estimated metrics

```text
confirmation_lag_blocks = max(0, chain_head - last_confirmed_height)
node_age_seconds        = max(0, collected_at - activesince)
```

Both are marked `estimated`, because they are derived by ComputePulse from source fields. Confirmation lag is a chain-recency signal, not a liveness probe. Median lag is calculated across nodes for the network summary.

### Validation and duplicates

- The response must have `status: "success"` and an array `data`.
- Fewer than 90% valid node records fails the collection.
- Duplicate `txhash:outidx` references are skipped.
- The head request can fail without failing the whole collection; the run becomes `degraded`, lag is `null`, and the head error is stored.

## 4. BOT Chain and Bohr adapters

File: `apps/api/src/adapters/bot.ts`

### Source contract

- BOT mainnet: `https://rpc.botchain.ai`, chain ID 677.
- Bohr testnet: `https://rpc.bohr.life`, chain ID 968.
- Public JSON-RPC, no authentication.
- Calls: `eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`.

### Metrics

| Metric | Unit | Evidence | Meaning |
| --- | --- | --- | --- |
| `chain.rpc_latency_ms` | ms | observed | Time for the three RPC calls |
| `chain.chain_id` | chain ID | observed | Verified against the documented ID |
| `chain.block_height` | block | observed | Latest head |
| `chain.block_age_seconds` | seconds | observed | `now - latest block timestamp` |

### Health rule

```text
chain ID mismatch                  -> down
block age > 600 seconds            -> down
block age > 120 seconds            -> degraded
otherwise                          -> healthy
```

These thresholds describe RPC/chain state, not validator-set quality, transaction inclusion or compute capacity. BOT providers are deliberately empty: BOT is not a compute marketplace.

## 5. Error handling and collection lifecycle

For every collection:

1. The collector inserts a `collection_runs` row with status `running`.
2. The adapter is called with an abort signal and a single `now` value.
3. On success, providers and observations are upserted in bounded chunks.
4. On failure, the run is marked failed, the error is stored, and `data_source_status.consecutive_failures` increments.
5. Existing observations are retained. No zero values are written to replace a failed collection.
6. The source is marked stale when the last success exceeds its stale threshold.
7. Metrics are updated for Prometheus.

HTTP behavior:

- Akash: up to 3 attempts, 90-second default timeout, 16 MiB limit.
- Flux list: up to 3 attempts, 90-second default timeout, 24 MiB limit.
- Flux head: up to 2 attempts, 20-second timeout, 64 KiB limit.
- BOT/Bohr: viem transport, 20-second timeout, one retry.
- Backoff: 500 ms, then 1 second.

## 6. Adding an adapter

1. Create `apps/api/src/adapters/<network>.ts`.
2. Implement `ProviderAdapter` and publish complete metadata.
3. Validate the source shape before normalizing.
4. Mark each metric as `observed`, `reported`, `estimated` or `unavailable`.
5. Add the network seed row and adapter registration.
6. Add tests with representative payloads, malformed payloads, duplicates and source failure.
7. Document evidence limits and rate discipline in this file and in `RESEARCH.md`.
8. Never add a metric that the source does not support. Never convert a missing field into zero.

## 7. Adapter test coverage

`apps/api/tests/unit/adapters.test.ts` covers:

- Akash health and uptime normalization
- Akash CPU millicore-to-core conversion
- offline provider handling without inferred uptime
- duplicate provider owners
- unexpected source shapes
- Flux `unknown` health and unavailable capacity
- estimated confirmation lag
- duplicate Flux references
- Flux head failure degradation
- Flux request count, proving no per-node probing
