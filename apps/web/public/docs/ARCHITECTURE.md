# Architecture

ComputePulse is a Next.js web application plus a Fastify API worker. It collects provider and network evidence from public sources, persists the evidence, exposes it through a typed API, and renders an operations UI. The application is primarily off-chain. The Solidity registry is a deliberately optional commitment layer.

## 1. Repository layout

```text
ComputePulse/
  apps/
    api/                 Fastify API, collectors, scheduler, database, tests
      src/
        adapters/        Akash, Flux, BOT/Bohr source adapters
        cli/             seed and collect commands
        db/              database abstraction, schema, seed
        lib/             HTTP, SSRF, crypto, IDs, time
        observability/   Prometheus metrics
        routes/          HTTP routes and OpenAPI document
        services/        collector, monitors, incidents, analytics, admin
      tests/             Vitest unit and integration tests
    web/                 Next.js 15 marketing site and SRE app
      src/app/           App Router routes
      src/components/    shared UI, provenance table, charts, forms
      src/lib/           API client and shared types
      public/            BOT Chain SVG, copied reference docs
  contracts/
    src/                 ProviderIncidentRegistry.sol
    test/                Foundry tests
    script/              Foundry deployment script
    abi/                 Exported ABI
  docs/                  six reference documents
  foundry.toml           Foundry root configuration
```

## 2. Runtime topology

```text
Browser
  |
  | HTTPS
  v
Next.js web (port 3000)
  |  server-side fetch at request time (force-dynamic)
  v
Fastify API (port 8787)
  |-- PostgreSQL or embedded PGlite
  |-- source adapters ---> Akash Console API
  |                    ---> Flux daemon API
  |                    ---> BOT / Bohr JSON-RPC
  |-- monitor worker  ---> operator-configured HTTPS endpoints
  |-- Prometheus      ---> /metrics
  |-- OpenTelemetry   ---> optional OTLP collector
  |-- webhook         ---> optional signed HTTPS destination
  |-- registry        ---> optional BOT Chain contract (not configured by default)
```

The reference workspace runs both processes locally. The web app does not use a build-time snapshot: every app page is `force-dynamic` and reads the API at request time. If the API is unreachable, pages render an explicit error state instead of stale fixtures.

## 3. Web application

- Next.js 15 App Router, React 19, TypeScript.
- Marketing routes are server-rendered with live evidence summaries where useful.
- App routes are server-rendered and use the API client in `apps/web/src/lib/api.ts`.
- Client components handle filters, charts, forms and mutations.
- The signature provider table shows source-reported 24h, 7d and 30d availability, provenance details and an active-incident column. Provider and monitor detail views use a history chart with 1h, 24h, 7d, 30d and custom ranges.
- Design system: dark SRE palette defined in `globals.css`; Inter for text and IBM Plex Mono for data. No light theme.
- The BOT Chain footer appears on marketing and app layouts with the authentic SVG, official site, explorer and "Built on BOT Chain".

## 4. API

Fastify 5 with TypeScript, running from `apps/api`.

### Route groups

| Area | Routes |
| --- | --- |
| Meta | `/api/v1/meta`, `/api/v1/adapters`, `/api/v1/metric-definitions`, `/api/v1/openapi.json`, `/api/docs` |
| Networks | `/api/v1/networks`, `/api/v1/networks/:id`, `/api/v1/networks/:id/history` |
| Providers | `/api/v1/providers`, `/api/v1/providers/:id`, `/api/v1/providers/:id/history` |
| Capacity | `/api/v1/capacity` |
| Benchmarks | `/api/v1/benchmarks` |
| Reports | `/api/v1/reports` |
| Monitors | `/api/v1/monitors`, `/api/v1/monitors/:id`, `/api/v1/monitors/:id/check`, `/api/v1/monitors/run-due` |
| Incidents | `/api/v1/incidents`, `/api/v1/incidents/:id`, `/api/v1/incidents/:id/actions` |
| Alerts | `/api/v1/alert-rules`, `/api/v1/alert-rules/:id`, `/api/v1/integrations`, `/api/v1/integrations/:id` |
| Settings | `/api/v1/settings` |
| Operations | `/api/v1/collection/status`, `/api/v1/collect` |
| Observability | `/health`, `/metrics` |

The OpenAPI document is generated in `apps/api/src/routes/openapi.ts`. A human-readable route index is available at `/api/docs`.

### Validation and errors

- Zod is used for request validation and query normalization where applicable.
- Errors return a stable `error` code and a safe message.
- In production, 5xx messages are replaced with a generic message while the full error is logged.
- The body limit is 1 MiB.
- CORS allows the configured `APP_ORIGIN` plus localhost development origins.
- Rate limit: 240 requests per minute per client, with loopback allow-listed for local tooling.

## 5. Database

The API supports two modes through `apps/api/src/db/client.ts`:

- `DATABASE_URL` set: PostgreSQL via `pg`.
- `DATABASE_URL` empty: embedded PGlite at `PGLITE_DIR`.

The schema is shared. The reference workspace uses PGlite. Production should use PostgreSQL; TimescaleDB is the documented time-series option.

### Tables

| Table | Purpose |
| --- | --- |
| `organisations`, `users` | local operator workspace and user references |
| `networks` | monitored networks and source metadata |
| `network_adapters` | adapter version, source URL, last run and error |
| `data_source_status` | freshness state, intervals, stale threshold, failures |
| `collection_runs` | one row per adapter run, counts, latency, worker, error |
| `providers` | latest normalized provider state and evidence |
| `provider_endpoints` | declared endpoint references (not mass-probed) |
| `monitors`, `monitor_checks` | operator-configured HTTP checks and history |
| `metric_definitions` | units, evidence and comparability groups |
| `observations` | time-series metric rows with source, method and dimensions |
| `capacity_snapshots` | capacity evidence over time |
| `workload_references` | reserved workload references where a source supports them |
| `incidents`, `incident_events` | lifecycle, notes, commitments, anchor state |
| `alert_rules`, `alert_deliveries` | rules and delivery attempts |
| `integrations` | Prometheus, OpenTelemetry, webhook, email readiness |
| `transactions` | optional on-chain transaction references |
| `audit_logs` | operator and worker actions |
| `settings` | retention, freshness and notification preferences |

### Time-series design

- `observations` is the primary append table.
- Each row carries `network_id`, optional `provider_id`, `metric_key`, `value`, `unit`, evidence state, `observed_at`, dimensions and source metadata.
- Indexes support network/provider metric history and recent-window queries.
- The local schema is plain PostgreSQL. For production TimescaleDB, convert `observations` to a hypertable on `observed_at`, add retention/compression policies, and consider continuous aggregates for 1h/24h rollups. The API queries remain valid.
- PGlite is single-process and intended for local evaluation. It is not a production concurrency story.

## 6. Collection flow

1. The scheduler (or `POST /api/v1/collect`) selects networks whose `data_source_status.last_attempt_at` is due.
2. `collectNetwork()` creates a `collection_runs` row.
3. The adapter fetches and validates the source.
4. Providers are upserted by stable ID `sha256(networkId + externalId)`.
5. Observations are bulk-inserted in chunks.
6. Capacity snapshots are written when present.
7. A successful run updates the adapter, source status and network health.
8. A failed run records the error and increments failures; old data remains.
9. Prometheus gauges/counters are updated.
10. Freshness is refreshed on the scheduler tick.
11. Retention runs at most once per hour.

### Scheduling

The reference deployment uses an in-process scheduler (`apps/api/src/scheduler.ts`):

- tick every 30 seconds by default
- monitors due by their own interval
- network collections due by `expected_interval_seconds`
- staleness refresh
- hourly retention

This is intentionally simple. For multiple API replicas, run one collector worker or move scheduling to Redis/BullMQ with a distributed lock. The current build does not claim that BullMQ is active; see `INTEGRATION_LIMITATIONS.md`.

### Idempotency and duplicates

- `providers` has `UNIQUE(network_id, external_id)`.
- Provider IDs are deterministic hashes.
- Adapter-level duplicate references are skipped before persistence.
- `collection_runs` is append-only; a retry creates a new run.
- Upserts update the latest provider state while `observations` preserves history.

## 7. Incidents and alerts

- Incidents are stored off-chain with a full event timeline.
- `createIncident()` writes the incident, the `created` event, an audit row, an in-app delivery and any configured webhook/email delivery rows.
- Monitor failure correlation opens an incident after two consecutive failed checks.
- Recovery adds a note and an in-app delivery. It deliberately does **not** auto-close the incident; an operator must resolve it.
- Incident actions enforce a state machine: open → acknowledged → investigating → mitigated → resolved → closed, with explicit allowed transitions.
- Webhook payloads are JSON and signed with `X-ComputePulse-Signature: sha256=<HMAC-SHA256>` when a secret is configured.
- The optional on-chain registry anchors fixed-size commitments only.

## 8. Smart contract

`contracts/src/ProviderIncidentRegistry.sol` uses OpenZeppelin `AccessControl`.

Roles:

- `DEFAULT_ADMIN_ROLE`
- `PROVIDER_OPERATOR_ROLE`
- `INCIDENT_ATTESTOR_ROLE`

Functions:

- `registerProvider(bytes32 providerId, bytes32 networkId, address operator)`
- `submitIncidentCommitment(bytes32 incidentId, bytes32 providerId, bytes32 summaryDigest, bytes32 sourceCommitment)`
- `acknowledgeIncident(bytes32 incidentId)`
- `submitRemediationCommitment(bytes32 incidentId, bytes32 remediationCommitment)`
- `closeIncident(bytes32 incidentId)`
- `getIncident(bytes32 incidentId)`
- `getIncidentStatus(bytes32 incidentId)`
- `getProvider(bytes32 providerId)` (read helper)

Events:

- `ProviderRegistered`
- `IncidentCommitted`
- `IncidentAcknowledged`
- `RemediationCommitted`
- `IncidentClosed`

Statuses: `None`, `Open`, `Acknowledged`, `RemediationSubmitted`, `Closed`.

There are no tokens, slashing, penalties, escrow or on-chain metrics. Raw observations and notes stay off-chain. The ABI is exported to `contracts/abi/ProviderIncidentRegistry.json`.

The app displays `not_anchored` unless `INCIDENT_REGISTRY_ADDRESS` and an operator workflow are configured. No BOT mainnet or Bohr contract address is fabricated.

## 9. Security

- Monitor targets pass SSRF validation: HTTP/HTTPS only, no URL credentials, public DNS only, private/reserved IP blocking, port allowlist, optional host allowlist, no redirect following, response size limit.
- Monitor credentials are encrypted at rest with AES-256-GCM using a key derived from `CREDENTIAL_ENCRYPTION_KEY`.
- API admin mutations require `Authorization: Bearer <ADMIN_API_TOKEN>` when the token is set. Local mode intentionally permits them for evaluation.
- Webhook payloads are HMAC signed; signature verification is provided in `lib/crypto.ts`.
- Secrets are redacted from monitor error messages.
- Audit rows record operator and worker actions.
- Retention removes old observations, checks and deliveries.
- Response body limits and request timeouts bound source and monitor calls.
- The API does not expose encrypted credentials or raw integration secrets in list responses.

Security limitations are explicit: there is no user login, session, RBAC hierarchy or tenant isolation in the reference build. See `INTEGRATION_LIMITATIONS.md`.

## 10. Observability

- `/metrics` exposes Prometheus metrics with the `computepulse_` prefix.
- Metrics cover provider totals and health by network, source latency, last successful collection timestamp, collection attempts, observations written, monitor success/latency and API request duration.
- OpenTelemetry tracing is optional through `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT`.
- The app also exposes an in-product collection status page and an operational report.

## 11. Deployment reference

See `docs/DEPLOYMENT.md` for environment variables, PostgreSQL/Timescale setup, process commands, reverse proxy notes and the contract deployment workflow.
