import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';
import { env } from '../env.js';
import { readLimited } from './http.js';

const DEFAULT_PORTS = new Set([80, 443, 3000, 8000, 8080, 8443, 16127]);

function configuredPorts(): Set<number> {
  const raw = process.env.MONITOR_ALLOWED_PORTS;
  if (!raw) return DEFAULT_PORTS;
  const parsed = raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0 && value < 65_536);
  return parsed.length > 0 ? new Set(parsed) : DEFAULT_PORTS;
}

export function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function expandIpv6(address: string): string[] | null {
  let input = address.toLowerCase();
  const zone = input.indexOf('%');
  if (zone >= 0) input = input.slice(0, zone);
  if (input.includes('.')) {
    // IPv4-mapped suffix; convert to two hextets.
    const lastColon = input.lastIndexOf(':');
    const ipv4 = input.slice(lastColon + 1);
    if (!net.isIPv4(ipv4)) return null;
    const octets = ipv4.split('.').map(Number);
    input = `${input.slice(0, lastColon + 1)}${(
      (octets[0] << 8) |
      octets[1]
    ).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const [left, right] = input.split('::');
  const leftParts = left ? left.split(':') : [];
  const rightParts = right ? right.split(':') : [];
  if (!input.includes('::') && leftParts.length !== 8) return null;
  const fill = 8 - leftParts.length - rightParts.length;
  if (fill < 0) return null;
  const parts = [...leftParts, ...Array(fill).fill('0'), ...rightParts];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }
  return parts;
}

export function isPrivateIpv6(address: string): boolean {
  const parts = expandIpv6(address);
  if (!parts) return true;
  const numeric = parts.map((part) => parseInt(part, 16));
  const zeros = numeric.slice(0, 7).every((part) => part === 0);
  if (zeros && (numeric[7] === 0 || numeric[7] === 1)) return true;
  if ((numeric[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((numeric[0] & 0xffc0) === 0xfe80) return true; // link-local
  if ((numeric[0] & 0xff00) === 0xff00) return true; // multicast
  if (numeric[0] === 0x2001 && numeric[1] === 0x0db8) return true; // docs
  if (
    numeric[0] === 0 &&
    numeric[1] === 0 &&
    numeric[2] === 0 &&
    numeric[3] === 0 &&
    numeric[4] === 0 &&
    (numeric[5] === 0xffff || numeric[5] === 0)
  ) {
    // IPv4-mapped: ::ffff:a.b.c.d
    const v4 = `${numeric[6] >> 8}.${numeric[6] & 255}.${numeric[7] >> 8}.${numeric[7] & 255}`;
    return isPrivateIpv4(v4);
  }
  return false;
}

export function isPublicIp(address: string): boolean {
  if (net.isIPv4(address)) return !isPrivateIpv4(address);
  if (net.isIPv6(address)) return !isPrivateIpv6(address);
  return false;
}

export interface SafeTarget {
  url: URL;
  addresses: Array<{ address: string; family: number }>;
}

export async function assertSafeHttpUrl(raw: string): Promise<SafeTarget> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Target must be a valid absolute URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS targets are supported');
  }
  if (url.username || url.password) {
    throw new Error('Credentials in URLs are not allowed; use encrypted headers');
  }
  if (url.hostname.length === 0) throw new Error('Target hostname is missing');
  if (url.hostname.length > 253) throw new Error('Target hostname is too long');
  const port = url.port
    ? Number(url.port)
    : url.protocol === 'https:'
      ? 443
      : 80;
  const ports = configuredPorts();
  if (!ports.has(port)) {
    throw new Error(
      `Port ${port} is not in the monitor allowlist. Configure MONITOR_ALLOWED_PORTS for additional public service ports.`,
    );
  }
  const forbiddenNames = new Set([
    'localhost',
    'metadata',
    'metadata.google.internal',
    'instance-data',
  ]);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    forbiddenNames.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa')
  ) {
    throw new Error('Local, metadata and private hostnames are not allowed');
  }

  const hostAllowlist = (process.env.MONITOR_HOST_ALLOWLIST ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (hostAllowlist.length > 0) {
    const permitted = hostAllowlist.some(
      (entry) => hostname === entry || hostname.endsWith(`.${entry}`),
    );
    if (!permitted) {
      throw new Error('Target host is not present in MONITOR_HOST_ALLOWLIST');
    }
  }

  if (net.isIP(hostname)) {
    if (!isPublicIp(hostname)) {
      throw new Error('Private, reserved or loopback IP targets are not allowed');
    }
    return {
      url,
      addresses: [{ address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }],
    };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Target hostname could not be resolved');
  }
  if (addresses.length === 0) {
    throw new Error('Target hostname resolved to no addresses');
  }
  if (addresses.some((entry) => !isPublicIp(entry.address))) {
    throw new Error(
      'Target resolves to a private, reserved or loopback address and was blocked',
    );
  }
  return { url, addresses };
}

export function createSafeAgent(): Agent {
  return new Agent({
    connect: {
      timeout: 10_000,
      lookup(hostname, options, callback) {
        dns
          .lookup(hostname, { all: true, verbatim: true })
          .then((addresses) => {
            if (addresses.length === 0) {
              callback(new Error('No addresses resolved'), '', 4);
              return;
            }
            if (addresses.some((entry) => !isPublicIp(entry.address))) {
              callback(
                new Error('Blocked private or reserved address during connect'),
                '',
                4,
              );
              return;
            }
            if ((options as { all?: boolean }).all) {
              callback(
                null,
                addresses as unknown as string,
                0 as unknown as number,
              );
              return;
            }
            const first = addresses[0];
            callback(null, first.address, first.family);
          })
          .catch((error) => callback(error, '', 4));
      },
    },
  });
}

export interface SafeFetchResult {
  statusCode: number;
  latencyMs: number;
  body: string;
  bytes: number;
  headers: Headers;
}

export async function safeFetch(
  rawUrl: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    maxBytes?: number;
  } = {},
): Promise<SafeFetchResult> {
  const { url } = await assertSafeHttpUrl(rawUrl);
  const agent = createSafeAgent();
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 10_000,
  );
  try {
    const response = await undiciFetch(url, {
      method: (options.method ?? 'GET') as 'GET',
      headers: {
        'user-agent': 'ComputePulse-Monitor/1.0',
        accept: '*/*',
        ...options.headers,
      },
      body: options.body,
      redirect: 'manual',
      dispatcher: agent,
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error(
        `Redirects are not followed for monitor targets (received ${response.status})`,
      );
    }
    const body = await readLimited(response, options.maxBytes ?? 1_048_576);
    return {
      statusCode: response.status,
      latencyMs: Math.round(performance.now() - started),
      body,
      bytes: Buffer.byteLength(body),
      headers: response.headers as unknown as Headers,
    };
  } finally {
    clearTimeout(timeout);
    await agent.close().catch(() => undefined);
  }
}

export function ssrfPolicyDescription(): Record<string, unknown> {
  return {
    protocols: ['https:', 'http:'],
    dns_validation: 'Every resolved address must be public; revalidated at connect.',
    redirects: 'Not followed',
    ports: [...configuredPorts()].sort((a, b) => a - b),
    host_allowlist: process.env.MONITOR_HOST_ALLOWLIST ?? null,
    response_limit_bytes: 1_048_576,
    local_mode_bypass: env.NODE_ENV === 'test' ? 'tests only' : 'none',
  };
}
