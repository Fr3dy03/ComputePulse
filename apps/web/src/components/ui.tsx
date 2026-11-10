import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock3,
  Database,
  Gauge,
  Radio,
  Server,
  ShieldCheck,
  Signal,
  TriangleAlert,
} from 'lucide-react';
import {
  evidenceLabel,
  formatAge,
  formatPercent,
  healthClass,
  titleCase,
} from '@/lib/format';

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.25" stroke="#2B3945" />
      <path
        d="M4.5 18.2h4.1l2.2-6.9 3.5 12.1 3.1-16.1 3 10.9 2-4.8h4.1"
        stroke="#42B8C5"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25.2" cy="7" r="2" fill="#4E9B78" />
    </svg>
  );
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <a className="brand" href={href} aria-label="ComputePulse home">
      <BrandMark />
      <span className="brand-word">
        Compute<span>Pulse</span>
      </span>
    </a>
  );
}

export function EvidenceBadge({
  value,
  suffix,
}: {
  value: string | null | undefined;
  suffix?: string;
}) {
  const label = evidenceLabel(value);
  const descriptions: Record<string, string> = {
    OBSERVED: 'Measured directly by a ComputePulse worker.',
    REPORTED: 'Supplied by the upstream source; not independently verified.',
    ESTIMATED: 'Derived by ComputePulse with a documented method.',
    STALE: 'An older observation exists beyond its freshness policy.',
    UNAVAILABLE: 'The source does not expose this signal. No value is inferred.',
    PENDING: 'No collection has completed yet.',
  };
  return (
    <span className={`badge badge-${label.toLowerCase()}`} title={descriptions[label]}>
      <span className="badge-dot" />
      {label}
      {suffix ? ` · ${suffix}` : ''}
    </span>
  );
}

export function HealthBadge({
  value,
  evidence,
}: {
  value: string | null | undefined;
  evidence?: string | null;
}) {
  const state = (value ?? 'unknown').toLowerCase();
  const label = state === 'unknown' ? 'UNKNOWN' : state.toUpperCase();
  return (
    <span className={healthClass(state)} title={evidence ? `Evidence: ${evidence}` : undefined}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

export function FreshnessBadge({
  freshness,
  showMessage = false,
}: {
  freshness?: { state: string; ageSeconds: number | null; message?: string } | null;
  showMessage?: boolean;
}) {
  if (!freshness) {
    return <span className="badge badge-unavailable">NO OBSERVATION</span>;
  }
  const label =
    freshness.state === 'fresh'
      ? 'FRESH'
      : freshness.state === 'delayed'
        ? 'DELAYED'
        : freshness.state === 'stale'
          ? 'STALE'
          : freshness.state === 'pending'
            ? 'PENDING'
            : 'UNAVAILABLE';
  const className =
    freshness.state === 'fresh'
      ? 'badge badge-observed'
      : freshness.state === 'delayed'
        ? 'badge badge-estimated'
        : freshness.state === 'stale'
          ? 'badge badge-stale'
          : 'badge badge-unavailable';
  return (
    <span className={className} title={freshness.message}>
      <span className="badge-dot" />
      {label}
      {freshness.ageSeconds !== null ? ` · ${formatAge(freshness.ageSeconds)}` : ''}
      {showMessage && freshness.message ? ` — ${freshness.message}` : ''}
    </span>
  );
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const state = (value ?? 'unknown').toLowerCase();
  return (
    <span className={healthClass(state)}>
      <span className="status-dot" style={{ background: 'currentColor' }} />
      {titleCase(state)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: 'server' | 'signal' | 'alert' | 'clock' | 'database' | 'gauge' | 'shield' | 'help' | 'check' | 'radio';
  accent?: 'cyan' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const icons = {
    server: Server,
    signal: Signal,
    alert: TriangleAlert,
    clock: Clock3,
    database: Database,
    gauge: Gauge,
    shield: ShieldCheck,
    help: CircleHelp,
    check: CircleCheck,
    radio: Radio,
  };
  const Icon = icon ? icons[icon] : null;
  const colour =
    accent === 'green'
      ? 'var(--green)'
      : accent === 'amber'
        ? 'var(--amber)'
        : accent === 'red'
          ? 'var(--red)'
          : accent === 'blue'
            ? 'var(--blue)'
            : 'var(--cyan)';
  return (
    <div className="stat">
      <div className="stat-label">
        {Icon ? <Icon size={12} style={{ color: colour }} /> : null}
        {label}
      </div>
      <div className="stat-value" style={accent ? { color: colour } : undefined}>
        {value}
      </div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

export function PageHead({
  breadcrumb,
  title,
  description,
  actions,
  meta,
}: {
  breadcrumb?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          {breadcrumb ? <div className="breadcrumb">{breadcrumb}</div> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="btn-row">{actions}</div> : null}
      </div>
      {meta ? <div className="page-meta">{meta}</div> : null}
    </>
  );
}

export function SectionHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow ? <div className="eyebrow" style={{ marginBottom: 12 }}>{eyebrow}</div> : null}
        <h2>{title}</h2>
        {description ? <p style={{ marginTop: 12 }}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Callout({
  children,
  tone = 'info',
  icon,
}: {
  children: ReactNode;
  tone?: 'info' | 'warn' | 'danger';
  icon?: boolean;
}) {
  const Icon = tone === 'danger' ? CircleAlert : tone === 'warn' ? TriangleAlert : ShieldCheck;
  return (
    <div className={`callout ${tone === 'warn' ? 'warn' : tone === 'danger' ? 'danger' : ''}`}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
        {icon === false ? null : <Icon size={15} style={{ flexShrink: 0, marginTop: 2 }} />}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function MetricCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="metric-cell">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {detail ? <div className="detail">{detail}</div> : null}
    </div>
  );
}

export function SourceLine({
  source,
  observedAt,
  method,
}: {
  source?: string | null;
  observedAt?: string | null;
  method?: string | null;
}) {
  return (
    <div className="tiny muted" style={{ lineHeight: 1.55 }}>
      {source ? (
        <span>
          Source:{' '}
          {source.startsWith('http') ? (
            <a href={source} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
              {source.replace(/^https?:\/\//, '').slice(0, 46)}
              {source.length > 54 ? '…' : ''} <ArrowUpRight size={9} style={{ display: 'inline' }} />
            </a>
          ) : (
            source
          )}
        </span>
      ) : null}
      {observedAt ? <span> · Observed {formatAge((Date.now() - new Date(observedAt).getTime()) / 1000)}</span> : null}
      {method ? <span> · {method}</span> : null}
    </div>
  );
}

export function AvailabilityValue({
  value,
  window = '24h',
}: {
  value: number | null | undefined;
  window?: string;
}) {
  if (value === null || value === undefined) {
    return <span className="muted">—</span>;
  }
  const percent = value > 1.5 ? value : value * 100;
  const colour =
    percent >= 99 ? 'var(--green)' : percent >= 95 ? 'var(--amber)' : 'var(--red)';
  return (
    <span className="mono" style={{ color: colour, fontSize: 11.5 }} title={`${window} source-reported window`}>
      {formatPercent(value)} <span style={{ color: 'var(--secondary)' }}>{window}</span>
    </span>
  );
}

export function DataNote({ children }: { children: ReactNode }) {
  return (
    <div className="tiny muted" style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 10 }}>
      <CircleHelp size={12} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
    </div>
  );
}

export function EmptyPanel({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="icon-box" style={{ margin: '0 auto 4px' }}>
        <Database size={18} />
      </div>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? <div className="mt-16">{action}</div> : null}
    </div>
  );
}

export function NetworkDot({ colour }: { colour?: string | null }) {
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: 2,
        display: 'inline-block',
        background: colour ?? 'var(--cyan)',
        flexShrink: 0,
      }}
    />
  );
}

export function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  const value = (severity ?? 'info').toLowerCase();
  const cls =
    value === 'critical' || value === 'major'
      ? 'badge badge-down'
      : value === 'minor' || value === 'warning'
        ? 'badge badge-degraded'
        : 'badge badge-reported';
  return <span className={cls}>{value.toUpperCase()}</span>;
}

export function LiveLabel({ children = 'Live' }: { children?: ReactNode }) {
  return (
    <span className="mono-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className="status-dot live" /> {children}
    </span>
  );
}
