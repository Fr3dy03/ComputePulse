const freshness = {
  type: 'object',
  properties: {
    state: {
      type: 'string',
      enum: ['fresh', 'delayed', 'stale', 'unavailable', 'pending'],
    },
    ageSeconds: { type: ['integer', 'null'] },
    message: { type: 'string' },
  },
};

const evidence = {
  type: 'string',
  enum: ['OBSERVED', 'REPORTED', 'ESTIMATED', 'UNAVAILABLE', 'STALE'],
};

const error = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
};

function ok(schema: Record<string, unknown> = { type: 'object' }) {
  return {
    200: {
      description: 'Successful response',
      content: { 'application/json': { schema } },
    },
  };
}

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'ComputePulse API',
    version: '1.0.0',
    description:
      'Cross-network provider observability API. Metrics carry explicit evidence state and freshness. No cross-source composite health score is provided.',
    license: { name: 'Proprietary reference implementation' },
  },
  servers: [{ url: 'http://localhost:8787', description: 'Local development' }],
  tags: [
    { name: 'Evidence', description: 'Overview, networks and source metadata' },
    { name: 'Providers', description: 'Provider directory and history' },
    { name: 'Operations', description: 'Monitors, incidents, alerts and reports' },
    { name: 'Configuration', description: 'Integrations, settings and collection' },
  ],
  paths: {
    '/health': {
      get: { tags: ['Evidence'], summary: 'Liveness and database check', responses: ok() },
    },
    '/metrics': {
      get: {
        tags: ['Evidence'],
        summary: 'Prometheus exposition',
        responses: {
          200: {
            description: 'Prometheus text exposition',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
        },
      },
    },
    '/api/v1/meta': {
      get: { tags: ['Evidence'], summary: 'API metadata, evidence legend and adapters', responses: ok() },
    },
    '/api/v1/overview': {
      get: { tags: ['Evidence'], summary: 'Operations overview without a universal health score', responses: ok() },
    },
    '/api/v1/networks': {
      get: { tags: ['Evidence'], summary: 'Network summaries and freshness', responses: ok() },
    },
    '/api/v1/networks/{id}': {
      get: {
        tags: ['Evidence'],
        summary: 'Network detail, recent runs, metrics and incidents',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { ...ok(), 404: { description: 'Not found', content: { 'application/json': { schema: error } } } },
      },
    },
    '/api/v1/networks/{id}/history': {
      get: {
        tags: ['Evidence'],
        summary: 'Bucketed network metric history and observation coverage',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'metricKey', in: 'query', schema: { type: 'string' } },
          { name: 'window', in: 'query', schema: { type: 'string', enum: ['1h', '24h', '7d', '30d', 'custom'] } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: ok(),
      },
    },
    '/api/v1/providers': {
      get: {
        tags: ['Providers'],
        summary: 'Provider directory with evidence and freshness',
        parameters: [
          { name: 'networkId', in: 'query', schema: { type: 'string' } },
          { name: 'health', in: 'query', schema: { type: 'string', enum: ['healthy', 'degraded', 'down', 'unknown'] } },
          { name: 'evidence', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'hasIncident', in: 'query', schema: { type: 'boolean' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'availabilityWindow', in: 'query', schema: { type: 'string', enum: ['24h', '7d', '30d'] } },
        ],
        responses: ok(),
      },
    },
    '/api/v1/providers/{id}': {
      get: {
        tags: ['Providers'],
        summary: 'Provider provenance, observations, capacity and incidents',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: ok(),
      },
    },
    '/api/v1/providers/{id}/history': {
      get: {
        tags: ['Providers'],
        summary: 'Provider metric history with explicit gaps',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'metricKey', in: 'query', schema: { type: 'string' } },
          { name: 'window', in: 'query', schema: { type: 'string', enum: ['1h', '24h', '7d', '30d', 'custom'] } },
        ],
        responses: ok(),
      },
    },
    '/api/v1/capacity': {
      get: { tags: ['Providers'], summary: 'Reported capacity evidence by network and provider', responses: ok() },
    },
    '/api/v1/benchmarks': {
      get: { tags: ['Providers'], summary: 'Comparability groups and measured distributions', responses: ok() },
    },
    '/api/v1/monitors': {
      get: { tags: ['Operations'], summary: 'List endpoint monitors', responses: ok() },
      post: {
        tags: ['Operations'],
        summary: 'Create a monitor (validated against the SSRF policy)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'targetUrl'],
                properties: {
                  name: { type: 'string' },
                  targetUrl: { type: 'string', format: 'uri' },
                  method: { type: 'string', enum: ['GET', 'POST', 'HEAD'] },
                  expectedStatus: { type: 'integer' },
                  intervalSeconds: { type: 'integer' },
                  timeoutMs: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created' }, 400: { description: 'Rejected', content: { 'application/json': { schema: error } } } },
      },
    },
    '/api/v1/monitors/{id}': {
      get: {
        tags: ['Operations'],
        summary: 'Monitor detail and 24h checks',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: ok(),
      },
      patch: {
        tags: ['Operations'],
        summary: 'Update monitor configuration',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: ok(),
      },
    },
    '/api/v1/monitors/{id}/check': {
      post: {
        tags: ['Operations'],
        summary: 'Run an immediate check through the safe fetch client',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: ok(),
      },
    },
    '/api/v1/incidents': {
      get: {
        tags: ['Operations'],
        summary: 'Incident timeline',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'severity', in: 'query', schema: { type: 'string' } },
          { name: 'networkId', in: 'query', schema: { type: 'string' } },
        ],
        responses: ok(),
      },
      post: {
        tags: ['Operations'],
        summary: 'Create an explicitly operator-authored incident',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created' } },
      },
    },
    '/api/v1/incidents/{id}': {
      get: {
        tags: ['Operations'],
        summary: 'Incident detail, events and source commitment digest',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: ok(),
      },
    },
    '/api/v1/incidents/{id}/actions': {
      post: {
        tags: ['Operations'],
        summary: 'Apply a validated lifecycle action',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: ok(),
      },
    },
    '/api/v1/alert-rules': {
      get: { tags: ['Operations'], summary: 'Alert rules and delivery counts', responses: ok() },
    },
    '/api/v1/alert-rules/{id}': {
      patch: {
        tags: ['Operations'],
        summary: 'Update an alert rule',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: ok(),
      },
    },
    '/api/v1/integrations': {
      get: { tags: ['Configuration'], summary: 'Integrations with secrets redacted', responses: ok() },
    },
    '/api/v1/integrations/{id}': {
      patch: {
        tags: ['Configuration'],
        summary: 'Configure signed webhook destination',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: ok(),
      },
    },
    '/api/v1/reports': {
      get: {
        tags: ['Operations'],
        summary: 'Evidence report over a configurable window',
        parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 90 } }],
        responses: ok(),
      },
    },
    '/api/v1/settings': {
      get: { tags: ['Configuration'], summary: 'Settings and source freshness policy', responses: ok() },
      patch: {
        tags: ['Configuration'],
        summary: 'Update allowlisted settings',
        security: [{ bearerAuth: [] }],
        responses: ok(),
      },
    },
    '/api/v1/collection/status': {
      get: { tags: ['Configuration'], summary: 'Source status and recent collection runs', responses: ok() },
    },
    '/api/v1/collect': {
      post: {
        tags: ['Configuration'],
        summary: 'Trigger a bounded collection',
        security: [{ bearerAuth: [] }],
        responses: ok(),
      },
    },
    '/api/v1/adapters': {
      get: { tags: ['Configuration'], summary: 'Adapter metadata and runtime state', responses: ok() },
    },
    '/api/v1/metric-definitions': {
      get: { tags: ['Evidence'], summary: 'Metric definitions and evidence classes', responses: ok() },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
    schemas: {
      Freshness: freshness,
      Evidence: evidence,
      Error: error,
    },
  },
};
