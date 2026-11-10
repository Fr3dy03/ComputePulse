CREATE TABLE IF NOT EXISTS organisations (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'operator',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  organisation_id text NOT NULL REFERENCES organisations(id),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'operator',
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS networks (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  kind text NOT NULL,
  chain_id bigint,
  source_adapter text NOT NULL,
  source_url text,
  explorer_url text,
  docs_url text,
  description text,
  health_state text NOT NULL DEFAULT 'unknown',
  health_reason text,
  last_observed_at timestamptz,
  supported_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  brand_color text NOT NULL DEFAULT '#42B8C5',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS network_adapters (
  id text PRIMARY KEY,
  network_id text NOT NULL REFERENCES networks(id),
  version text NOT NULL,
  source_url text NOT NULL,
  docs_url text,
  auth_method text NOT NULL DEFAULT 'none',
  rate_limit text,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_source_status (
  network_id text PRIMARY KEY REFERENCES networks(id),
  state text NOT NULL DEFAULT 'pending',
  stale_after_seconds integer NOT NULL DEFAULT 1800,
  expected_interval_seconds integer NOT NULL DEFAULT 300,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  source_latency_ms integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_runs (
  id text PRIMARY KEY,
  network_id text NOT NULL REFERENCES networks(id),
  adapter_id text NOT NULL,
  adapter_version text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  providers_seen integer NOT NULL DEFAULT 0,
  observations_written integer NOT NULL DEFAULT 0,
  source_latency_ms integer,
  worker_id text NOT NULL,
  error text
);

CREATE TABLE IF NOT EXISTS providers (
  id text PRIMARY KEY,
  network_id text NOT NULL REFERENCES networks(id),
  external_id text NOT NULL,
  name text,
  operator_address text,
  host_uri text,
  region text,
  country text,
  city text,
  location_source text,
  hardware jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_state text NOT NULL DEFAULT 'unknown',
  health_signal text NOT NULL DEFAULT 'unavailable',
  health_reason text,
  availability_1d double precision,
  availability_7d double precision,
  availability_30d double precision,
  availability_method text,
  latest_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_capacity jsonb,
  capacity_evidence text NOT NULL DEFAULT 'unavailable',
  source_url text,
  status_observed_at timestamptz,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network_id, external_id)
);

CREATE INDEX IF NOT EXISTS providers_network_idx ON providers (network_id);
CREATE INDEX IF NOT EXISTS providers_health_idx ON providers (network_id, health_state);
CREATE INDEX IF NOT EXISTS providers_seen_idx ON providers (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS providers_name_idx ON providers (name);

CREATE TABLE IF NOT EXISTS provider_endpoints (
  id text PRIMARY KEY,
  provider_id text NOT NULL REFERENCES providers(id),
  kind text NOT NULL,
  url text NOT NULL,
  allowlisted boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  last_probe_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monitors (
  id text PRIMARY KEY,
  organisation_id text NOT NULL REFERENCES organisations(id),
  network_id text REFERENCES networks(id),
  provider_id text REFERENCES providers(id),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'http',
  target_url text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  request_body text,
  expected_status integer NOT NULL DEFAULT 200,
  expected_body_contains text,
  headers_encrypted text,
  auth_type text NOT NULL DEFAULT 'none',
  interval_seconds integer NOT NULL DEFAULT 300,
  timeout_ms integer NOT NULL DEFAULT 10000,
  retries integer NOT NULL DEFAULT 2,
  enabled boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_status text NOT NULL DEFAULT 'pending',
  last_latency_ms integer,
  last_status_code integer,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monitors_due_idx ON monitors (enabled, last_checked_at);
CREATE INDEX IF NOT EXISTS monitors_network_idx ON monitors (network_id);

CREATE TABLE IF NOT EXISTS monitor_checks (
  id bigserial PRIMARY KEY,
  monitor_id text NOT NULL REFERENCES monitors(id),
  checked_at timestamptz NOT NULL,
  latency_ms integer,
  status_code integer,
  success boolean NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  error text,
  source text NOT NULL DEFAULT 'scheduler',
  worker_id text NOT NULL,
  response_bytes integer,
  freshness_seconds integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS monitor_checks_monitor_time_idx
  ON monitor_checks (monitor_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS metric_definitions (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL,
  value_type text NOT NULL,
  source_kind text NOT NULL,
  evidence_type text NOT NULL,
  comparability_group text NOT NULL,
  direction text NOT NULL DEFAULT 'neutral',
  supported_networks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS observations (
  id bigserial PRIMARY KEY,
  network_id text NOT NULL REFERENCES networks(id),
  provider_id text REFERENCES providers(id),
  metric_key text NOT NULL,
  value double precision,
  unit text NOT NULL,
  observed_at timestamptz NOT NULL,
  collected_at timestamptz NOT NULL,
  source_endpoint text NOT NULL,
  adapter_version text NOT NULL,
  collection_run_id text NOT NULL,
  status text NOT NULL DEFAULT 'observed',
  success boolean NOT NULL DEFAULT true,
  error text,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS observations_provider_metric_time_idx
  ON observations (provider_id, metric_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS observations_network_metric_time_idx
  ON observations (network_id, metric_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS observations_run_idx ON observations (collection_run_id);

CREATE TABLE IF NOT EXISTS capacity_snapshots (
  id bigserial PRIMARY KEY,
  network_id text NOT NULL REFERENCES networks(id),
  provider_id text NOT NULL REFERENCES providers(id),
  observed_at timestamptz NOT NULL,
  collected_at timestamptz NOT NULL,
  source_endpoint text NOT NULL,
  evidence_type text NOT NULL,
  cpu_total_cores double precision,
  cpu_available_cores double precision,
  cpu_active_cores double precision,
  memory_total_bytes double precision,
  memory_available_bytes double precision,
  memory_active_bytes double precision,
  storage_total_bytes double precision,
  storage_available_bytes double precision,
  gpu_total double precision,
  gpu_available double precision,
  gpu_active double precision,
  gpu_models jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS capacity_provider_time_idx
  ON capacity_snapshots (provider_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS capacity_network_time_idx
  ON capacity_snapshots (network_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS workload_references (
  id text PRIMARY KEY,
  provider_id text NOT NULL REFERENCES providers(id),
  network_id text NOT NULL REFERENCES networks(id),
  external_id text NOT NULL,
  name text,
  status text,
  namespace text,
  source_endpoint text,
  observed_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS incidents (
  id text PRIMARY KEY,
  organisation_id text NOT NULL REFERENCES organisations(id),
  network_id text REFERENCES networks(id),
  provider_id text REFERENCES providers(id),
  title text NOT NULL,
  summary text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  source text NOT NULL,
  source_ref text,
  source_url text,
  source_observed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  assigned_to text,
  resolved_at timestamptz,
  closed_at timestamptz,
  remediation text,
  summary_digest text,
  remediation_digest text,
  source_commitment text,
  contract_incident_id text,
  onchain_tx_hash text,
  anchor_status text NOT NULL DEFAULT 'not_anchored',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents (status, started_at DESC);
CREATE INDEX IF NOT EXISTS incidents_provider_idx ON incidents (provider_id);

CREATE TABLE IF NOT EXISTS incident_events (
  id bigserial PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(id),
  event_type text NOT NULL,
  actor text NOT NULL,
  note text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS incident_events_incident_idx
  ON incident_events (incident_id, created_at ASC);

CREATE TABLE IF NOT EXISTS alert_rules (
  id text PRIMARY KEY,
  organisation_id text NOT NULL REFERENCES organisations(id),
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  metric_key text NOT NULL,
  comparator text NOT NULL,
  threshold text NOT NULL,
  window_seconds integer NOT NULL DEFAULT 300,
  severity text NOT NULL DEFAULT 'warning',
  network_id text REFERENCES networks(id),
  provider_id text REFERENCES providers(id),
  channel_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  cooldown_seconds integer NOT NULL DEFAULT 1800,
  last_fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id text PRIMARY KEY,
  rule_id text REFERENCES alert_rules(id),
  incident_id text REFERENCES incidents(id),
  channel text NOT NULL,
  destination text,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS integrations (
  id text PRIMARY KEY,
  organisation_id text NOT NULL REFERENCES organisations(id),
  kind text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'unconfigured',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  network_id text NOT NULL REFERENCES networks(id),
  tx_hash text NOT NULL,
  kind text NOT NULL,
  contract_address text,
  status text NOT NULL,
  block_number bigint,
  incident_id text REFERENCES incidents(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  organisation_id text NOT NULL REFERENCES organisations(id),
  actor text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  organisation_id text NOT NULL REFERENCES organisations(id),
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, key)
);
