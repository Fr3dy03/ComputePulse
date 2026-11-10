import { describe, expect, it } from 'vitest';
import { ageSeconds, describeFreshness, formatDuration } from '../../src/lib/time.js';
import { sha256Hex, hmacSha256Hex, verifyHmac, encryptJson, decryptJson } from '../../src/lib/crypto.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');

describe('freshness and missing-observation semantics', () => {
  it('reports a fresh collection inside the expected interval', () => {
    const freshness = describeFreshness(
      '2026-11-10T11:57:00.000Z',
      1_800,
      300,
      NOW,
    );
    expect(freshness.state).toBe('fresh');
    expect(freshness.ageSeconds).toBe(180);
  });

  it('reports a delayed collection after twice the expected interval', () => {
    const freshness = describeFreshness(
      '2026-11-10T11:48:20.000Z',
      1_800,
      300,
      NOW,
    );
    expect(freshness.state).toBe('delayed');
    expect(freshness.message).toContain('expected interval');
  });

  it('reports stale data after the configured threshold', () => {
    const freshness = describeFreshness(
      '2026-11-10T11:00:00.000Z',
      1_800,
      300,
      NOW,
    );
    expect(freshness.state).toBe('stale');
    expect(freshness.message).toContain('exceeds');
  });

  it('reports unavailable when no successful collection exists', () => {
    const freshness = describeFreshness(null, 1_800, 300, NOW);
    expect(freshness.state).toBe('unavailable');
    expect(freshness.ageSeconds).toBeNull();
    expect(freshness.message).toContain('No successful collection');
  });

  it('does not invent an age for an invalid or missing timestamp', () => {
    expect(ageSeconds(null, NOW)).toBeNull();
    expect(ageSeconds('not-a-date', NOW)).toBeNull();
    expect(formatDuration(null)).toBe('—');
  });
});

describe('credential and webhook cryptography', () => {
  it('encrypts and decrypts monitor headers with AES-256-GCM', () => {
    const encrypted = encryptJson({ authorization: 'Bearer secret-token' });
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain('secret-token');
    expect(decryptJson(encrypted)).toEqual({ authorization: 'Bearer secret-token' });
  });

  it('produces stable SHA-256 commitments', () => {
    expect(sha256Hex('evidence')).toBe(sha256Hex('evidence'));
    expect(sha256Hex('evidence')).not.toBe(sha256Hex('evidence '));
    expect(sha256Hex('evidence')).toHaveLength(64);
  });

  it('verifies webhook HMAC signatures and rejects tampering', () => {
    const payload = '{"event":"incident.created"}';
    const signature = hmacSha256Hex(payload, 'shared-secret');
    expect(verifyHmac(payload, signature, 'shared-secret')).toBe(true);
    expect(verifyHmac(`${payload} `, signature, 'shared-secret')).toBe(false);
    expect(verifyHmac(payload, signature, 'wrong-secret')).toBe(false);
    expect(verifyHmac(payload, signature.slice(0, 10), 'shared-secret')).toBe(false);
  });
});
