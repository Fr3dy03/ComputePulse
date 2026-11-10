export type FreshnessState =
  | 'fresh'
  | 'delayed'
  | 'stale'
  | 'unavailable'
  | 'pending';

export interface Freshness {
  state: FreshnessState;
  ageSeconds: number | null;
  message: string;
}

export function ageSeconds(
  timestamp: string | Date | null | undefined,
  now = new Date(),
): number | null {
  if (!timestamp) return null;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
}

export function describeFreshness(
  lastSuccessAt: string | Date | null | undefined,
  staleAfterSeconds: number,
  expectedIntervalSeconds: number,
  now = new Date(),
): Freshness {
  const age = ageSeconds(lastSuccessAt, now);
  if (age === null) {
    return {
      state: 'unavailable',
      ageSeconds: null,
      message: 'No successful collection has been recorded.',
    };
  }
  if (age > staleAfterSeconds) {
    return {
      state: 'stale',
      ageSeconds: age,
      message: `Last successful collection was ${formatDuration(age)} ago; this exceeds the ${formatDuration(
        staleAfterSeconds,
      )} stale threshold.`,
    };
  }
  if (age > Math.max(expectedIntervalSeconds * 2, expectedIntervalSeconds + 60)) {
    return {
      state: 'delayed',
      ageSeconds: age,
      message: `Last successful collection was ${formatDuration(age)} ago; the expected interval is ${formatDuration(
        expectedIntervalSeconds,
      )}.`,
    };
  }
  return {
    state: 'fresh',
    ageSeconds: age,
    message: `Observed ${formatDuration(age)} ago.`,
  };
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return '—';
  }
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86_400).toFixed(1)}d`;
}

export function iso(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function nowIso(now = new Date()): string {
  return now.toISOString();
}
