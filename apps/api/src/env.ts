import fs from 'node:fs';
import path from 'node:path';

// Node 20.12+: load .env files without adding a runtime dependency. Workspace
// scripts run with the API package as the working directory, so load the
// repository root file first and the package-local file second. Existing
// process environment variables keep precedence.
for (const candidate of [
  path.resolve(process.cwd(), '..', '..', '.env'),
  path.resolve(process.cwd(), '.env'),
]) {
  try {
    if (fs.existsSync(candidate)) process.loadEnvFile?.(candidate);
  } catch {
    // A malformed or unreadable .env file is not fatal here; required values
    // are validated by the process that consumes them.
  }
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const DEV_ENCRYPTION_KEY =
  'computepulse-local-dev-key-change-me-32-bytes-minimum!!';

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: integer(process.env.PORT, 8787),
  HOST: process.env.HOST ?? '0.0.0.0',
  APP_ORIGIN: process.env.APP_ORIGIN ?? 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  PGLITE_DIR:
    process.env.PGLITE_DIR ?? path.resolve(process.cwd(), '.data', 'pglite'),
  DEMO_ORG_ID: process.env.DEMO_ORG_ID ?? 'org_computepulse',
  ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN ?? '',
  CREDENTIAL_ENCRYPTION_KEY:
    process.env.CREDENTIAL_ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY,
  COLLECTOR_ENABLED: process.env.COLLECTOR_ENABLED !== 'false',
  MONITOR_SCHEDULER_ENABLED:
    process.env.MONITOR_SCHEDULER_ENABLED !== 'false',
  AUTO_BOOTSTRAP: process.env.AUTO_BOOTSTRAP !== 'false',
  MONITOR_TICK_MS: integer(process.env.MONITOR_TICK_MS, 30_000),
  AKASH_INTERVAL_MS: integer(process.env.AKASH_INTERVAL_MS, 300_000),
  FLUX_INTERVAL_MS: integer(process.env.FLUX_INTERVAL_MS, 600_000),
  BOT_INTERVAL_MS: integer(process.env.BOT_INTERVAL_MS, 60_000),
  ADAPTER_TIMEOUT_MS: integer(process.env.ADAPTER_TIMEOUT_MS, 90_000),
  DEFAULT_STALE_AFTER_SECONDS: integer(
    process.env.DEFAULT_STALE_AFTER_SECONDS,
    1_800,
  ),
  INCIDENT_REGISTRY_ADDRESS:
    process.env.INCIDENT_REGISTRY_ADDRESS ?? '',
  BOT_OPERATOR_PRIVATE_KEY: process.env.BOT_OPERATOR_PRIVATE_KEY ?? '',
  OTEL_ENABLED: process.env.OTEL_ENABLED === 'true',
  OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME ?? 'computepulse-api',
  OTEL_EXPORTER_OTLP_ENDPOINT:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '',
  REDIS_URL: process.env.REDIS_URL ?? '',
  SMTP_URL: process.env.SMTP_URL ?? '',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ?? '',
  IS_LOCAL_DB: !process.env.DATABASE_URL,
} as const;

export function isDevCredentialKey(): boolean {
  return env.CREDENTIAL_ENCRYPTION_KEY === DEV_ENCRYPTION_KEY;
}
