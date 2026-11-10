import type { Database } from './client.js';
import { env } from '../env.js';

const ORG_ID = env.DEMO_ORG_ID;

const networks = [
  {
    id: 'akash-mainnet',
    name: 'Akash Network',
    slug: 'akash-mainnet',
    kind: 'compute_marketplace',
    chainId: null,
    sourceAdapter: 'akash-console',
    sourceUrl: 'https://console-api.akash.network/v1/providers',
    explorerUrl: 'https://akash.network/',
    docsUrl:
      'https://akash.network/docs/api-documentation/rest-api/providers-api/',
    description:
      'Decentralised compute marketplace. Provider discovery uses the public Akash Console provider API.',
    supportedMetrics: [
      'source-reported online state',
      'source-reported 1d / 7d / 30d uptime',
      'provider-reported CPU, GPU, memory and storage totals and availability',
      'location, hardware and version metadata',
    ],
    limitations: [
      'Online state is source-reported, not independently probed.',
      'Resource stats are provider-reported through the index and may not reflect schedulable capacity.',
      'Uptime values are windows supplied by the source; ComputePulse does not verify them.',
      'The index does not expose workload execution quality.',
    ],
    brandColor: '#42B8C5',
  },
  {
    id: 'flux-mainnet',
    name: 'Flux Network',
    slug: 'flux-mainnet',
    kind: 'compute_network',
    chainId: null,
    sourceAdapter: 'flux-daemon',
    sourceUrl: 'https://api.runonflux.io/daemon/listfluxnodes',
    explorerUrl: 'https://runonflux.com/',
    docsUrl: 'https://docs.runonflux.io/fluxapi/',
    description:
      'Decentralised compute network. Provider discovery uses the documented public Flux daemon API.',
    supportedMetrics: [
      'node registration and tier',
      'collateral and payment references',
      'last confirmed block height',
      'estimated confirmation recency relative to chain head',
    ],
    limitations: [
      'The public node list does not expose an online or liveness flag.',
      'The list response does not expose CPU, memory, storage or GPU capacity.',
      'A separate per-node benchmark endpoint exists, but ComputePulse does not mass-query it.',
      'IP addresses are references only and are not probed by the collector by default.',
    ],
    brandColor: '#4D8CC8',
  },
  {
    id: 'bot-mainnet',
    name: 'BOT Chain',
    slug: 'bot-mainnet',
    kind: 'settlement_network',
    chainId: 677,
    sourceAdapter: 'bot-mainnet-rpc',
    sourceUrl: 'https://rpc.botchain.ai',
    explorerUrl: 'https://scan.botchain.ai/',
    docsUrl:
      'https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/',
    description:
      'EVM-compatible L1 for AI, agents and DePIN. Monitored as a settlement network and used as the optional signed-incident commitment layer.',
    supportedMetrics: [
      'observed JSON-RPC latency',
      'verified chain ID',
      'head block height',
      'head block age',
    ],
    limitations: [
      'BOT Chain is not presented as a compute-provider marketplace.',
      'RPC responsiveness does not prove validator-set health or transaction inclusion quality.',
      'ProviderIncidentRegistry anchoring is optional and only active when an operator key and contract address are configured.',
    ],
    brandColor: '#10A37F',
  },
  {
    id: 'bot-bohr',
    name: 'Bohr Testnet',
    slug: 'bohr-testnet',
    kind: 'settlement_network',
    chainId: 968,
    sourceAdapter: 'bot-bohr-rpc',
    sourceUrl: 'https://rpc.bohr.life',
    explorerUrl: 'https://scan.bohr.life/',
    docsUrl:
      'https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/',
    description:
      'BOT Chain testnet used to verify the incident registry deployment workflow before mainnet promotion.',
    supportedMetrics: [
      'observed JSON-RPC latency',
      'verified chain ID',
      'head block height',
      'head block age',
    ],
    limitations: [
      'Testnet state is not production infrastructure evidence.',
      'A deployed testnet contract is a deployment reference, not an SLA guarantee.',
    ],
    brandColor: '#D9A34C',
  },
];

const metricDefinitions = [
  {
    key: 'provider.online',
    name: 'Provider online state',
    description:
      'Whether the provider index reports the provider as online at collection time.',
    unit: 'state',
    valueType: 'boolean',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'akash_provider_health',
    direction: 'higher_is_better',
  },
  {
    key: 'akash.uptime_1d',
    name: 'Akash source-reported uptime (24h)',
    description:
      'Uptime ratio supplied by the Akash Console API for the previous 24 hours.',
    unit: 'ratio',
    valueType: 'ratio',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'akash_source_uptime',
    direction: 'higher_is_better',
  },
  {
    key: 'akash.uptime_7d',
    name: 'Akash source-reported uptime (7d)',
    description:
      'Uptime ratio supplied by the Akash Console API for the previous 7 days.',
    unit: 'ratio',
    valueType: 'ratio',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'akash_source_uptime',
    direction: 'higher_is_better',
  },
  {
    key: 'akash.uptime_30d',
    name: 'Akash source-reported uptime (30d)',
    description:
      'Uptime ratio supplied by the Akash Console API for the previous 30 days.',
    unit: 'ratio',
    valueType: 'ratio',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'akash_source_uptime',
    direction: 'higher_is_better',
  },
  {
    key: 'akash.source_age_seconds',
    name: 'Akash source check age',
    description:
      'Age of the provider lastCheckDate returned by the Akash Console API at collection time.',
    unit: 'seconds',
    valueType: 'duration',
    sourceKind: 'akash_console',
    evidenceType: 'observed',
    comparabilityGroup: 'akash_source_freshness',
    direction: 'lower_is_better',
  },
  {
    key: 'akash.cpu.available_cores',
    name: 'Reported available CPU',
    description:
      'CPU cores reported available by the provider index. Derived by dividing millicores by 1000. Not independently measured.',
    unit: 'cores',
    valueType: 'gauge',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'reported_capacity',
    direction: 'neutral',
  },
  {
    key: 'akash.cpu.total_cores',
    name: 'Reported total CPU',
    description:
      'Total CPU cores reported by the provider index. Not independently measured.',
    unit: 'cores',
    valueType: 'gauge',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'reported_capacity',
    direction: 'neutral',
  },
  {
    key: 'akash.gpu.available',
    name: 'Reported available GPUs',
    description:
      'GPU units reported available by the provider index. Not independently measured.',
    unit: 'gpu',
    valueType: 'gauge',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'reported_capacity',
    direction: 'neutral',
  },
  {
    key: 'akash.memory.available_bytes',
    name: 'Reported available memory',
    description:
      'Memory bytes reported available by the provider index. Not independently measured.',
    unit: 'bytes',
    valueType: 'gauge',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'reported_capacity',
    direction: 'neutral',
  },
  {
    key: 'flux.last_confirmed_height',
    name: 'Flux last confirmed height',
    description:
      'Last block height at which the FluxNode appears in the public list confirmation data.',
    unit: 'block',
    valueType: 'counter',
    sourceKind: 'flux_daemon',
    evidenceType: 'reported',
    comparabilityGroup: 'flux_confirmation',
    direction: 'higher_is_better',
  },
  {
    key: 'flux.confirmation_lag_blocks',
    name: 'Flux confirmation recency',
    description:
      'Chain head height minus the node last_confirmed_height, calculated by ComputePulse. This is a chain-recency signal, not endpoint liveness.',
    unit: 'blocks',
    valueType: 'gauge',
    sourceKind: 'flux_daemon',
    evidenceType: 'estimated',
    comparabilityGroup: 'flux_confirmation',
    direction: 'lower_is_better',
  },
  {
    key: 'flux.node_age_seconds',
    name: 'Flux node age',
    description:
      'Age of the node registration derived from the activesince field.',
    unit: 'seconds',
    valueType: 'duration',
    sourceKind: 'flux_daemon',
    evidenceType: 'estimated',
    comparabilityGroup: 'flux_registration',
    direction: 'neutral',
  },
  {
    key: 'network.source_latency_ms',
    name: 'Source API response time',
    description:
      'Observed latency for the complete source API collection request, measured by the ComputePulse worker. Response size differs by adapter; compare only within the same collection method.',
    unit: 'milliseconds',
    valueType: 'gauge',
    sourceKind: 'computepulse_collector',
    evidenceType: 'observed',
    comparabilityGroup: 'source_collection_latency',
    direction: 'lower_is_better',
  },
  {
    key: 'network.providers_listed',
    name: 'Providers listed',
    description: 'Valid provider records observed in the source response.',
    unit: 'providers',
    valueType: 'gauge',
    sourceKind: 'computepulse_collector',
    evidenceType: 'observed',
    comparabilityGroup: 'network_coverage',
    direction: 'neutral',
  },
  {
    key: 'network.providers_source_online',
    name: 'Providers source-reported online',
    description:
      'Providers the source reports online. Not independently verified by ComputePulse.',
    unit: 'providers',
    valueType: 'gauge',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'akash_provider_health',
    direction: 'higher_is_better',
  },
  {
    key: 'network.providers_with_reported_capacity',
    name: 'Providers with reported capacity',
    description:
      'Number of providers for which the source exposes non-zero capacity fields.',
    unit: 'providers',
    valueType: 'gauge',
    sourceKind: 'akash_console',
    evidenceType: 'reported',
    comparabilityGroup: 'reported_capacity',
    direction: 'neutral',
  },
  {
    key: 'flux.node_count',
    name: 'Flux node count',
    description: 'Valid FluxNode records observed in the public list.',
    unit: 'nodes',
    valueType: 'gauge',
    sourceKind: 'flux_daemon',
    evidenceType: 'observed',
    comparabilityGroup: 'network_coverage',
    direction: 'neutral',
  },
  {
    key: 'flux.head_height',
    name: 'Flux chain head',
    description: 'Chain head height observed from the Flux daemon API.',
    unit: 'block',
    valueType: 'counter',
    sourceKind: 'flux_daemon',
    evidenceType: 'observed',
    comparabilityGroup: 'flux_chain',
    direction: 'neutral',
  },
  {
    key: 'flux.median_confirmation_lag_blocks',
    name: 'Flux median confirmation lag',
    description:
      'Median confirmation lag across observed nodes. Estimated from head height minus each node last_confirmed_height.',
    unit: 'blocks',
    valueType: 'gauge',
    sourceKind: 'flux_daemon',
    evidenceType: 'estimated',
    comparabilityGroup: 'flux_confirmation',
    direction: 'lower_is_better',
  },
  {
    key: 'chain.rpc_latency_ms',
    name: 'JSON-RPC latency',
    description:
      'Observed latency for eth_chainId and eth_getBlockByNumber from the ComputePulse worker.',
    unit: 'milliseconds',
    valueType: 'gauge',
    sourceKind: 'bot_rpc',
    evidenceType: 'observed',
    comparabilityGroup: 'bot_rpc_latency',
    direction: 'lower_is_better',
  },
  {
    key: 'chain.chain_id',
    name: 'Observed chain ID',
    description: 'Chain ID returned by the RPC endpoint.',
    unit: 'chain_id',
    valueType: 'gauge',
    sourceKind: 'bot_rpc',
    evidenceType: 'observed',
    comparabilityGroup: 'bot_chain_identity',
    direction: 'neutral',
  },
  {
    key: 'chain.block_height',
    name: 'Head block height',
    description: 'Latest block number observed from the RPC endpoint.',
    unit: 'block',
    valueType: 'counter',
    sourceKind: 'bot_rpc',
    evidenceType: 'observed',
    comparabilityGroup: 'bot_chain',
    direction: 'neutral',
  },
  {
    key: 'chain.block_age_seconds',
    name: 'Head block age',
    description:
      'ComputePulse collection time minus the latest block timestamp.',
    unit: 'seconds',
    valueType: 'duration',
    sourceKind: 'bot_rpc',
    evidenceType: 'observed',
    comparabilityGroup: 'bot_chain',
    direction: 'lower_is_better',
  },
  {
    key: 'monitor.latency_ms',
    name: 'Monitor response time',
    description:
      'Observed HTTP response time for a configured monitor, measured by the ComputePulse worker.',
    unit: 'milliseconds',
    valueType: 'gauge',
    sourceKind: 'computepulse_monitor',
    evidenceType: 'observed',
    comparabilityGroup: 'http_monitor_latency',
    direction: 'lower_is_better',
  },
  {
    key: 'monitor.consecutive_failures',
    name: 'Consecutive monitor failures',
    description:
      'Number of consecutive failed checks for a configured endpoint monitor.',
    unit: 'checks',
    valueType: 'gauge',
    sourceKind: 'computepulse_monitor',
    evidenceType: 'observed',
    comparabilityGroup: 'http_monitor_failures',
    direction: 'lower_is_better',
  },
];

const monitors = [
  {
    id: 'mon_akash_console',
    name: 'Akash Console provider API',
    kind: 'http',
    networkId: 'akash-mainnet',
    targetUrl: 'https://console-api.akash.network/v1/providers',
    method: 'GET',
    expectedStatus: 200,
    expectedBodyContains: 'hostUri',
    intervalSeconds: 300,
    timeoutMs: 30_000,
    requestBody: null,
  },
  {
    id: 'mon_flux_daemon',
    name: 'Flux public node-list API',
    kind: 'http',
    networkId: 'flux-mainnet',
    targetUrl: 'https://api.runonflux.io/daemon/listfluxnodes?limit=1',
    method: 'GET',
    expectedStatus: 200,
    expectedBodyContains: '"status":"success"',
    intervalSeconds: 300,
    timeoutMs: 30_000,
    requestBody: null,
  },
  {
    id: 'mon_bot_rpc',
    name: 'BOT Chain mainnet RPC',
    kind: 'jsonrpc',
    networkId: 'bot-mainnet',
    targetUrl: 'https://rpc.botchain.ai',
    method: 'POST',
    expectedStatus: 200,
    expectedBodyContains: '"result"',
    intervalSeconds: 60,
    timeoutMs: 15_000,
    requestBody: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    }),
  },
  {
    id: 'mon_bohr_rpc',
    name: 'Bohr testnet RPC',
    kind: 'jsonrpc',
    networkId: 'bot-bohr',
    targetUrl: 'https://rpc.bohr.life',
    method: 'POST',
    expectedStatus: 200,
    expectedBodyContains: '"result"',
    intervalSeconds: 60,
    timeoutMs: 15_000,
    requestBody: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    }),
  },
];

async function seedNetworks(db: Database) {
  for (const network of networks) {
    await db.query(
      `INSERT INTO networks
        (id, name, slug, kind, chain_id, source_adapter, source_url, explorer_url, docs_url, description, supported_metrics, limitations, brand_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         kind = EXCLUDED.kind,
         chain_id = EXCLUDED.chain_id,
         source_adapter = EXCLUDED.source_adapter,
         source_url = EXCLUDED.source_url,
         explorer_url = EXCLUDED.explorer_url,
         docs_url = EXCLUDED.docs_url,
         description = EXCLUDED.description,
         supported_metrics = EXCLUDED.supported_metrics,
         limitations = EXCLUDED.limitations,
         brand_color = EXCLUDED.brand_color,
         updated_at = now()`,
      [
        network.id,
        network.name,
        network.slug,
        network.kind,
        network.chainId,
        network.sourceAdapter,
        network.sourceUrl,
        network.explorerUrl,
        network.docsUrl,
        network.description,
        JSON.stringify(network.supportedMetrics),
        JSON.stringify(network.limitations),
        network.brandColor,
      ],
    );
  }
}

async function seedAdapterRows(db: Database) {
  const rows = [
    {
      id: 'adapter_akash_console',
      networkId: 'akash-mainnet',
      version: 'akash-console@1.0.0',
      sourceUrl: 'https://console-api.akash.network/v1/providers',
      docsUrl:
        'https://akash.network/docs/api-documentation/rest-api/providers-api/',
      auth: 'none',
      rateLimit: '1 request / 5 minutes',
      interval: 300,
      staleAfter: 900,
    },
    {
      id: 'adapter_flux_daemon',
      networkId: 'flux-mainnet',
      version: 'flux-daemon@1.0.0',
      sourceUrl: 'https://api.runonflux.io/daemon/listfluxnodes',
      docsUrl: 'https://docs.runonflux.io/fluxapi/',
      auth: 'none',
      rateLimit: '1 full list / 10 minutes',
      interval: 600,
      staleAfter: 1_800,
    },
    {
      id: 'adapter_bot_mainnet',
      networkId: 'bot-mainnet',
      version: 'bot-rpc@1.0.0',
      sourceUrl: 'https://rpc.botchain.ai',
      docsUrl:
        'https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/',
      auth: 'none',
      rateLimit: '1 JSON-RPC health sample / minute',
      interval: 60,
      staleAfter: 300,
    },
    {
      id: 'adapter_bot_bohr',
      networkId: 'bot-bohr',
      version: 'bot-rpc@1.0.0',
      sourceUrl: 'https://rpc.bohr.life',
      docsUrl:
        'https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/',
      auth: 'none',
      rateLimit: '1 JSON-RPC health sample / minute',
      interval: 60,
      staleAfter: 300,
    },
  ];
  for (const row of rows) {
    await db.query(
      `INSERT INTO network_adapters (id, network_id, version, source_url, docs_url, auth_method, rate_limit, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       ON CONFLICT (id) DO UPDATE SET
         version = EXCLUDED.version,
         source_url = EXCLUDED.source_url,
         docs_url = EXCLUDED.docs_url,
         rate_limit = EXCLUDED.rate_limit,
         enabled = true`,
      [
        row.id,
        row.networkId,
        row.version,
        row.sourceUrl,
        row.docsUrl,
        row.auth,
        row.rateLimit,
      ],
    );
    await db.query(
      `INSERT INTO data_source_status
        (network_id, state, stale_after_seconds, expected_interval_seconds, updated_at)
       VALUES ($1,'pending',$2,$3,now())
       ON CONFLICT (network_id) DO UPDATE SET
         stale_after_seconds = EXCLUDED.stale_after_seconds,
         expected_interval_seconds = EXCLUDED.expected_interval_seconds,
         updated_at = now()`,
      [row.networkId, row.staleAfter, row.interval],
    );
  }
}

async function seedMetricDefinitions(db: Database) {
  for (const metric of metricDefinitions) {
    await db.query(
      `INSERT INTO metric_definitions
        (key, name, description, unit, value_type, source_kind, evidence_type, comparability_group, direction)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         unit = EXCLUDED.unit,
         value_type = EXCLUDED.value_type,
         source_kind = EXCLUDED.source_kind,
         evidence_type = EXCLUDED.evidence_type,
         comparability_group = EXCLUDED.comparability_group,
         direction = EXCLUDED.direction`,
      [
        metric.key,
        metric.name,
        metric.description,
        metric.unit,
        metric.valueType,
        metric.sourceKind,
        metric.evidenceType,
        metric.comparabilityGroup,
        metric.direction,
      ],
    );
  }
}

async function seedMonitors(db: Database) {
  const existing = await db.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM monitors',
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;
  for (const monitor of monitors) {
    await db.query(
      `INSERT INTO monitors
        (id, organisation_id, network_id, provider_id, name, kind, target_url, method, request_body,
         expected_status, expected_body_contains, interval_seconds, timeout_ms, retries, enabled)
       VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
       ON CONFLICT (id) DO NOTHING`,
      [
        monitor.id,
        ORG_ID,
        monitor.networkId,
        monitor.name,
        monitor.kind,
        monitor.targetUrl,
        monitor.method,
        monitor.requestBody,
        monitor.expectedStatus,
        monitor.expectedBodyContains,
        monitor.intervalSeconds,
        monitor.timeoutMs,
        2,
      ],
    );
  }
}

async function seedAlertRules(db: Database) {
  const existing = await db.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM alert_rules',
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  const rules = [
    {
      id: 'rule_monitor_failure',
      name: 'Monitored endpoint failing',
      description:
        'Open a critical incident after two consecutive failed endpoint checks.',
      enabled: true,
      metricKey: 'monitor.consecutive_failures',
      comparator: 'gte',
      threshold: '2',
      windowSeconds: 300,
      severity: 'critical',
    },
    {
      id: 'rule_source_stale',
      name: 'Provider source data stale',
      description:
        'Alert when a network adapter has not completed a successful collection inside its freshness threshold.',
      enabled: true,
      metricKey: 'source.freshness',
      comparator: 'gt',
      threshold: '1800',
      windowSeconds: 600,
      severity: 'warning',
    },
    {
      id: 'rule_provider_offline',
      name: 'Watched provider reports offline',
      description:
        'Disabled by default to avoid bulk incidents. Enable after selecting a provider watchlist; incidents are correlated from source-reported state.',
      enabled: false,
      metricKey: 'provider.health',
      comparator: 'eq',
      threshold: 'down',
      windowSeconds: 600,
      severity: 'critical',
    },
  ];
  for (const rule of rules) {
    await db.query(
      `INSERT INTO alert_rules
        (id, organisation_id, name, description, enabled, metric_key, comparator, threshold, window_seconds, severity, channel_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'[]'::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        rule.id,
        ORG_ID,
        rule.name,
        rule.description,
        rule.enabled,
        rule.metricKey,
        rule.comparator,
        rule.threshold,
        rule.windowSeconds,
        rule.severity,
      ],
    );
  }
}

async function seedIntegrations(db: Database) {
  const integrations = [
    {
      id: 'int_prometheus',
      kind: 'prometheus',
      name: 'Prometheus scrape endpoint',
      status: 'configured',
      config: {
        endpoint: '/metrics',
        method: 'GET',
        content_type: 'text/plain; version=0.0.4',
      },
    },
    {
      id: 'int_otel',
      kind: 'opentelemetry',
      name: 'OpenTelemetry traces',
      status: env.OTEL_ENABLED ? 'configured' : 'ready',
      config: {
        protocol: 'OTLP/HTTP',
        service_name: env.OTEL_SERVICE_NAME,
        endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || null,
        enabled: env.OTEL_ENABLED,
      },
    },
    {
      id: 'int_webhook',
      kind: 'webhook',
      name: 'Signed alert webhook',
      status: 'unconfigured',
      config: {
        signature_header: 'X-ComputePulse-Signature',
        algorithm: 'HMAC-SHA256',
        note: 'Add an HTTPS destination in Alert Rules or Integrations. Private network targets are rejected.',
      },
    },
    {
      id: 'int_email',
      kind: 'email',
      name: 'Email notifications',
      status: env.SMTP_URL ? 'configured' : 'unconfigured',
      config: {
        transport: 'SMTP',
        note: env.SMTP_URL
          ? 'SMTP transport configured by operator environment.'
          : 'Set SMTP_URL to enable email delivery. No email is sent in local mode.',
      },
    },
  ];
  for (const integration of integrations) {
    await db.query(
      `INSERT INTO integrations (id, organisation_id, kind, name, status, config)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         config = EXCLUDED.config`,
      [
        integration.id,
        ORG_ID,
        integration.kind,
        integration.name,
        integration.status,
        JSON.stringify(integration.config),
      ],
    );
  }
}

async function seedSettings(db: Database) {
  const values: Record<string, unknown> = {
    'retention.observations_days': 30,
    'retention.monitor_checks_days': 14,
    'freshness.default_stale_seconds': env.DEFAULT_STALE_AFTER_SECONDS,
    'notifications.email': false,
    'notifications.webhook': false,
    'collector.timezone': 'UTC',
    'workspace.default_network': 'akash-mainnet',
  };
  for (const [key, value] of Object.entries(values)) {
    await db.query(
      `INSERT INTO settings (organisation_id, key, value)
       VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (organisation_id, key) DO NOTHING`,
      [ORG_ID, key, JSON.stringify(value)],
    );
  }
}

export async function seedStatic(db: Database): Promise<void> {
  await db.query(
    `INSERT INTO organisations (id, name, slug, plan)
     VALUES ($1,'ComputePulse Operations','computepulse-operations','operator')
     ON CONFLICT (id) DO NOTHING`,
    [ORG_ID],
  );
  await db.query(
    `INSERT INTO users (id, organisation_id, email, name, role, notification_preferences)
     VALUES ($1,$2,'operator@computepulse.local','Operations Lead','admin',$3::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      'usr_operations_lead',
      ORG_ID,
      JSON.stringify({
        incidents: true,
        staleData: true,
        recovery: true,
        weeklyReport: true,
      }),
    ],
  );
  await seedNetworks(db);
  await seedAdapterRows(db);
  await seedMetricDefinitions(db);
  await seedMonitors(db);
  await seedAlertRules(db);
  await seedIntegrations(db);
  await seedSettings(db);
}

export { metricDefinitions, networks };
