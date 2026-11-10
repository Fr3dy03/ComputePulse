export function slugToTitle(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatNumber(
  value: number | string | null | undefined,
  options: { maximumFractionDigits?: number; compact?: boolean } = {},
): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
    notation: options.compact ? 'compact' : 'standard',
  }).format(numeric);
}

export function formatPercent(
  value: number | string | null | undefined,
  digits = 2,
): string {
  if (value === null || value === undefined) return '—';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  const ratio = numeric > 1.5 ? numeric / 100 : numeric;
  return `${(ratio * 100).toFixed(digits)}%`;
}

const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

export function formatBytes(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric) || numeric < 0) return '—';
  if (numeric === 0) return '0 B';
  const exponent = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(numeric) / Math.log(1024)),
  );
  const scaled = numeric / 1024 ** exponent;
  return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)} ${BYTE_UNITS[exponent]}`;
}

export function formatCores(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toFixed(numeric >= 100 ? 0 : numeric >= 10 ? 1 : 2)} cores`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '—';
  }
  const value = Math.max(0, Math.round(seconds));
  if (value < 60) return `${value}s`;
  if (value < 3600) {
    const minutes = Math.floor(value / 60);
    const rest = value % 60;
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  }
  if (value < 86_400) {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(value / 86_400);
  const hours = Math.floor((value % 86_400) / 3600);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'unknown';
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function relativeFromNow(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 0) return formatDateTime(value);
  return formatAge(seconds);
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function truncateMiddle(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function evidenceLabel(value: string | null | undefined): string {
  const normalised = (value ?? 'unavailable').toLowerCase();
  if (normalised === 'observed') return 'OBSERVED';
  if (normalised === 'reported') return 'REPORTED';
  if (normalised === 'estimated') return 'ESTIMATED';
  if (normalised === 'stale') return 'STALE';
  if (normalised === 'pending') return 'PENDING';
  return 'UNAVAILABLE';
}

export function evidenceClass(value: string | null | undefined): string {
  return `badge badge-${evidenceLabel(value).toLowerCase()}`;
}

export function healthClass(value: string | null | undefined): string {
  const state = (value ?? 'unknown').toLowerCase();
  if (['healthy', 'up', 'fresh', 'success'].includes(state)) {
    return 'badge badge-healthy';
  }
  if (['degraded', 'delayed', 'pending', 'warning'].includes(state)) {
    return 'badge badge-degraded';
  }
  if (['down', 'failed', 'stale', 'critical', 'major', 'error'].includes(state)) {
    return 'badge badge-down';
  }
  return 'badge badge-unknown';
}

export function availabilityFrom(
  item: {
    availability?: { value: number | null };
    availability1d?: number | null;
    availability7d?: number | null;
    availability30d?: number | null;
  },
  window: string,
): number | null {
  if (window === '7d') return item.availability7d ?? null;
  if (window === '30d') return item.availability30d ?? null;
  if (window === '24h' || window === '1d') {
    return item.availability1d ?? item.availability?.value ?? null;
  }
  return item.availability?.value ?? null;
}

export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}
