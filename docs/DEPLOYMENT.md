# Deployment reference

This document covers the reference deployment, PostgreSQL/TimescaleDB setup, process commands, reverse-proxy notes and the optional Solidity registry workflow.

## 1. Prerequisites

| Component | Requirement | Notes |
| --- | --- | --- |
| Node.js | 20.12 or newer | Reference environment uses Node 24 |
| npm | 10 or newer | Workspaces are required |
| Database | PGlite locally, PostgreSQL 15+ in production | TimescaleDB is optional |
| Foundry | Optional | Only for contract tests and deployment |
| Network egress | HTTPS to source APIs and monitored endpoints | No inbound provider connections |

No Docker, Redis, PostgreSQL or Foundry installation is required for local evaluation. PGlite is embedded and persists under `apps/api/.data/pglite` by default.

## 2. Local evaluation

From the repository root:

```bash
npm install
cp .env.example apps/api/.env
npm run db:seed
npm run collect
npm run dev:api
npm run dev:web
```

The last two commands run in separate terminals, or use `npm run dev` to start both.

- Web: `http://localhost:3000`
- API: `http://localhost:8787`
- API docs: `http://localhost:8787/api/docs`
- Health: `http://localhost:8787/health`
- Metrics: `http://localhost:8787/metrics`

On Windows PowerShell, use `Copy-Item .env.example apps/api/.env` instead of `cp`.

The first API start is idempotent: it applies the schema, seeds static source metadata, and can run a first collection when `AUTO_BOOTSTRAP=true` and the provider table is empty. `npm run collect` is explicit and is the recommended step for an evaluation because it produces a visible collection run.

If the API is on another host, create `apps/web/.env.local`:

```dotenv
API_URL=http://api.internal:8787
NEXT_PUBLIC_API_URL=https://api.example.com
CONTACT_EMAIL=ops@example.com
```

`API_URL` is used by server components. `NEXT_PUBLIC_API_URL` is used for browser links and downloads and must be reachable from the browser.

## 3. Production build

```bash
npm ci
npm run build
npm run start
```

Build output:

- API: `apps/api/dist` (plus `dist/db/schema.sql`, copied by the build)
- Web: `apps/web/.next`

`npm run start` runs both workspace start scripts under `concurrently`. In a process manager, run them independently:

```bash
npm run start -w @computepulse/api
npm run start -w @computepulse/web
```

Set `NODE_ENV=production`, a strong `ADMIN_API_TOKEN`, a strong `CREDENTIAL_ENCRYPTION_KEY`, and a production `APP_ORIGIN`. The API refuses nothing at boot for a weak key, but the settings endpoint exposes the encryption mode; replace the development key before storing real monitor credentials.

## 4. PostgreSQL

Create a database and role, then set `DATABASE_URL` for the API process:

```dotenv
DATABASE_URL=postgresql://computepulse:change-me@db.internal:5432/computepulse
```

The schema is applied at API startup from `apps/api/src/db/schema.sql` (or `dist/db/schema.sql` after build). It is plain PostgreSQL. Apply it once through the API or manually with `psql -f apps/api/src/db/schema.sql $DATABASE_URL`, then keep the API startup as the idempotent migration gate.

Recommended production settings:

- connection pool is 10 by default in `apps/api/src/db/client.ts`;
- terminate TLS at the proxy or use `sslmode=require` in the URL;
- keep the database private;
- take backups and test restore;
- run a single collector/monitor worker unless you add distributed locking.

### TimescaleDB

TimescaleDB is optional. For time-series scale, after the schema exists:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT create_hypertable(
  'observations',
  by_range('observed_at'),
  if_not_exists => TRUE
);
```

Add a retention policy that matches the application setting, and consider continuous aggregates for 1h/24h rollups. The API queries remain valid because they use ordinary time predicates and indexes. The local PGlite reference does not ship TimescaleDB; do not claim it is active there.

## 5. Environment and secrets

The API loads `apps/api/.env` and, when started through the workspace from `apps/api`, the repository-root `.env`. Real process environment variables take precedence. The web app reads `apps/web/.env.local`.

Minimum production set:

```dotenv
NODE_ENV=production
PORT=8787
HOST=127.0.0.1
APP_ORIGIN=https://computepulse.example.com
DATABASE_URL=postgresql://...
ADMIN_API_TOKEN=<long-random-token>
CREDENTIAL_ENCRYPTION_KEY=<long-random-secret>
COLLECTOR_ENABLED=true
MONITOR_SCHEDULER_ENABLED=true
```

Do not commit `.env`, an operator private key or a webhook secret. Use the process manager's secret store where possible.

## 6. Reverse proxy

Terminate TLS and route by path:

```text
https://computepulse.example.com/          -> Next.js :3000
https://computepulse.example.com/api/*     -> Fastify :8787
https://computepulse.example.com/health    -> Fastify :8787
https://computepulse.example.com/metrics   -> Fastify :8787 (restrict)
```

If the web app is served under a subpath or a different API origin, set both `API_URL` and `NEXT_PUBLIC_API_URL`. The browser calls the API directly, so CORS must allow the public web origin through `APP_ORIGIN`; the API also permits localhost development origins.

Protect `/metrics` and `/api/docs` with network policy or proxy authentication. `/metrics` has no built-in authentication. Restrict mutating routes with `ADMIN_API_TOKEN`.

## 7. Scheduling and scaling

The reference scheduler is in-process. Use one of:

1. one API replica with `COLLECTOR_ENABLED=true` and `MONITOR_SCHEDULER_ENABLED=true`; or
2. separate API replicas with collection disabled, plus one dedicated worker process running the same API image with `COLLECTOR_ENABLED=true` and `MONITOR_SCHEDULER_ENABLED=true`.

The second option still uses an in-process scheduler in that worker. For multiple workers, add a distributed lock or a Redis/BullMQ queue. Redis is reserved in configuration but not implemented in this build.

## 8. Contract deployment

The Foundry project root is the repository root:

```bash
forge test
forge build
```

To deploy `ProviderIncidentRegistry`:

```bash
export PRIVATE_KEY=<deployer-private-key>
export BOT_MAINNET_RPC_URL=https://rpc.botchain.ai
export PROVIDER_OPERATOR_ADDRESS=<optional-operator-address>
export INCIDENT_ATTESTOR_ADDRESS=<optional-attestor-address>

forge script contracts/script/Deploy.s.sol:DeployProviderIncidentRegistry \
  --rpc-url "$BOT_MAINNET_RPC_URL" \
  --broadcast
```

For Bohr, use `BOHR_RPC_URL=https://rpc.bohr.life`. The deployer receives `DEFAULT_ADMIN_ROLE`. Use a multisig in production and grant operational roles deliberately.

After deployment:

1. record the address from the broadcast output;
2. verify the source on the explorer if supported;
3. set `INCIDENT_REGISTRY_ADDRESS`;
4. build and review the anchoring workflow before setting `BOT_OPERATOR_PRIVATE_KEY` in production.

The reference build has no anchoring worker. An empty address is displayed as `not_anchored`. Do not publish an address that was not actually deployed and verified. The local Anvil address used during testing (`0x5FbDB2315678afecb367f032d93F642f64180aa3`) is ephemeral and must not be presented as a production deployment.

## 9. Backup, retention and monitoring

- Back up PostgreSQL with the provider's native tooling; PGlite is a local evaluation store, not a production backup target.
- Application retention defaults: 30 days of observations, 14 days of monitor checks, 90 days of alert deliveries. Change through settings or environment policy.
- TimescaleDB users should use native retention/compression policies instead of the application delete loop.
- Scrape `/metrics` and alert on `computepulse_collection_success_timestamp_seconds`, source latency, failed collection runs and monitor failures.
- Use `/api/v1/collection/status` and `/api/v1/overview` for a human-readable source state.
- Add external uptime checks for the web and API processes. The API `/health` checks database connectivity.

## 10. Deployment checklist

- [ ] Production database configured and schema applied.
- [ ] `ADMIN_API_TOKEN` and `CREDENTIAL_ENCRYPTION_KEY` replaced.
- [ ] TLS terminated and `/metrics` restricted.
- [ ] `APP_ORIGIN`, `API_URL` and `NEXT_PUBLIC_API_URL` match the public origins.
- [ ] Only one scheduler/collector owner, or a distributed lock added.
- [ ] Source collection verified with a real run.
- [ ] At least one endpoint monitor created and checked.
- [ ] Incident alert channels reviewed; email is not delivered by this build.
- [ ] Contract address either verified and configured, or left empty with `not_anchored` visible.
- [ ] Backups, retention and log rotation configured.
- [ ] Privacy, terms and contact details reviewed for the operating entity.

See `ARCHITECTURE.md` for the data model and `INTEGRATION_LIMITATIONS.md` for the honest capability boundary.
