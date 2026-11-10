import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTextTimed, readLimited } from '../../src/lib/http.js';
import {
  assertSafeHttpUrl,
  isPrivateIpv4,
  isPrivateIpv6,
  isPublicIp,
} from '../../src/lib/ssrf.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SSRF protections for monitor targets', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
  ])('classifies %s as private or reserved', (address) => {
    expect(isPrivateIpv4(address)).toBe(true);
    expect(isPublicIp(address)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34'])(
    'classifies %s as public',
    (address) => {
      expect(isPrivateIpv4(address)).toBe(false);
      expect(isPublicIp(address)).toBe(true);
    },
  );

  it.each([
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
  ])('classifies %s as private or reserved', (address) => {
    expect(isPrivateIpv6(address)).toBe(true);
  });

  it('accepts a public IPv6 address', () => {
    expect(isPrivateIpv6('2606:4700:4700::1111')).toBe(false);
    expect(isPublicIp('2606:4700:4700::1111')).toBe(true);
  });

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://[::1]',
    'http://169.254.169.254/latest/meta-data',
    'http://metadata.google.internal',
    'http://printer.local',
    'ftp://example.com',
    'file:///etc/passwd',
    'https://user:password@example.com',
    'http://example.com:6379',
  ])('rejects unsafe target %s', async (target) => {
    await expect(assertSafeHttpUrl(target)).rejects.toThrow();
  });

  it('accepts public IP literals on allowlisted ports without DNS', async () => {
    await expect(assertSafeHttpUrl('https://1.1.1.1')).resolves.toMatchObject({
      addresses: [{ address: '1.1.1.1', family: 4 }],
    });
    await expect(assertSafeHttpUrl('http://1.1.1.1:8080/health')).resolves.toBeTruthy();
  });
});

describe('bounded source fetching', () => {
  it('retries a rate-limited source and records the successful response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('slow down', { status: 429, statusText: 'Too Many Requests' }),
      )
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTextTimed('https://source.example.com/data', {
      retries: 1,
      timeoutMs: 1_000,
    });

    expect(result.status).toBe(200);
    expect(result.text).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces repeated rate limiting as a source failure', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchTextTimed('https://source.example.com/data', {
        retries: 1,
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow('HTTP 429');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aborts a source request at the configured timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
      ),
    );

    await expect(
      fetchTextTimed('https://source.example.com/slow', {
        retries: 0,
        timeoutMs: 25,
      }),
    ).rejects.toThrow(/abort/i);
  });

  it('rejects responses that exceed the byte limit', async () => {
    const response = new Response('x'.repeat(2_048), { status: 200 });
    await expect(readLimited(response, 1_024)).rejects.toThrow(
      'exceeded the 1024 byte safety limit',
    );
  });
});
