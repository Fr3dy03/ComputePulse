import fs from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const ssrfMocks = vi.hoisted(() => ({
  safeFetch: vi.fn(),
}));

vi.mock('../../src/lib/ssrf.js', () => ({
  safeFetch: ssrfMocks.safeFetch,
  assertSafeHttpUrl: vi.fn(async (raw: string) => {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS targets are supported');
    }
    return {
      url,
      addresses: [{ address: url.hostname, family: 4 }],
    };
  }),
  createSafeAgent: vi.fn(),
  isPrivateIpv4: vi.fn(() => false),
  isPrivateIpv6: vi.fn(() => false),
  isPublicIp: vi.fn(() => true),
  ssrfPolicyDescription: vi.fn(() => ({})),
}));

import { closeDb, getDb } from '../../src/db/client.js';
import { seedStatic } from '../../src/db/seed.js';
import { verifyHmac } from '../../src/lib/crypto.js';
import { getBenchmarks, getReports } from '../../src/services/analytics.js';
import {
  actOnIncident,
  createIncident,
  findOpenIncidentBySourceRef,
  getIncident,
  incidentSourceCommitment,
} from '../../src/services/incidents.js';
import {
  createMonitor,
  getMonitorDetail,
  runMonitor,
  updateMonitor,
} from '../../src/services/monitors.js';

const TEST_DB_DIR = '.data/vitest-pglite';

beforeAll(async () => {
  await closeDb();
  await fs.rm(TEST_DB_DIR, { recursive: true, force: true });
  const db = await getDb();
  await seedStatic(db);
});

afterAll(async () => {
  await closeDb();
  await fs.rm(TEST_DB_DIR, { recursive: true, force: true });
});

describe('incident lifecycle', () => {
  it('enforces transitions and records every lifecycle event', async () => {
    const created = await createIncident({
      title: 'Provider reported offline',
      summary:
        'A source reported the provider offline. Outage onset is not exposed by the source.',
      severity: 'critical',
      networkId: 'akash-mainnet',
      source: 'adapter',
      sourceRef: 'test:incident-lifecycle',
      sourceUrl: 'https://console-api.akash.network/v1/providers',
      metadata: { evidence: 'reported' },
    });

    expect(created.status).toBe('open');
    expect(created.anchor_status).toBe('not_anchored');
    const firstRead = await getIncident(created.id);
    expect(firstRead?.events).toHaveLength(1);

    const invalid = await actOnIncident(created.id, 'transition', {
      status: 'closed',
    });
    expect(invalid).toMatchObject({
      error: 'invalid_transition',
      from: 'open',
      to: 'closed',
    });

    const prematureClose = await actOnIncident(created.id, 'close');
    expect(prematureClose).toMatchObject({ error: 'must_resolve_first' });

    const acknowledged = await actOnIncident(created.id, 'acknowledge', {
      actor: 'sre@computepulse.local',
      note: 'Acknowledged during test.',
    });
    expect('incident' in acknowledged && acknowledged.incident.status).toBe(
      'acknowledged',
    );

    const mitigated = await actOnIncident(created.id, 'mitigate', {
      remediation: 'Provider endpoint restarted and verified.',
      note: 'Mitigation applied.',
    });
    expect('incident' in mitigated && mitigated.incident.status).toBe('mitigated');

    const resolved = await actOnIncident(created.id, 'resolve', {
      remediation: 'Recovery confirmed for 30 minutes.',
      note: 'Resolved.',
    });
    expect('incident' in resolved && resolved.incident.status).toBe('resolved');

    const closed = await actOnIncident(created.id, 'close', {
      note: 'Post-incident review complete.',
    });
    expect('incident' in closed && closed.incident.status).toBe('closed');
    expect(
      'incident' in closed ? closed.incident.resolved_at : null,
    ).not.toBeNull();

    const afterClose = await actOnIncident(created.id, 'acknowledge');
    expect(afterClose).toMatchObject({ error: 'closed_incident' });

    const finalRead = await getIncident(created.id);
    expect(finalRead?.events.map((event) => (event as { event_type: string }).event_type))
      .toEqual([
        'created',
        'acknowledged',
        'mitigation',
        'resolved',
        'closed',
      ]);

    const commitment = incidentSourceCommitment(finalRead!);
    expect(commitment).toHaveLength(64);
    expect(incidentSourceCommitment(finalRead!)).toBe(commitment);
  });

  it('returns an existing open incident for the same source reference', async () => {
    const first = await createIncident({
      title: 'Repeated source reference',
      summary: 'Duplicate correlation guard.',
      severity: 'warning',
      networkId: 'flux-mainnet',
      source: 'adapter',
      sourceRef: 'test:duplicate-source',
    });
    const found = await findOpenIncidentBySourceRef('test:duplicate-source');
    expect(found?.id).toBe(first.id);
  });

  it('signs webhook deliveries with HMAC-SHA256', async () => {
    const db = await getDb();
    const secret = 'integration-test-webhook-secret';
    await db.query(
      `UPDATE integrations
       SET status=$1, config=$2::jsonb
       WHERE id='int_webhook'`,
      [
        'configured',
        JSON.stringify({
          webhook_url: 'https://alerts.example.com/computepulse',
          secret,
        }),
      ],
    );
    ssrfMocks.safeFetch.mockResolvedValueOnce({
      statusCode: 202,
      latencyMs: 12,
      body: 'accepted',
      bytes: 8,
      headers: new Headers(),
    });

    const incident = await createIncident({
      title: 'Webhook delivery test',
      summary: 'Exercises the signed alert path.',
      severity: 'major',
      networkId: 'akash-mainnet',
      source: 'adapter',
      sourceRef: 'test:webhook-delivery',
    });

    expect(ssrfMocks.safeFetch).toHaveBeenCalledTimes(1);
    const call = ssrfMocks.safeFetch.mock.calls[0]!;
    const [destination, options] = call as [
      string,
      { headers: Record<string, string>; body: string; method: string },
    ];
    expect(destination).toBe('https://alerts.example.com/computepulse');
    expect(options.method).toBe('POST');
    expect(options.headers['x-computepulse-event']).toBe('incident.created');
    const signature = options.headers['x-computepulse-signature']!;
    expect(signature.startsWith('sha256=')).toBe(true);
    expect(verifyHmac(options.body, signature.slice('sha256='.length), secret)).toBe(
      true,
    );

    const deliveries = await db.query<{ channel: string; status: string; destination: string }>(
      `SELECT channel, status, destination FROM alert_deliveries WHERE incident_id=$1 ORDER BY channel`,
      [incident.id],
    );
    expect(
      deliveries.rows.some(
        (row) => row.channel === 'webhook' && row.status === 'delivered',
      ),
    ).toBe(true);
    expect(
      deliveries.rows.some(
        (row) => row.channel === 'in_app' && row.status === 'delivered',
      ),
    ).toBe(true);

    await db.query(
      `UPDATE integrations SET status='unconfigured', config='{}'::jsonb WHERE id='int_webhook'`,
    );
    ssrfMocks.safeFetch.mockReset();
  });
});

describe('endpoint monitors', () => {
  it('records endpoint changes without losing monitor history', async () => {
    const monitor = await createMonitor({
      name: 'Endpoint change test',
      networkId: 'akash-mainnet',
      targetUrl: 'https://1.1.1.1/health',
      intervalSeconds: 300,
      timeoutMs: 5_000,
      retries: 0,
    });
    expect(monitor?.target_url).toBe('https://1.1.1.1/health');

    const updated = await updateMonitor(monitor!.id, {
      targetUrl: 'https://8.8.8.8/health',
      timeoutMs: 4_000,
    });
    expect(updated?.target_url).toBe('https://8.8.8.8/health');
    expect(updated?.timeout_ms).toBe(4_000);

    const detail = await getMonitorDetail(monitor!.id);
    expect(detail?.target_url).toBe('https://8.8.8.8/health');

    const db = await getDb();
    const audit = await db.query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE entity_id=$1 ORDER BY created_at`,
      [monitor!.id],
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'monitor.created',
      'monitor.updated',
    ]);
  });

  it('opens an incident after repeated downtime and annotates recovery', async () => {
    const monitor = await createMonitor({
      name: 'Downtime test monitor',
      networkId: 'akash-mainnet',
      targetUrl: 'https://1.1.1.1/down',
      intervalSeconds: 300,
      timeoutMs: 5_000,
      retries: 0,
    });
    ssrfMocks.safeFetch.mockResolvedValue({
      statusCode: 503,
      latencyMs: 15,
      body: 'unavailable',
      bytes: 11,
      headers: new Headers(),
    });

    const first = await runMonitor(monitor!.id, 'test');
    expect(first.success).toBe(false);
    expect(first.statusCode).toBe(503);
    expect(await findOpenIncidentBySourceRef(`monitor:${monitor!.id}`)).toBeNull();

    const second = await runMonitor(monitor!.id, 'test');
    expect(second.success).toBe(false);
    const incident = await findOpenIncidentBySourceRef(`monitor:${monitor!.id}`);
    expect(incident).not.toBeNull();
    expect(incident?.severity).toBe('critical');
    expect(incident?.source).toBe('endpoint_monitor');

    ssrfMocks.safeFetch.mockResolvedValue({
      statusCode: 200,
      latencyMs: 9,
      body: 'ok',
      bytes: 2,
      headers: new Headers(),
    });
    const recovered = await runMonitor(monitor!.id, 'test');
    expect(recovered.success).toBe(true);

    const afterRecovery = await getIncident(incident!.id);
    expect(afterRecovery?.status).not.toBe('closed');
    const recoveryNote = afterRecovery?.events.find(
      (event) => (event as { event_type: string }).event_type === 'note',
    ) as { note?: string } | undefined;
    expect(recoveryNote?.note).toContain('Endpoint recovered');
    ssrfMocks.safeFetch.mockReset();
  });

  it('preserves missing checks as absence rather than zero availability', async () => {
    const monitor = await createMonitor({
      name: 'No checks yet',
      networkId: 'akash-mainnet',
      targetUrl: 'https://1.1.1.1/empty',
      retries: 0,
    });
    const detail = await getMonitorDetail(monitor!.id);
    expect(detail?.checks_24h).toBe(0);
    expect(detail?.availability_24h).toBeNull();
    expect(detail?.last_checked_at).toBeNull();
    expect(detail?.last_status).toBe('pending');
  });
});

describe('benchmarks and reports', () => {
  it('does not publish a universal provider score or cross-unit ranking', async () => {
    const benchmarks = await getBenchmarks();
    expect(benchmarks.networks.length).toBeGreaterThanOrEqual(4);
    expect(benchmarks.comparabilityGroups.length).toBeGreaterThan(0);
    for (const group of benchmarks.comparabilityGroups) {
      expect(group.group.length).toBeGreaterThan(0);
      expect(group.note).toContain('comparable');
    }
    expect(benchmarks.caveats.join(' ')).toContain('No composite provider score');
    expect(benchmarks.networks[0]).not.toHaveProperty('score');
    expect(benchmarks.networks[0]).not.toHaveProperty('rank');
  });

  it('generates a windowed report from stored rows', async () => {
    const report = await getReports({ days: 7 });
    expect(report.windowDays).toBe(7);
    expect(report.networks.length).toBeGreaterThanOrEqual(4);
    expect(report.notes.join(' ')).toContain('Missing observations');
    expect(report.monitors.length).toBeGreaterThan(0);
  });
});
