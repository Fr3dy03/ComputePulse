# Deploy the web app on Vercel

The repository is configured so Vercel can build the Next.js application from the monorepo root. Import the GitHub repository and deploy; `vercel.json` selects the web workspace and its output.

> **Important:** Vercel hosts the Next.js site. ComputePulse's collector is a long-running Fastify process with PostgreSQL and an in-process scheduler, which is not a good fit for Vercel Functions. The marketing site deploys without it, but live provider data, monitors, incidents, reports and settings require the API to be hosted separately (for example on a Node host with PostgreSQL). See section 5.

## 1. Import and deploy

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import `https://github.com/Fr3dy03/ComputePulse`.
3. Leave the root directory at the repository root when Vercel reads `vercel.json`.
4. Add the environment variables in section 3 if you already have an API.
5. Deploy.

The checked-in `vercel.json` uses:

```json
{
  "framework": "nextjs",
  "installCommand": "npm ci",
  "buildCommand": "npm run build -w @computepulse/web",
  "outputDirectory": "apps/web/.next"
}
```

This installs the npm workspace from the repository root and builds only `@computepulse/web`.

If your Vercel account requires an explicit project root instead, set **Root Directory** to `apps/web`. The Next.js build then uses `apps/web/.next` as its normal output directory. Do not set the root to `apps/api`; that creates a web project for the wrong application.

## 2. What works without an API

The marketing routes are deployed and remain usable:

- `/`
- `/platform`
- `/provider-observability`
- `/cross-network-monitoring`
- `/compute-providers`
- `/network-operators`
- `/integrations`
- `/metric-methodology`
- `/documentation`
- `/faq`
- `/contact`
- `/privacy`
- `/terms`

The homepage renders an explicit "API unreachable" state in its source summary. It never substitutes cached or fabricated provider values. The operations routes remain reachable but show error/unavailable states until an API is configured.

## 3. Environment variables

Set these in **Vercel Project Settings -> Environment Variables**:

| Variable | Required for web | Purpose |
| --- | --- | --- |
| `API_URL` | For live data | Server-side API origin, for example `https://computepulse-api.onrender.com` |
| `NEXT_PUBLIC_API_URL` | For live data | Browser-visible API origin; must be reachable from users' browsers |
| `CONTACT_EMAIL` | Optional | Public contact address; without it the contact page says it is not configured |

Use the same value for `API_URL` and `NEXT_PUBLIC_API_URL` unless you deliberately proxy browser requests differently.

`NEXT_PUBLIC_API_URL` is embedded at build time. After changing it, redeploy. `API_URL` is read at request time on the server.

`apps/web/.env.example` contains the same template for local use.

## 4. Verify the deployment

After the first deployment, open:

```text
https://<project>.vercel.app/
https://<project>.vercel.app/documentation
https://<project>.vercel.app/docs/RESEARCH.md
https://<project>.vercel.app/app
```

Expected result without an API:

- marketing pages return 200 and display the BOT Chain footer;
- `/app` displays the API unavailable notice rather than a crash or fake data.

Expected result with a configured API:

- `/app` shows network and provider counts;
- provider, monitor and incident detail pages resolve;
- freshness badges and evidence provenance are visible.

## 5. Hosting the API separately

The API needs a long-running Node process, a PostgreSQL-compatible database and enough time to collect the Akash and Flux lists. A small container or Node service is sufficient for evaluation.

Build and start commands:

```bash
npm ci
npm run build -w @computepulse/api
npm run start -w @computepulse/api
```

Required API environment:

```dotenv
NODE_ENV=production
PORT=8787
HOST=0.0.0.0
APP_ORIGIN=https://<project>.vercel.app
DATABASE_URL=postgresql://...
ADMIN_API_TOKEN=<long-random-token>
CREDENTIAL_ENCRYPTION_KEY=<long-random-secret>
COLLECTOR_ENABLED=true
MONITOR_SCHEDULER_ENABLED=true
AUTO_BOOTSTRAP=false
```

Then initialise and collect once:

```bash
npm run db:seed
npm run collect
```

The API applies the schema at startup. Use a persistent PostgreSQL database; do not use PGlite on an ephemeral host. `APP_ORIGIN` must exactly match the Vercel production origin so CORS allows browser mutations. Add preview origins only if you intentionally test preview deployments.

Set `API_URL` and `NEXT_PUBLIC_API_URL` in Vercel to the public API origin, then redeploy the web project. `https://` is required for a Vercel-hosted page calling the API.

### Deployment shape

```text
Vercel (Next.js)
  https://computepulse.vercel.app
        |
        | HTTPS + CORS
        v
API host (Fastify + PostgreSQL)
  https://computepulse-api.example.com
        |
        +-- Akash / Flux / BOT / Bohr source APIs
```

## 6. Vercel limitations

- Vercel Functions are not used for the collector. The scheduler is in-process and the sources require longer, stateful collection than a serverless request should own.
- PGlite is intentionally local only. A Vercel deployment must not rely on an ephemeral filesystem database.
- Email delivery is not implemented in the reference build; `SMTP_URL` only changes readiness and rows are marked `skipped`.
- No BOT/Bohr registry address is configured, so incidents show `not_anchored`.
- `/metrics` and `/api/docs` live on the API host, not on the Vercel deployment.
- The reference build has no user authentication. Put the operations app behind Vercel Authentication, an identity proxy, or add authentication before exposing mutations publicly.

## 7. Optional custom domain

1. Add the domain in Vercel Project Settings -> Domains.
2. Update the API's `APP_ORIGIN` to the custom domain.
3. Add the custom domain to any API CORS/proxy configuration.
4. Redeploy the web project if `NEXT_PUBLIC_API_URL` changed.

## 8. Troubleshooting

**Vercel builds the wrong app.** Confirm the project is using the repository root and reading `vercel.json`, or set Root Directory to `apps/web`.

**Build cannot find `next`.** Ensure the install command runs at the repository root (`npm ci`) so npm workspaces install `apps/web` dependencies.

**The site loads but `/app` says the API is unreachable.** Check `API_URL`, then check it from the public internet. Server components cannot reach a service bound only to localhost.

**Browser mutations fail but server pages load.** Check `NEXT_PUBLIC_API_URL` and the API `APP_ORIGIN` CORS allowlist. Redeploy after changing a `NEXT_PUBLIC_*` value.

**No provider data appears.** The API is reachable but has not collected yet. Run `npm run collect` on the API host and inspect `/api/v1/collection/status`.
