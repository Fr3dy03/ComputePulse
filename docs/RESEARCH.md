# Research and source verification

Last verified: **10 November 2026**. All source calls below were made from the reference workspace during implementation and re-checked while writing this document. Numbers are a snapshot, not a guarantee of current source size.

## 1. Selection rules

A source was accepted only when all of the following were true:

1. The endpoint was publicly reachable without a private credential.
2. The endpoint or its documentation described the response shape and intended use.
3. The fields needed for provider discovery or network health were present in the response.
4. The collection method did not require mass-probing provider hosts or bypassing rate limits.
5. The source's limitations could be stated precisely enough that the UI would not overclaim.

A source was rejected or deferred when access required an undisclosed token, when the terms prohibited the proposed collection, or when the available response could not support the claim we wanted to make.

## 2. Verified sources

| Network | Role | Endpoint | Method | Auth | Observed result |
| --- | --- | --- | --- | --- | --- |
| Akash Network | Compute marketplace | `https://console-api.akash.network/v1/providers` | `GET`, one list request | None | 1,874 providers, 9,562 observations in one reference run |
| Flux Network | Compute network | `https://api.runonflux.io/daemon/listfluxnodes` | `GET`, one list request | None | 6,892 node records in the reference database |
| Flux Network | Chain head for lag | `https://api.runonflux.io/daemon/getblockcount` | `GET` | None | Head height used to derive confirmation lag |
| BOT Chain mainnet | Settlement network / optional commitment layer | `https://rpc.botchain.ai` | JSON-RPC | None | Chain ID 677 verified; head height and block age collected |
| Bohr testnet | BOT testnet | `https://rpc.bohr.life` | JSON-RPC | None | Chain ID 968 verified; head height and block age collected |

### Akash Console Provider API

- Endpoint: `https://console-api.akash.network/v1/providers`
- Documentation: `https://akash.network/docs/api-documentation/rest-api/providers-api/`
- Response shape: a JSON array of provider objects.
- Fields used: `owner`, `name`, `hostUri`, `isOnline`, `isValidVersion`, `uptime1d`, `uptime7d`, `uptime30d`, `lastCheckDate`, `ipRegion`, `ipCountryCode`, `stats.cpu`, `stats.memory`, `stats.gpu`, `stats.storage`, `gpuModels`, `attributes`, `akashVersion`.
- Why it was accepted: it is the public provider index used by the Akash Console, it exposes an explicit online flag and source-computed uptime windows, and one list request returns the full provider set.
- What it supports: source-reported health, source-reported uptime, provider location and hardware, and provider-reported resource statistics.
- What it does **not** support: independent endpoint probes, workload placement success, a guarantee that reported free capacity is schedulable, or an authoritative outage onset.

Reference run captured on 10 November 2026:

```text
adapter:       akash-console@1.0.0
providers:     1,874
observations:  9,562
status:        success
source latency: 1,219 ms
```

### Flux public daemon API

- Node list: `https://api.runonflux.io/daemon/listfluxnodes`
- Head: `https://api.runonflux.io/daemon/getblockcount`
- Documentation: `https://docs.runonflux.io/fluxapi/`
- Fields used: `txhash`, `outidx`, `ip`, `tier`, `payment_address`, `added_height`, `last_confirmed_height`, `last_paid_height`, `activesince`, `rank`, `amount`, `pubkey`.
- Why it was accepted: it is a documented public daemon endpoint and returns the node registry without authentication.
- What it supports: registration data, tier, collateral references, payment references, confirmation heights and an estimated chain-recency signal.
- What it does **not** support: liveness. The public list has no online flag. Capacity is not in the list response. A separate per-node benchmark endpoint exists but is deliberately not mass-queried.

Reference run captured on 10 November 2026:

```text
adapter:       flux-daemon@1.0.0
node records:  6,892
observations:  20,677 in a reference run
status:        success
source latency: 1,335 ms
```

ComputePulse sets Flux provider health to `unknown`, health signal to `unavailable`, and capacity evidence to `unavailable`. Confirmation lag is explicitly `estimated`; it is not endpoint health.

### BOT Chain mainnet and Bohr testnet

- BOT mainnet RPC: `https://rpc.botchain.ai`, chain ID `677`, explorer `https://scan.botchain.ai/`.
- Bohr testnet RPC: `https://rpc.bohr.life`, chain ID `968`, explorer `https://scan.bohr.life/`.
- Documentation: `https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/`.
- Calls: `eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`.
- Why it was accepted: the RPC endpoints are public and the chain IDs are documented.
- What it supports: observed RPC responsiveness, verified chain identity, head height and block age.
- What it does **not** support: provider discovery. BOT Chain is a settlement and commitment network, not a compute marketplace. It is presented as a monitored network and as the optional incident-commitment layer, never as a provider marketplace.

Reference results:

```text
BOT mainnet: chain 677, head 29,793,840, source latency 681 ms
Bohr:        chain 968, head 29,960,433, source latency 688 ms
```

## 3. Rejected or deferred candidates

### Vast.ai

The documented supplier API requires Bearer authentication. No public, credential-free provider index with the fields needed for this product was available. Vast.ai was therefore **not** integrated. The codebase must not pretend that a private API was queried or that a key exists.

### Flux per-node benchmark endpoint

Flux documents a per-node benchmark endpoint. Querying it for every node would turn one discovery collection into thousands of requests and would be difficult to defend under rate-limit and courtesy constraints. It is documented as a limitation. The app does not mass-query provider hosts.

### Direct probing of provider host references

Akash exposes `hostUri` and Flux exposes an IP reference. Neither is probed by the default collector. A provider endpoint monitor is an explicit operator action, goes through the SSRF controls, and produces a separate observed endpoint signal. A host reference is not treated as permission to scan infrastructure.

### Universal network health score

No source exposes a comparable, universal "network health" percentage. Akash exposes a liveness flag and uptime windows; Flux exposes registration and confirmation data; BOT exposes chain/RPC state. Combining them into one number would hide incompatible evidence. The product intentionally does not do it.

## 4. Access and licensing notes

- The source APIs above are consumed directly over HTTPS. ComputePulse does not redistribute bulk raw dumps.
- Documentation links are preserved in the UI and API metadata.
- BOT Chain branding uses the authentic SVG in `apps/web/public/bot-chain.svg`; the footer links to the official site and explorer.
- Source names and logos remain the property of their respective networks.
- Rate discipline: one Akash list request per 5 minutes, one Flux list request per 10 minutes, one BOT/Bohr RPC sample per minute by default. The scheduler does not fan out into per-provider probing.
- Response byte limits are enforced: Akash 16 MiB, Flux list 24 MiB, Flux head 64 KiB, monitor responses 12 MiB.

## 5. Verification method

The reference database was populated by the normal collector, not by fixtures:

```bash
npm run seed
npm run collect -w @computepulse/api -- akash-mainnet
npm run collect -w @computepulse/api -- flux-mainnet
npm run collect -w @computepulse/api -- bot-mainnet
```

The documented source metadata is available from the running API:

```bash
curl http://localhost:8787/api/v1/meta
curl http://localhost:8787/api/v1/adapters
```

A real incident was correlated from an Akash provider that the source reported offline. Its title contains the real provider prefix `akash1007dp5x90n8t`, and its source commitment is generated from the persisted incident row. It is not a fixture with invented timestamps.

## 6. Known research risks

- Source schemas can change without notice. Each adapter has a shape guard that fails the collection instead of reporting an empty or partial estate.
- `lastCheckDate` is a source update time, not a ComputePulse observation time. The app preserves both concepts.
- A source can return a cached or stale list. Freshness is evaluated on the collection timestamp and is displayed separately from record-level timestamps.
- Public endpoints can rate-limit or block the collector. The adapter retries and then records a failed run; it never converts a failed request into "zero providers".
- Numbers in this document are snapshots. Use the live app and `/api/v1/meta` for the current state.
