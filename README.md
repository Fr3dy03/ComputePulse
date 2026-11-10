# ComputePulse

Cross-network provider observability for decentralised compute.

ComputePulse collects source evidence from public provider and chain APIs, persists it with provenance, and presents it through a dark operations console. Every metric shows its source, observation time, measurement window, collection method, evidence class and freshness. Missing data is displayed as missing.

> **See the infrastructure behind decentralised compute.**  
> Monitor provider health, compare network signals and investigate infrastructure incidents through one transparent operations view.

## What is included

- **Marketing site** at `/` with provider observability, cross-network monitoring, integrations, methodology, documentation and FAQ routes.
- **Operations app** at `/app` with overview, networks, providers, monitors, incidents, capacity, benchmarks, alerts, integrations, reports and settings.
- **Fastify API** with OpenAPI output, health and Prometheus metrics.
- **Live adapters** for the Akash Console provider API, the Flux public daemon API, BOT Chain mainnet and Bohr testnet.
- **PostgreSQL-compatible storage** through PGlite locally or PostgreSQL via `DATABASE_URL`.
- **Endpoint monitors** with SSRF protection, availability history and incident correlation.
- **Incident lifecycle** with an event timeline, signed webhooks, source commitments and an honest `not_anchored` state.
- **Solidity registry**: `ProviderIncidentRegistry.sol`, Foundry tests, deployment script and ABI.
- **Reference documentation** in `docs/`.

## Verified live sources

These are real, credential-free sources used by the collector. The counts below are a snapshot from a reference collection on 10 November 2026; use the live API for current values.

| Network | Source | Observed in reference run |
| --- | --- | --- |
| Akash Network | `https://console-api.akash.network/v1/providers` | 1,874 providers, 9,562 observations |
| Flux Network | `https://api.runonflux.io/daemon/listfluxnodes` | 6,892 nodes, 20,680 observations in the latest run |
| BOT Chain mainnet | `https://rpc.botchain.ai` | Chain ID 677, head height and block age |
| Bohr testnet | `https://rpc.bohr.life` | Chain ID 968, testnet chain checks |

The reference database contained **8,767 providers**, **180,123 observations** and **one real correlated incident** for an Akash provider reported offline by the source. The app does not synthesize provider, capacity or availability values.

The Flux public list has no liveness flag and no capacity data. Flux providers are therefore `unknown` with `healthSignal = unavailable`; confirmation lag is marked `estimated`, not endpoint health. Vast.ai was rejected because its supplier API requires documented Bearer authentication.

## Quickstart

Requirements: Node.js 20.12+ and npm 10+. Docker, Redis, PostgreSQL and Foundry are not required for local evaluation.

```bash
npm install
cp .env.example apps/api/.env
npm run db:seed
npm run collect
npm run dev
```

On Windows PowerShell, replace the copy with:

```powershell
Copy-Item .env.example apps/api/.env
```

Open:

- Marketing site: `http://localhost:3000`
- Operations app: `http://localhost:3000/app`
- API: `http://localhost:8787`
- API reference: `http://localhost:8787/api/docs`
- Health: `http://localhost:8787/health`
- Prometheus metrics: `http://localhost:8787/metrics`

The first collection fetches large Flux/Akash lists and can take a few seconds. If the API is offline, the web app shows an error state rather than a fabricated snapshot.

### Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run API and web together |
| `npm run dev:api` | Run the Fastify API only |
| `npm run dev:web` | Run the Next.js app only |
| `npm run seed` / `npm run db:seed` | Apply/seed static source metadata |
| `npm run collect` | Run all source collections once |
| `npm run collect -w @computepulse/api -- akash-mainnet` | Collect one network |
| `npm run build` | Build API and web |
| `npm test` | API unit and integration tests |
| `npm run test:contracts` | Foundry contract tests |
| `npm run typecheck` | TypeScript checks |

## Architecture

```text
Next.js 15 web  :3000
        |
        | server-side API reads at request time
        v
Fastify API     :8787
  |-- PGlite (local) / PostgreSQL
  |-- Akash, Flux, BOT/Bohr adapters
  |-- in-process scheduler
  |-- endpoint monitor worker
  |-- Prometheus /metrics and optional OTLP traces
  |-- optional signed webhook delivery
  `-- optional ProviderIncidentRegistry commitment layer
```

The reference runtime uses an in-process scheduler. Redis/BullMQ is documented as a production scaling option but is not implemented in this build. See `docs/INTEGRATION_LIMITATIONS.md` before deploying multiple collector replicas.

## Data model and evidence

The core tables are `providers`, `observations`, `capacity_snapshots`, `monitors`, `monitor_checks`, `incidents`, `incident_events`, `alert_rules`, `alert_deliveries` and `integrations`.

Required evidence states are visible in the UI:

- `OBSERVED` — measured directly by this deployment.
- `REPORTED` — supplied by the upstream source.
- `ESTIMATED` — derived by a documented formula.
- `UNAVAILABLE` — the source does not expose the signal.
- `STALE` — a prior value exceeds its freshness policy.
- `PENDING` — a monitor has not completed its first check.

`STALE` is a freshness state layered over the original evidence class. Missing observations are returned as `null` or omitted, never replaced with zero.

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/RESEARCH.md`](docs/RESEARCH.md) | Source verification, access checks, rejected candidates, licensing notes |
| [`docs/PROVIDER_ADAPTERS.md`](docs/PROVIDER_ADAPTERS.md) | Adapter contracts, field mapping, health semantics, failure handling |
| [`docs/METRIC_METHODOLOGY.md`](docs/METRIC_METHODOLOGY.md) | Metric formulas, evidence classes, windows, comparability |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Services, schema, collection flow, security, deployment topology |
| [`docs/DATA_FRESHNESS.md`](docs/DATA_FRESHNESS.md) | Freshness rules, stale detection, gaps, retention |
| [`docs/INTEGRATION_LIMITATIONS.md`](docs/INTEGRATION_LIMITATIONS.md) | Honest capability boundaries and unimplemented integrations |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | PostgreSQL, process commands, reverse proxy, contract deployment |

The marketing documentation page links to a static copy under `apps/web/public/docs`. Update that copy when the source documents change.

## Contract

`contracts/src/ProviderIncidentRegistry.sol` implements exactly the requested registry surface:

- Roles: `DEFAULT_ADMIN_ROLE`, `PROVIDER_OPERATOR_ROLE`, `INCIDENT_ATTESTOR_ROLE`
- Structs: `ProviderReference`, `Incident`
- Functions: `registerProvider`, `submitIncidentCommitment`, `acknowledgeIncident`, `submitRemediationCommitment`, `closeIncident`, `getIncident`, `getIncidentStatus`
- Events: `ProviderRegistered`, `IncidentCommitted`, `IncidentAcknowledged`, `RemediationCommitted`, `IncidentClosed`

There are no tokens, slashing, penalties, escrow or on-chain metrics. The registry is an optional commitment layer, not a source of truth for ComputePulse observations.

```bash
forge test
forge build
```

A local Anvil deployment was exercised end to end during verification, but no permanent BOT/Bohr deployment is configured. The UI therefore shows `not_anchored`; no address or transaction hash is fabricated.

## Security notes

- Monitor targets pass SSRF validation: HTTP/HTTPS only, no URL credentials, public DNS only, private/reserved IP blocking, port allowlist, optional host allowlist, no redirects and response-size limits.
- Monitor credentials are encrypted at rest with AES-256-GCM.
- Mutating routes require `Authorization: Bearer <ADMIN_API_TOKEN>` when the token is configured.
- Webhook payloads are HMAC-SHA256 signed when a secret is configured.
- Audit, retention and redaction paths exist for operator and worker actions.
- The reference build has no user login or tenant isolation. Do not expose it publicly without adding authentication, TLS and network restrictions.

Email is **not delivered** by this build. `SMTP_URL` changes readiness state only, and delivery rows are marked `skipped`. See the limitations document.

## BOT Chain

The marketing site and operations app include the authentic BOT Chain mark and footer linking to:

- [botchain.ai](https://www.botchain.ai/en/)
- [BOT Chain explorer](https://scan.botchain.ai/)

Built on BOT Chain.

## License and source attribution

Source names and marks remain the property of their respective networks. ComputePulse consumes public APIs and does not redistribute bulk raw dumps. See `docs/RESEARCH.md` for source-specific notes.
