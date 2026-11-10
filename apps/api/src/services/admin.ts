import type { Database } from '../db/client.js';
import { getDb } from '../db/client.js';
import { env } from '../env.js';
import { encryptJson } from '../lib/crypto.js';
import { assertSafeHttpUrl } from '../lib/ssrf.js';

export async function getAlertRules(dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const result = await db.query<Record<string, unknown>>(
    `SELECT r.*, n.name AS network_name,
       (SELECT count(*)::text FROM alert_deliveries d WHERE d.rule_id=r.id) AS deliveries,
       (SELECT count(*)::text FROM alert_deliveries d WHERE d.rule_id=r.id AND d.status='failed') AS failed_deliveries
     FROM alert_rules r LEFT JOIN networks n ON n.id=r.network_id
     ORDER BY r.created_at ASC`,
  );
  return result.rows.map((row) => ({
    ...row,
    id: String(row.id),
    channel_ids: row.channel_ids ?? [],
    deliveries: Number(row.deliveries ?? 0),
    failed_deliveries: Number(row.failed_deliveries ?? 0),
  }));
}

export async function updateAlertRule(
  id: string,
  input: {
    enabled?: boolean;
    threshold?: string;
    cooldownSeconds?: number;
    severity?: string;
    windowSeconds?: number;
  },
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const result = await db.query(
    `UPDATE alert_rules SET
       enabled=COALESCE($2,enabled), threshold=COALESCE($3,threshold),
       cooldown_seconds=COALESCE($4,cooldown_seconds), severity=COALESCE($5,severity),
       window_seconds=COALESCE($6,window_seconds), updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      id,
      input.enabled ?? null,
      input.threshold ?? null,
      input.cooldownSeconds ?? null,
      input.severity ?? null,
      input.windowSeconds ?? null,
    ],
  );
  if (!result.rows[0]) return null;
  await db.query(
    `INSERT INTO audit_logs (organisation_id, actor, action, entity_type, entity_id, data, created_at)
     VALUES ($1,'operator@computepulse.local','alert_rule.updated','alert_rule',$2,$3::jsonb,$4)`,
    [env.DEMO_ORG_ID, id, JSON.stringify(input), new Date().toISOString()],
  );
  return (await getAlertRules(db)).find((rule) => rule.id === id) ?? null;
}

export async function getIntegrations(dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const result = await db.query<Record<string, unknown>>(
    `SELECT id, organisation_id, kind, name, status, config, last_sync_at, created_at
     FROM integrations ORDER BY kind`,
  );
  return result.rows.map((row) => {
    const config = { ...(row.config as Record<string, unknown>) };
    const configuredSecret =
      typeof config.secret === 'string' ||
      typeof config.secret_encrypted === 'string';
    delete config.secret;
    delete config.secret_encrypted;
    return {
      ...row,
      id: String(row.id),
      config,
      has_secret: configuredSecret,
    };
  });
}

export async function updateIntegration(
  id: string,
  input: {
    name?: string;
    webhookUrl?: string | null;
    secret?: string | null;
    enabled?: boolean;
  },
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const existing = await db.query<{
    id: string;
    kind: string;
    config: Record<string, unknown>;
    status: string;
  }>('SELECT id, kind, config, status FROM integrations WHERE id=$1', [id]);
  const integration = existing.rows[0];
  if (!integration) return null;
  if (integration.kind !== 'webhook') {
    return { error: 'unsupported_integration' as const };
  }
  const config: Record<string, unknown> = { ...integration.config };
  if (input.webhookUrl !== undefined) {
    if (input.webhookUrl) {
      await assertSafeHttpUrl(input.webhookUrl);
      config.webhook_url = input.webhookUrl;
    } else {
      delete config.webhook_url;
    }
  }
  if (input.secret !== undefined) {
    if (input.secret) {
      config.secret_encrypted = encryptJson({ secret: input.secret });
    } else {
      delete config.secret_encrypted;
      delete config.secret;
    }
  }
  const status = config.webhook_url ? 'configured' : 'unconfigured';
  await db.query(
    `UPDATE integrations SET name=COALESCE($2,name), status=$3, config=$4::jsonb, last_sync_at=now()
     WHERE id=$1`,
    [id, input.name ?? null, status, JSON.stringify(config)],
  );
  await db.query(
    `INSERT INTO audit_logs (organisation_id, actor, action, entity_type, entity_id, data, created_at)
     VALUES ($1,'operator@computepulse.local','integration.updated','integration',$2,$3::jsonb,$4)`,
    [
      env.DEMO_ORG_ID,
      id,
      JSON.stringify({ webhook_url: input.webhookUrl ?? null, secret_updated: input.secret !== undefined }),
      new Date().toISOString(),
    ],
  );
  return (await getIntegrations(db)).find((item) => item.id === id) ?? null;
}

export async function getSettings(dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const [settings, sources, org] = await Promise.all([
    db.query<{ key: string; value: unknown; updated_at: string }>(
      `SELECT key, value, updated_at FROM settings WHERE organisation_id=$1 ORDER BY key`,
      [env.DEMO_ORG_ID],
    ),
    db.query<Record<string, unknown>>(
      `SELECT s.*, n.name AS network_name FROM data_source_status s
       JOIN networks n ON n.id=s.network_id ORDER BY n.name`,
    ),
    db.query<Record<string, unknown>>(
      `SELECT id, name, slug, plan, created_at FROM organisations WHERE id=$1`,
      [env.DEMO_ORG_ID],
    ),
  ]);
  return {
    organisation: org.rows[0] ?? null,
    settings: settings.rows,
    sourceFreshnessPolicy: sources.rows,
    environment: {
      database: env.DATABASE_URL ? 'postgresql' : 'pglite',
      collectorEnabled: env.COLLECTOR_ENABLED,
      monitorSchedulerEnabled: env.MONITOR_SCHEDULER_ENABLED,
      otelEnabled: env.OTEL_ENABLED,
      webhookSecretConfigured: Boolean(env.WEBHOOK_SECRET),
      smtpConfigured: Boolean(env.SMTP_URL),
      registryAddressConfigured: Boolean(env.INCIDENT_REGISTRY_ADDRESS),
      credentialEncryption: 'AES-256-GCM at rest',
      ssrfProtection: 'DNS validation, public-address revalidation, port allowlist, no redirects',
    },
    retention: {
      observationsDays: 30,
      monitorChecksDays: 14,
      note:
        'Retention is enforced by the maintenance task. Database backups are operator-managed.',
    },
  };
}

const EDITABLE_SETTING_PREFIXES = [
  'retention.',
  'freshness.',
  'notifications.',
  'collector.',
  'workspace.',
];

export async function updateSettings(
  entries: Array<{ key: string; value: unknown }>,
  dbOverride?: Database,
) {
  const db = dbOverride ?? (await getDb());
  const rejected: string[] = [];
  const accepted: Array<{ key: string; value: unknown }> = [];
  for (const entry of entries) {
    if (
      !EDITABLE_SETTING_PREFIXES.some((prefix) => entry.key.startsWith(prefix))
    ) {
      rejected.push(entry.key);
      continue;
    }
    if (typeof entry.key !== 'string' || entry.key.length > 120) {
      rejected.push(String(entry.key));
      continue;
    }
    accepted.push(entry);
  }
  for (const entry of accepted) {
    await db.query(
      `INSERT INTO settings (organisation_id, key, value, updated_at)
       VALUES ($1,$2,$3::jsonb,now())
       ON CONFLICT (organisation_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
      [env.DEMO_ORG_ID, entry.key, JSON.stringify(entry.value)],
    );
  }
  await db.query(
    `INSERT INTO audit_logs (organisation_id, actor, action, entity_type, entity_id, data, created_at)
     VALUES ($1,'operator@computepulse.local','settings.updated','settings',NULL,$2::jsonb,$3)`,
    [
      env.DEMO_ORG_ID,
      JSON.stringify({ keys: accepted.map((entry) => entry.key), rejected }),
      new Date().toISOString(),
    ],
  );
  return { settings: await getSettings(db), rejected };
}
