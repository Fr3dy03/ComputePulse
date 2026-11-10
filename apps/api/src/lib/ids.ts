import { createHash, randomUUID } from 'node:crypto';

export function uuid(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function shortHash(value: string, length = 10): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

export function stableProviderId(networkId: string, externalId: string): string {
  return `${networkId.replace(/[^a-z0-9]+/gi, '_')}_${shortHash(
    `${networkId}:${externalId}`,
    16,
  )}`;
}

export function sanitizeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
