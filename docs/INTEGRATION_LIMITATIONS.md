# Integration limitations

ComputePulse is deliberately explicit about the boundary between what it measures, what it receives from a source, and what is only modelled or prepared. This document lists the gaps in the reference build so an operator does not mistake a configured integration for a working guarantee.

## 1. Summary

| Integration | Reference status | What works | What does not |
| --- | --- | --- | --- |
| Akash Console provider API | Live | Public list collection, reported health, uptime windows, capacity fields | No independent provider probing; no workload placement verification |
| Flux public daemon API | Live | Node registration, tier, confirmation heights, chain head, estimated lag | No liveness, no capacity, no per-node benchmark fan-out |
| BOT Chain mainnet RPC | Live | Chain ID, head height, block age, RPC latency | Not a compute marketplace; no provider inventory |
| Bohr testnet RPC | Live | Same chain checks on testnet | Testnet evidence is not production infrastructure evidence |
| Endpoint monitors | Live | Operator-created HTTP checks, history, availability, incident correlation | Only explicitly configured endpoints; no scanning of discovered hosts |
| In-app alerts | Live | Incident timeline delivery rows | No external notification by itself |
| Signed webhooks | Implemented | POST delivery, HMAC signature, delivery row | No retry queue, no dead-letter worker, no subscriber management |
| Email | Placeholder | Readiness state, skipped delivery row | **No email is sent**, even when `SMTP_URL` is set |
| Prometheus | Live | `/metrics` scrape endpoint with `computepulse_` metrics | No bundled Prometheus/Grafana stack or dashboards |
| OpenTelemetry | Optional | OTLP/HTTP trace export when enabled | No collector is bundled, and traces are not product data |
| Redis / BullMQ | Not implemented | `REDIS_URL` is reserved | No distributed queue, delayed jobs or cross-replica locking |
| ProviderIncidentRegistry | Contract complete | Solidity roles, lifecycle, Foundry tests, ABI, deployment script | No permanent deployment or API anchoring worker in the reference build |
| Authentication / RBAC | Local only | Optional admin bearer token for mutations | No user login, sessions, roles or tenant isolation |

## 2. Collection and scheduling

The reference runtime uses an in-process scheduler in `apps/api/src/scheduler.ts`:

- one timer per API process;
- a `tickRunning` guard that prevents overlap inside that process;
- no distributed lock across replicas;
- no durable job record beyond `collection_runs` and monitor rows.

If more than one API replica runs with collection enabled, the same source can be collected more than once. For production, run collection and monitor scheduling in exactly one worker, or add a distributed queue and lock. Redis/BullMQ is a documented deployment option, not a dependency of this build.

The scheduler is time-based, not backfill-based. Historical observations start when the deployment starts collecting. There is no reconstruction of source history that was never fetched. Charts covering a period before first collection show gaps.

## 3. Email

`SMTP_URL` is read and surfaced in integration readiness. It does **not** enable delivery in this build.

When an incident triggers alert delivery:

1. an in-app delivery row is always written;
2. a configured webhook is attempted;
3. an email integration writes a `skipped` delivery row with an explanation such as `SMTP transport is not configured` or `SMTP transport is configured but no recipient preference is set`.

No SMTP client is invoked. Do not represent email as a working notification channel.

## 4. Webhooks

The webhook path is real:

- the destination is validated through the same SSRF controls as monitors;
- the request has a 10-second timeout;
- a JSON payload is sent with `X-ComputePulse-Event: incident.created`;
- when a secret is configured, `X-ComputePulse-Signature: sha256=<HMAC-SHA256>` is included;
- the HTTP result is stored in `alert_deliveries`.

Limitations:

- one attempt; there is no retry/backoff worker;
- 2xx is treated as delivered, other statuses as failed;
- there is no endpoint verification handshake, subscription list or secret rotation API;
- consumer-side signature verification is the receiver's responsibility;
- delivery is incident-creation only; later lifecycle actions update the in-app timeline but do not emit new webhook events.

## 5. Prometheus and OpenTelemetry

`/metrics` is a Prometheus exposition endpoint. It is not authenticated. In production, restrict it at the network or reverse-proxy layer.

Exposed metrics include provider totals and health by network, source latency, last successful collection time, collection attempts, observations written, monitor results and API request duration. They are operational counters and gauges, not a replacement for the provenance-aware product API.

OpenTelemetry export is opt-in (`OTEL_ENABLED=true` plus an OTLP endpoint). No collector, Jaeger instance or dashboard is included. Trace export failing must not be treated as a source collection failure.

## 6. On-chain incident anchoring

`contracts/src/ProviderIncidentRegistry.sol` is a complete, tested registry with the specified roles, structs, functions and events. It intentionally contains no tokens, slashing, penalties, escrow or on-chain metrics.

The reference build does not:

- deploy the contract to BOT mainnet or Bohr;
- run an anchoring worker or API route that submits commitments;
- hold or use `BOT_OPERATOR_PRIVATE_KEY` for automatic transactions.

`INCIDENT_REGISTRY_ADDRESS` being empty is the normal state. The UI displays `not_anchored`; it does not invent an address or a transaction hash. A local Anvil lifecycle was executed during verification, but that address is not a permanent deployment and is not configured in the product.

To enable anchoring, an operator must deploy the contract, configure the address and key, and build the submission workflow. The contract's fixed-size commitments are designed for that workflow, but the bridge between the off-chain incident row and the chain is not included.

## 7. BOT Chain scope

BOT Chain is monitored as a settlement/RPC network and is the intended commitment layer. It is not a compute marketplace and has no provider inventory in this product. Do not read `providerCount = 0` on BOT/Bohr as an outage or as missing collection. It is the correct shape for a network that does not expose compute providers through this integration.

## 8. Provider source limits

### Akash

- `isOnline` and uptime are source-reported, not measured by ComputePulse.
- Resource statistics are provider-reported index values and may not be schedulable.
- The collector performs one list request. It does not probe each `hostUri`.
- The index can be cached or delayed; source collection freshness and record-level observation time are displayed separately.

### Flux

- The public node list has no liveness flag. Every Flux provider is `unknown` with `healthSignal = unavailable`.
- Capacity is not in the list response. It is not inferred from tier, collateral or age.
- Confirmation lag and node age are estimated from source fields; they are not endpoint health.
- The per-node benchmark endpoint is intentionally not mass-queried.

### Endpoint monitors

- A monitor observes one URL that an operator explicitly configures.
- It is not provider-wide availability, and it does not verify consensus or workload execution.
- Results depend on the monitor's network vantage point. A failure at the API host does not prove a global outage.
- SSRF validation blocks private/reserved destinations and non-allowlisted ports, and redirects are not followed.

## 9. Application security and tenancy

- There is no user authentication or session layer in the web app.
- `ADMIN_API_TOKEN` optionally protects mutating API routes with a bearer token. When unset, local mutations are intentionally open for evaluation.
- There is one seeded organisation (`org_computepulse`). There is no tenant isolation model.
- Credentials for monitors are encrypted with AES-256-GCM, but there is no external secret manager integration.
- Audit logs are stored in the same database and are not tamper-evident.
- The reference build does not include CSRF tokens because it does not use cookie sessions; adding cookie authentication requires a CSRF review.

Do not expose the reference build directly to the public internet without adding authentication, TLS termination, network restrictions and an operator review.

## 10. Data and reporting

- PGlite is a single-process local database. Use PostgreSQL in production.
- TimescaleDB is documented but not required; convert `observations` to a hypertable and add retention policies for scale.
- Retention is an application delete loop, not a Timescale policy.
- There is no synthetic/fabricated fallback dataset. If collection fails, old observations remain and freshness becomes stale.
- Percentiles are nearest-rank over available samples. Small sample counts are shown; they are not statistical confidence intervals.
- There is no composite provider score or universal network health percentage, by design.
- Reports are generated from stored observations only; they do not claim coverage outside the collected window.

## 11. Deployment limits

- No Dockerfiles or container images are included.
- No Redis, Prometheus, Grafana, OTLP collector or SMTP relay is provisioned.
- The web and API are separate processes; there is no built-in reverse proxy.
- `apps/web/public/docs` contains a static copy of the reference documents. Update it when the source documents change.
- The API's production `dist` build copies `schema.sql`; do not remove that build step.
- A single local database file/directory is not a backup strategy. Backups and restore drills are operator responsibilities.

## 12. What remains honest

The required evidence states are preserved across these limitations:

- `OBSERVED` means measured directly by this deployment.
- `REPORTED` means supplied by a source and not independently verified.
- `ESTIMATED` means derived through a documented formula.
- `UNAVAILABLE` means the source does not expose the signal.
- `STALE` means a previous value exceeds its freshness policy.
- `PENDING` means a workflow has not produced its first result.

Limitations are not hidden behind optimistic defaults. A missing value stays missing, and an unconfigured integration stays visibly unconfigured.
