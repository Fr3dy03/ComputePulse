import { afterEach, describe, expect, it, vi } from 'vitest';
import { AkashAdapter } from '../../src/adapters/akash.js';
import { FluxAdapter } from '../../src/adapters/flux.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const GI = 1024 ** 3;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Akash Console adapter', () => {
  const provider = {
    owner: 'akash1providerowner',
    name: 'Provider One',
    hostUri: 'https://provider.example.com:8443',
    isOnline: true,
    isValidVersion: true,
    uptime1d: 0.996,
    uptime7d: 0.991,
    uptime30d: 0.985,
    lastCheckDate: '2026-11-10T09:55:00.000Z',
    akashVersion: '0.10.0',
    ipCountryCode: 'DE',
    ipRegion: 'Berlin',
    stats: {
      cpu: { total: 4_000, available: 3_000, active: 1_000 },
      memory: { total: 8 * GI, available: 6 * GI, active: 2 * GI },
      gpu: { total: 2, available: 1, active: 1 },
      storage: { total: { total: 100 * GI, available: 80 * GI } },
    },
    gpuModels: [{ vendor: 'nvidia', model: 'H100', ram: '80Gi' }],
  };

  it('normalizes reported health, uptime and capacity units', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([provider])));

    const result = await new AkashAdapter().collect({
      now: new Date('2026-11-10T10:00:00.000Z'),
    });

    expect(result.providers).toHaveLength(1);
    const normalized = result.providers[0]!;
    expect(normalized.externalId).toBe('akash1providerowner');
    expect(normalized.healthState).toBe('healthy');
    expect(normalized.healthSignal).toBe('source_reported');
    expect(normalized.availability1d).toBeCloseTo(0.996);
    expect(normalized.sourceObservedAt).toBeInstanceOf(Date);
    expect(normalized.sourceObservedAt?.toISOString()).toBe(
      '2026-11-10T09:55:00.000Z',
    );

    // Console API CPU is millicores; the normalized value must be cores.
    expect(normalized.capacity?.cpuTotalCores).toBe(4);
    expect(normalized.capacity?.cpuAvailableCores).toBe(3);
    expect(normalized.capacity?.memoryTotalBytes).toBe(8 * GI);
    expect(normalized.capacity?.gpuAvailable).toBe(1);
    expect(normalized.capacityEvidence).toBe('reported');

    const uptime = normalized.metrics.find(
      (metric) => metric.metricKey === 'akash.uptime_1d',
    );
    expect(uptime).toMatchObject({
      value: 0.996,
      unit: 'ratio',
      evidenceType: 'reported',
    });
  });

  it('marks an offline provider as down without inventing uptime', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          {
            ...provider,
            isOnline: false,
            uptime1d: null,
            stats: {},
          },
        ]),
      ),
    );

    const result = await new AkashAdapter().collect({ now: new Date() });
    expect(result.providers[0]?.healthState).toBe('down');
    expect(result.providers[0]?.availability1d).toBeNull();
    expect(result.providers[0]?.capacityEvidence).toBe('unavailable');
    expect(result.providers[0]?.capacity).toBeNull();
  });

  it('skips duplicate provider owners and reports the count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([provider, { ...provider, name: 'Duplicate' }])),
    );

    const result = await new AkashAdapter().collect({ now: new Date() });
    expect(result.providers).toHaveLength(1);
    expect(result.detail?.duplicatesSkipped).toBe(1);
  });

  it('rejects an unexpected source shape instead of reporting zero providers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'maintenance' })));

    await expect(new AkashAdapter().collect({ now: new Date() })).rejects.toThrow(
      'did not return a provider array',
    );
  });
});

describe('Flux daemon adapter', () => {
  const node = {
    txhash: 'a'.repeat(64),
    outidx: '0',
    ip: '203.0.113.10:16127',
    tier: 'CUMULUS',
    payment_address: 't1fluxoperator',
    added_height: 1_000,
    last_confirmed_height: 1_998,
    last_paid_height: 1_900,
    activesince: '1790000000',
    rank: 12,
  };

  it('keeps liveness unavailable and discloses the confirmation-lag estimate', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url).includes('getblockcount')) {
        return jsonResponse({ status: 'success', data: 2_000 });
      }
      return jsonResponse({ status: 'success', data: [node] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new FluxAdapter().collect({
      now: new Date('2026-11-10T10:00:00.000Z'),
    });

    expect(result.providers).toHaveLength(1);
    const normalized = result.providers[0]!;
    expect(normalized.healthState).toBe('unknown');
    expect(normalized.healthSignal).toBe('unavailable');
    expect(normalized.availability1d).toBeNull();
    expect(normalized.capacity).toBeNull();
    expect(normalized.capacityEvidence).toBe('unavailable');
    expect(normalized.latestMetrics['flux.confirmation_lag_blocks']).toBe(2);

    const lag = normalized.metrics.find(
      (metric) => metric.metricKey === 'flux.confirmation_lag_blocks',
    );
    expect(lag).toMatchObject({ value: 2, evidenceType: 'estimated' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates repeated node references', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        if (String(url).includes('getblockcount')) {
          return jsonResponse({ status: 'success', data: 2_000 });
        }
        return jsonResponse({ status: 'success', data: [node, node] });
      }),
    );

    const result = await new FluxAdapter().collect({ now: new Date() });
    expect(result.providers).toHaveLength(1);
    expect(result.detail?.duplicatesSkipped).toBe(1);
    expect(result.detail?.tiers).toEqual({ CUMULUS: 1 });
  });

  it('degrades the source run when the chain head is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        if (String(url).includes('getblockcount')) {
          return jsonResponse({ error: 'upstream failure' }, 502);
        }
        return jsonResponse({ status: 'success', data: [node] });
      }),
    );

    const result = await new FluxAdapter().collect({ now: new Date() });
    expect(result.status).toBe('degraded');
    expect(result.healthState).toBe('degraded');
    expect(result.providers[0]?.latestMetrics['flux.confirmation_lag_blocks']).toBeNull();
    expect(String(result.detail?.headError)).toContain('HTTP 502');
  });
});
