import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { getDb } from '../db/client.js';
import { getAdapterMetadata } from '../adapters/registry.js';
import { collectAll, getCollectorStatus } from '../services/collector.js';
import {
  getNetworkDetail,
  getNetworkSummaries,
} from '../services/networks.js';
import {
  getNetworkHistory,
  getProviderDetail,
  getProviderHistory,
  listProviders,
} from '../services/providers.js';
import { getCapacityOverview, getBenchmarks, getReports } from '../services/analytics.js';
import {
  createMonitor,
  getMonitorDetail,
  listMonitors,
  runMonitor,
  runDueMonitors,
  updateMonitor,
} from '../services/monitors.js';
import {
  actOnIncident,
  createIncident,
  getIncident,
  incidentSourceCommitment,
  listIncidents,
} from '../services/incidents.js';
import {
  getAlertRules,
  getIntegrations,
  getSettings,
  updateAlertRule,
  updateIntegration,
  updateSettings,
} from '../services/admin.js';
import { getOverview } from '../services/overview.js';
import { openApiDocument } from './openapi.js';

function badRequest(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({
    error: 'validation_failed',
    message: 'The request payload is invalid.',
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!env.ADMIN_API_TOKEN) return;
  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== env.ADMIN_API_TOKEN) {
    return reply.status(401).send({
      error: 'unauthorized',
      message: 'A valid admin bearer token is required for this operation.',
    });
  }
}

const windowQuery = z.object({
  metricKey: z.string().min(1).max(120).optional(),
  window: z.enum(['1h', '24h', '7d', '30d', 'custom']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  bucketSeconds: z.coerce.number().int().min(30).max(86_400).optional(),
});

export async function registerRoutes(app: FastifyInstance) {
  app.get('/api/v1/meta', async () => ({
    name: 'ComputePulse API',
    version: '1.0.0',
    docs: '/api/v1/openapi.json',
    generatedAt: new Date().toISOString(),
    evidenceStates: {
      OBSERVED: 'Measured directly by the ComputePulse collector or monitor worker.',
      REPORTED: 'Supplied by the upstream source and not independently verified.',
      ESTIMATED: 'Derived by ComputePulse from source fields using a documented method.',
      UNAVAILABLE: 'The source does not expose this signal. No value is inferred.',
      STALE: 'A previous observation exists but exceeds its freshness policy.',
    },
    principles: [
      'Every metric carries source, observation time, collection method, evidence state and freshness.',
      'No universal network health percentage is calculated across incompatible sources.',
      'Provider host references are not probed by default.',
      'Missing observations are displayed as gaps, never filled with zero.',
    ],
    adapters: getAdapterMetadata(),
  }));

  app.get('/api/v1/overview', async () => getOverview());

  app.get('/api/v1/networks', async () => ({
    data: await getNetworkSummaries(),
  }));

  app.get<{ Params: { id: string } }>('/api/v1/networks/:id', async (request, reply) => {
    const detail = await getNetworkDetail(request.params.id);
    if (!detail) return reply.status(404).send({ error: 'not_found' });
    return detail;
  });

  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/api/v1/networks/:id/history',
    async (request, reply) => {
      const parsed = windowQuery.safeParse(request.query);
      if (!parsed.success) return badRequest(reply, parsed.error);
      try {
        const history = await getNetworkHistory(request.params.id, parsed.data);
        return history;
      } catch (error) {
        return reply.status(400).send({
          error: 'invalid_window',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.get<{ Querystring: Record<string, string> }>('/api/v1/providers', async (request) => {
    return listProviders({
      networkId: request.query.networkId,
      health: request.query.health,
      evidence: request.query.evidence,
      search: request.query.search,
      country: request.query.country,
      region: request.query.region,
      hasIncident: request.query.hasIncident === 'true',
      page: request.query.page ? Number(request.query.page) : 1,
      pageSize: request.query.pageSize ? Number(request.query.pageSize) : 25,
      sort: request.query.sort,
      availabilityWindow: request.query.availabilityWindow,
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/providers/:id', async (request, reply) => {
    const provider = await getProviderDetail(request.params.id);
    if (!provider) return reply.status(404).send({ error: 'not_found' });
    return provider;
  });

  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/api/v1/providers/:id/history',
    async (request, reply) => {
      const parsed = windowQuery.safeParse(request.query);
      if (!parsed.success) return badRequest(reply, parsed.error);
      try {
        const history = await getProviderHistory(request.params.id, parsed.data);
        if (!history) return reply.status(404).send({ error: 'not_found' });
        return history;
      } catch (error) {
        return reply.status(400).send({
          error: 'invalid_window',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.get('/api/v1/capacity', async () => getCapacityOverview());
  app.get<{ Querystring: { days?: string } }>('/api/v1/benchmarks', async () => getBenchmarks());

  app.get('/api/v1/reports', async (request) => {
    const query = request.query as { days?: string };
    const days = query.days ? Number(query.days) : 7;
    return getReports({ days: Number.isFinite(days) ? days : 7 });
  });

  app.get('/api/v1/monitors', async () => ({ data: await listMonitors() }));

  const monitorSchema = z.object({
    name: z.string().min(2).max(120),
    networkId: z.string().max(80).nullable().optional(),
    providerId: z.string().max(120).nullable().optional(),
    kind: z.enum(['http', 'jsonrpc']).optional(),
    targetUrl: z.string().url().max(2048),
    method: z.enum(['GET', 'POST', 'HEAD']).optional(),
    requestBody: z.string().max(10_000).nullable().optional(),
    expectedStatus: z.number().int().min(100).max(599).optional(),
    expectedBodyContains: z.string().max(500).nullable().optional(),
    headers: z.record(z.string().max(200), z.string().max(4000)).nullable().optional(),
    intervalSeconds: z.number().int().min(30).max(86_400).optional(),
    timeoutMs: z.number().int().min(1_000).max(60_000).optional(),
    retries: z.number().int().min(0).max(5).optional(),
    enabled: z.boolean().optional(),
  });

  app.post('/api/v1/monitors', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = monitorSchema.safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);
    try {
      const monitor = await createMonitor(parsed.data);
      return reply.status(201).send(monitor);
    } catch (error) {
      return reply.status(400).send({
        error: 'monitor_rejected',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get<{ Params: { id: string } }>('/api/v1/monitors/:id', async (request, reply) => {
    const monitor = await getMonitorDetail(request.params.id);
    if (!monitor) return reply.status(404).send({ error: 'not_found' });
    return monitor;
  });

  app.patch<{ Params: { id: string } }>(
    '/api/v1/monitors/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const schema = monitorSchema.partial();
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return badRequest(reply, parsed.error);
      try {
        const monitor = await updateMonitor(request.params.id, parsed.data);
        if (!monitor) return reply.status(404).send({ error: 'not_found' });
        return monitor;
      } catch (error) {
        return reply.status(400).send({
          error: 'monitor_rejected',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/monitors/:id/check',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        return await runMonitor(request.params.id, 'operator');
      } catch (error) {
        return reply.status(400).send({
          error: 'check_failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.get<{ Querystring: Record<string, string> }>('/api/v1/incidents', async (request) => {
    return {
      data: await listIncidents({
        status: request.query.status,
        severity: request.query.severity,
        networkId: request.query.networkId,
        providerId: request.query.providerId,
        search: request.query.search,
        limit: request.query.limit ? Number(request.query.limit) : undefined,
      }),
    };
  });

  app.post('/api/v1/incidents', { preHandler: requireAdmin }, async (request, reply) => {
    const schema = z.object({
      title: z.string().min(4).max(200),
      summary: z.string().min(10).max(4000),
      severity: z.enum(['critical', 'major', 'minor', 'warning', 'info']),
      networkId: z.string().max(80).nullable().optional(),
      providerId: z.string().max(120).nullable().optional(),
      startedAt: z.string().datetime().optional(),
      actor: z.string().max(120).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const incident = await createIncident({
      ...parsed.data,
      source: 'manual_operator',
      sourceRef: `operator:${Date.now()}`,
      sourceObservedAt: new Date().toISOString(),
      metadata: {
        note: 'Created manually by an operator. This is explicitly marked as operator-authored, not source-correlated.',
      },
    });
    return reply.status(201).send(incident);
  });

  app.get<{ Params: { id: string } }>('/api/v1/incidents/:id', async (request, reply) => {
    const incident = await getIncident(request.params.id);
    if (!incident) return reply.status(404).send({ error: 'not_found' });
    return { ...incident, sourceCommitment: incidentSourceCommitment(incident) };
  });

  app.post<{ Params: { id: string } }>(
    '/api/v1/incidents/:id/actions',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const schema = z.object({
        action: z.enum([
          'note',
          'assign',
          'acknowledge',
          'investigate',
          'mitigate',
          'resolve',
          'close',
          'severity',
          'transition',
        ]),
        note: z.string().max(4000).optional(),
        actor: z.string().max(120).optional(),
        assignee: z.string().max(120).optional(),
        remediation: z.string().max(4000).optional(),
        severity: z.enum(['critical', 'major', 'minor', 'warning', 'info']).optional(),
        status: z.enum([
          'open',
          'acknowledged',
          'investigating',
          'mitigated',
          'resolved',
          'closed',
        ]).optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return badRequest(reply, parsed.error);
      const result = await actOnIncident(request.params.id, parsed.data.action, parsed.data);
      if ('error' in result) {
        return reply.status(result.error === 'not_found' ? 404 : 409).send(result);
      }
      return result;
    },
  );

  app.get('/api/v1/alert-rules', async () => ({ data: await getAlertRules() }));

  app.patch<{ Params: { id: string } }>(
    '/api/v1/alert-rules/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const schema = z.object({
        enabled: z.boolean().optional(),
        threshold: z.string().max(200).optional(),
        cooldownSeconds: z.number().int().min(0).max(604_800).optional(),
        severity: z.enum(['critical', 'major', 'minor', 'warning', 'info']).optional(),
        windowSeconds: z.number().int().min(30).max(86_400).optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return badRequest(reply, parsed.error);
      const rule = await updateAlertRule(request.params.id, parsed.data);
      if (!rule) return reply.status(404).send({ error: 'not_found' });
      return rule;
    },
  );

  app.get('/api/v1/integrations', async () => ({ data: await getIntegrations() }));

  app.patch<{ Params: { id: string } }>(
    '/api/v1/integrations/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const schema = z.object({
        name: z.string().min(2).max(120).optional(),
        webhookUrl: z.string().url().max(2048).nullable().optional(),
        secret: z.string().max(500).nullable().optional(),
        enabled: z.boolean().optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return badRequest(reply, parsed.error);
      const integration = await updateIntegration(request.params.id, parsed.data);
      if (!integration) return reply.status(404).send({ error: 'not_found' });
      if ('error' in integration) {
        return reply.status(409).send({
          error: integration.error,
          message: 'Only the signed webhook integration is editable.',
        });
      }
      return integration;
    },
  );

  app.get('/api/v1/settings', async () => getSettings());

  app.patch('/api/v1/settings', { preHandler: requireAdmin }, async (request, reply) => {
    const schema = z.object({
      settings: z
        .array(
          z.object({
            key: z.string().min(1).max(120),
            value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
          }),
        )
        .min(1)
        .max(50),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return badRequest(reply, parsed.error);
    return updateSettings(parsed.data.settings);
  });

  app.get('/api/v1/collection/status', async () => getCollectorStatus());

  app.post('/api/v1/collect', { preHandler: requireAdmin }, async (request, reply) => {
    const schema = z.object({
      networkIds: z.array(z.string().max(80)).max(10).optional(),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) return badRequest(reply, parsed.error);
    try {
      const results = await collectAll('api', parsed.data.networkIds);
      return { results };
    } catch (error) {
      return reply.status(400).send({
        error: 'collection_failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/v1/monitors/run-due', { preHandler: requireAdmin }, async () => ({
    outcomes: await runDueMonitors('api'),
  }));

  app.get('/api/v1/adapters', async () => {
    const db = await getDb();
    const rows = await db.query<Record<string, unknown>>(
      `SELECT * FROM network_adapters ORDER BY network_id`,
    );
    return {
      adapters: getAdapterMetadata().map((metadata) => ({
        ...metadata,
        runtime: rows.rows.find((row) => row.network_id === metadata.networkId) ?? null,
      })),
    };
  });

  app.get('/api/v1/metric-definitions', async () => {
    const db = await getDb();
    const rows = await db.query<Record<string, unknown>>(
      'SELECT * FROM metric_definitions ORDER BY comparability_group, key',
    );
    return { data: rows.rows };
  });

  app.get('/api/v1/openapi.json', async () => openApiDocument);

  app.get('/api/docs', async (_request, reply) => {
    reply.header('content-type', 'text/html; charset=utf-8');
    return apiDocsHtml();
  });
}

function apiDocsHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ComputePulse API documentation</title>
<style>
  :root { color-scheme: dark; --bg:#11171D; --panel:#19232D; --text:#ECF1F5; --muted:#96A5B1; --cyan:#42B8C5; --border:#2B3945; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.6 ui-sans-serif,system-ui,sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 48px 24px; }
  h1,h2 { letter-spacing:-0.02em; }
  code, pre { font-family: ui-monospace, monospace; }
  code { color: var(--cyan); }
  a { color: var(--cyan); }
  section { background: var(--panel); border:1px solid var(--border); border-radius:12px; padding:20px 24px; margin:20px 0; }
  pre { overflow:auto; background:#11171D; padding:16px; border-radius:8px; border:1px solid var(--border); color:var(--muted); }
  .muted { color:var(--muted); }
</style>
</head>
<body><main>
<h1>ComputePulse API</h1>
<p class="muted">Version 1.0.0. Local endpoint: <code>http://localhost:8787</code>. Machine-readable specification: <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>.</p>
<section>
<h2>Evidence states</h2>
<ul>
<li><strong>OBSERVED</strong> — measured directly by the ComputePulse worker.</li>
<li><strong>REPORTED</strong> — supplied by the upstream source.</li>
<li><strong>ESTIMATED</strong> — derived with a documented method.</li>
<li><strong>UNAVAILABLE</strong> — the source does not expose the signal.</li>
<li><strong>STALE</strong> — an old observation exists beyond its freshness policy.</li>
</ul>
</section>
<section>
<h2>Primary routes</h2>
<pre>GET  /health
GET  /metrics
GET  /api/v1/meta
GET  /api/v1/overview
GET  /api/v1/networks
GET  /api/v1/networks/:id
GET  /api/v1/networks/:id/history
GET  /api/v1/providers
GET  /api/v1/providers/:id
GET  /api/v1/providers/:id/history
GET  /api/v1/capacity
GET  /api/v1/benchmarks
GET  /api/v1/monitors
POST /api/v1/monitors
GET  /api/v1/monitors/:id
PATCH /api/v1/monitors/:id
POST /api/v1/monitors/:id/check
GET  /api/v1/incidents
POST /api/v1/incidents
GET  /api/v1/incidents/:id
POST /api/v1/incidents/:id/actions
GET  /api/v1/alert-rules
PATCH /api/v1/alert-rules/:id
GET  /api/v1/integrations
PATCH /api/v1/integrations/:id
GET  /api/v1/reports
GET  /api/v1/settings
PATCH /api/v1/settings
GET  /api/v1/collection/status
POST /api/v1/collect
GET  /api/v1/adapters
GET  /api/v1/metric-definitions</pre>
</section>
<section>
<h2>Authentication</h2>
<p>Read routes are public in the local reference deployment. Mutations require <code>Authorization: Bearer &lt;ADMIN_API_TOKEN&gt;</code> when <code>ADMIN_API_TOKEN</code> is configured. No token is accepted as a substitute for SSRF validation.</p>
</section>
<section>
<h2>Operational notes</h2>
<p>Every metric response carries an evidence class, source endpoint, observation and collection time, and a freshness object. Missing observations are returned as gaps. Provider host references are never probed implicitly.</p>
</section>
</main></body></html>`;
}
