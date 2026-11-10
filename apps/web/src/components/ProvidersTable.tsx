'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FilterX,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  apiGet,
  type Capacity,
  type NetworkSummary,
  type ProviderDetail,
  type ProviderListItem,
} from '@/lib/api';
import {
  formatAge,
  formatBytes,
  formatCores,
  formatNumber,
  formatPercent,
  healthClass,
} from '@/lib/format';
import {
  AvailabilityValue,
  DataNote,
  EvidenceBadge,
  FreshnessBadge,
  HealthBadge,
  NetworkDot,
} from '@/components/ui';

export interface ProvidersResponse {
  data: ProviderListItem[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    availabilityWindow: string;
  };
}

const HEALTH_OPTIONS = ['all', 'healthy', 'degraded', 'down', 'unknown'];
const EVIDENCE_OPTIONS = ['all', 'observed', 'reported', 'estimated', 'unavailable'];

export function ProvidersTable({
  initial,
  networks,
  initialFilters,
  fixedNetworkId,
  compact = false,
}: {
  initial: ProvidersResponse | null;
  networks: NetworkSummary[];
  initialFilters?: {
    networkId?: string;
    health?: string;
    evidence?: string;
    search?: string;
    availabilityWindow?: string;
    hasIncident?: boolean;
  };
  fixedNetworkId?: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<ProvidersResponse | null>(initial);
  const [networkId, setNetworkId] = useState(fixedNetworkId ?? initialFilters?.networkId ?? 'all');
  const [health, setHealth] = useState(initialFilters?.health ?? 'all');
  const [evidence, setEvidence] = useState(initialFilters?.evidence ?? 'all');
  const [search, setSearch] = useState(initialFilters?.search ?? '');
  const [windowKey, setWindowKey] = useState(initialFilters?.availabilityWindow ?? '24h');
  const [hasIncident, setHasIncident] = useState(Boolean(initialFilters?.hasIncident));
  const [page, setPage] = useState(initial?.meta.page ?? 1);
  const [pageSize, setPageSize] = useState(initial?.meta.pageSize ?? (compact ? 10 : 25));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const first = useRef(true);
  const searchRef = useRef(search);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (networkId !== 'all') params.set('networkId', networkId);
    if (health !== 'all') params.set('health', health);
    if (evidence !== 'all') params.set('evidence', evidence);
    if (search.trim()) params.set('search', search.trim());
    if (hasIncident) params.set('hasIncident', 'true');
    params.set('availabilityWindow', windowKey);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sort', 'name');
    return params.toString();
  }, [networkId, health, evidence, search, hasIncident, windowKey, page, pageSize]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const response = await apiGet<ProvidersResponse>(`/api/v1/providers?${query}`);
      if (controller.signal.aborted) return;
      if (response.error) setError(response.error);
      else setData(response.data);
      setLoading(false);
    }, searchRef.current ? 300 : 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const reset = () => {
    setNetworkId(fixedNetworkId ?? 'all');
    setHealth('all');
    setEvidence('all');
    setSearch('');
    setHasIncident(false);
    setWindowKey('24h');
    setPage(1);
  };

  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <div className="panel">
        <div className="table-toolbar">
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="mono-label">
              {loading ? 'Updating…' : `${formatNumber(meta?.total ?? 0)} provider records`}
            </span>
            {fixedNetworkId ? null : (
              <span className="badge">
                <NetworkDot colour="#42B8C5" /> cross-network
              </span>
            )}
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <span className="sr-only">Availability window</span>
              <SlidersHorizontal size={12} style={{ color: 'var(--secondary)' }} />
              <select
                value={windowKey}
                onChange={(event) => {
                  setWindowKey(event.target.value);
                  setPage(1);
                }}
                style={{ width: 92, padding: '5px 7px', fontSize: 11 }}
              >
                <option value="24h">24h window</option>
                <option value="7d">7d window</option>
                <option value="30d">30d window</option>
              </select>
            </label>
            <span className="tiny muted">Source-reported windows · not probes</span>
          </div>
        </div>

        <div className="filter-bar">
          <label className="field wide">
            <span>Search provider, operator or host</span>
            <span style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--secondary)' }} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="akash1…, provider name, region"
                style={{ paddingLeft: 27 }}
              />
            </span>
          </label>
          {fixedNetworkId ? null : (
            <label className="field">
              <span>Network</span>
              <select
                value={networkId}
                onChange={(event) => {
                  setNetworkId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All networks</option>
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Health state</span>
            <select
              value={health}
              onChange={(event) => {
                setHealth(event.target.value);
                setPage(1);
              }}
            >
              {HEALTH_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item === 'all' ? 'All health states' : item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Evidence class</span>
            <select
              value={evidence}
              onChange={(event) => {
                setEvidence(event.target.value);
                setPage(1);
              }}
            >
              {EVIDENCE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item === 'all' ? 'All evidence classes' : item.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`btn btn-sm ${hasIncident ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => {
              setHasIncident((value) => !value);
              setPage(1);
            }}
          >
            Active incident
          </button>
          <button className="btn btn-sm btn-ghost" type="button" onClick={reset}>
            <FilterX size={12} /> Reset
          </button>
        </div>

        {error ? <div className="error-banner" style={{ margin: 16 }}>{error}</div> : null}

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Network</th>
                <th>Health</th>
                <th>Latency</th>
                <th>Availability window</th>
                <th>Capacity information</th>
                <th>Observation freshness</th>
                <th>Active incident</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  windowKey={windowKey}
                  onOpenEvidence={() => setDrawerId(provider.id)}
                />
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9}>
                    <div className="table-empty">
                      {loading
                        ? 'Loading provider records…'
                        : 'No provider records match these filters. Missing observations are not substituted with placeholder rows.'}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="table-toolbar" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
          <div className="row wrap" style={{ gap: 10 }}>
            <span className="tiny muted">
              Page {meta?.page ?? 1} of {formatNumber(meta?.totalPages ?? 1)} ·{' '}
              {formatNumber(meta?.pageSize ?? pageSize)} rows per page
            </span>
            <label className="row tiny muted" style={{ gap: 6 }}>
              Show
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', fontSize: 11 }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn" type="button" onClick={() => setPage(1)} disabled={!meta || meta.page <= 1} aria-label="First page">
              <ChevronsLeft size={13} />
            </button>
            <button className="icon-btn" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={!meta || meta.page <= 1} aria-label="Previous page">
              <ChevronLeft size={13} />
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={() => setPage((value) => Math.min(meta?.totalPages ?? value, value + 1))}
              disabled={!meta || meta.page >= meta.totalPages}
              aria-label="Next page"
            >
              <ChevronRight size={13} />
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={() => setPage(meta?.totalPages ?? 1)}
              disabled={!meta || meta.page >= meta.totalPages}
              aria-label="Last page"
            >
              <ChevronsRight size={13} />
            </button>
          </div>
        </div>
      </div>
      <DataNote>
        Latency is the most recent source-index fetch latency, not a per-provider endpoint probe.
        Availability values are windows reported by the upstream source. Capacity is provider-reported
        where exposed and explicitly UNAVAILABLE where the source does not publish it.
      </DataNote>
      {drawerId ? <ProvenanceDrawer providerId={drawerId} onClose={() => setDrawerId(null)} /> : null}
    </>
  );
}

function ProviderRow({
  provider,
  windowKey,
  onOpenEvidence,
}: {
  provider: ProviderListItem;
  windowKey: string;
  onOpenEvidence: () => void;
}) {
  const availability =
    windowKey === '7d'
      ? provider.availability7d
      : windowKey === '30d'
        ? provider.availability30d
        : provider.availability1d ?? provider.availability.value;
  const displayName = provider.name || provider.hostReference || provider.externalId;
  return (
    <tr>
      <td style={{ maxWidth: 260 }}>
        <Link href={`/app/providers/${provider.id}`} className="cell-title">
          {displayName.replace(/^https?:\/\//, '')}
        </Link>
        <div className="cell-sub mono" title={provider.externalId}>
          {provider.externalId.length > 34 ? `${provider.externalId.slice(0, 16)}…${provider.externalId.slice(-8)}` : provider.externalId}
        </div>
      </td>
      <td>
        <div className="row" style={{ gap: 7 }}>
          <NetworkDot colour={provider.brandColor} />
          <span style={{ fontSize: 12 }}>{provider.networkName}</span>
        </div>
        <div className="cell-sub">{provider.region || provider.country || 'Location unavailable'}</div>
      </td>
      <td>
        <HealthBadge value={provider.healthState} evidence={provider.healthSignal} />
        <div className="cell-sub" style={{ maxWidth: 170 }}>
          {provider.healthReason || provider.healthSignal}
        </div>
      </td>
      <td>
        <span className="mono" style={{ fontSize: 11.5 }}>
          {provider.sourceLatencyMs !== null ? `${formatNumber(provider.sourceLatencyMs)} ms` : '—'}
        </span>
        <div className="cell-sub">source fetch</div>
      </td>
      <td>
        <AvailabilityValue value={availability} window={windowKey} />
        <div className="cell-sub">{provider.availability.method ?? 'No method exposed'}</div>
      </td>
      <td style={{ maxWidth: 220 }}>
        <CapacityCell provider={provider} />
      </td>
      <td>
        <FreshnessBadge freshness={provider.freshness} />
        <div className="cell-sub">
          {provider.statusObservedAt ? formatAge((Date.now() - new Date(provider.statusObservedAt).getTime()) / 1000) : 'No observation'}
        </div>
      </td>
      <td>
        {provider.activeIncidents > 0 ? (
          <Link
            href={`/app/incidents?providerId=${provider.id}`}
            className="badge badge-down"
            title="Open correlated incidents"
          >
            {provider.activeIncidents} active
          </Link>
        ) : (
          <span className="tiny muted">—</span>
        )}
      </td>
      <td>
        <button className="btn btn-sm btn-ghost" type="button" onClick={onOpenEvidence} title="Open provenance">
          Evidence
        </button>
      </td>
    </tr>
  );
}

function CapacityCell({ provider }: { provider: ProviderListItem }) {
  const capacity = provider.capacity;
  if (!capacity && provider.capacityEvidence !== 'reported') {
    return (
      <>
        <span className="badge badge-unavailable">UNAVAILABLE</span>
        <div className="cell-sub" style={{ maxWidth: 200 }}>
          Source does not expose capacity.
        </div>
      </>
    );
  }
  if (!capacity) {
    return <span className="muted tiny">No snapshot</span>;
  }
  return (
    <>
      <div className="mono" style={{ fontSize: 11 }}>
        {capacity.cpuAvailableCores !== null && capacity.cpuAvailableCores !== undefined
          ? `${formatNumber(capacity.cpuAvailableCores)} / ${formatNumber(capacity.cpuTotalCores)} cores avail`
          : 'CPU not reported'}
      </div>
      <div className="cell-sub">
        {capacity.memoryAvailableBytes
          ? `${formatBytes(capacity.memoryAvailableBytes)} / ${formatBytes(capacity.memoryTotalBytes)} mem`
          : 'Memory not reported'}
        {capacity.gpuTotal ? ` · ${capacity.gpuAvailable ?? '—'}/${capacity.gpuTotal} GPU` : ''}
      </div>
      <div className="cell-sub">
        <EvidenceBadge value={provider.capacityEvidence} />{' '}
        <span style={{ fontSize: 9.5 }}>provider-reported</span>
      </div>
    </>
  );
}

function ProvenanceDrawer({ providerId, onClose }: { providerId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<ProviderDetail>(`/api/v1/providers/${providerId}`).then((response) => {
      if (!active) return;
      if (response.error) setError(response.error);
      else setDetail(response.data);
    });
    return () => {
      active = false;
    };
  }, [providerId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Provider provenance">
        <div className="drawer-head">
          <div>
            <div className="mono-label">Provenance</div>
            <h3 style={{ marginTop: 4 }}>{detail?.name || detail?.externalId || 'Provider evidence'}</h3>
            {detail ? (
              <div className="tiny muted">
                {detail.network.name} · {detail.externalId.slice(0, 28)}…
              </div>
            ) : null}
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close provenance">
            <X size={14} />
          </button>
        </div>
        <div className="drawer-body">
          {error ? <div className="error-banner">{error}</div> : null}
          {!detail && !error ? <p className="tiny muted">Loading source provenance…</p> : null}
          {detail ? <ProvenanceContent detail={detail} /> : null}
        </div>
      </aside>
    </div>
  );
}

function ProvenanceContent({ detail }: { detail: ProviderDetail }) {
  const provenance = detail.provenance as Record<string, unknown>;
  return (
    <>
      <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
        <HealthBadge value={detail.healthState} evidence={detail.healthSignal} />
        <FreshnessBadge freshness={detail.freshness} />
        <EvidenceBadge value={detail.availability.evidence} />
      </div>
      <h4>Source</h4>
      <dl className="kv">
        <dt>Network</dt><dd>{detail.network.name}</dd>
        <dt>Source adapter</dt><dd className="mono">{detail.source.adapterVersion}</dd>
        <dt>Endpoint</dt>
        <dd>
          <a href={detail.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
            {detail.sourceUrl.replace(/^https?:\/\//, '')}
          </a>
        </dd>
        <dt>Rate limit</dt><dd>{detail.source.adapterRateLimit}</dd>
        <dt>Collection</dt><dd style={{ textAlign: 'left' }}>{String(provenance.collectionMethod ?? 'Scheduled server-side collection.')}</dd>
        <dt>Source observed</dt><dd>{detail.statusObservedAt ?? '—'}</dd>
        <dt>Collected</dt><dd>{String(provenance.collectedAt ?? '—')}</dd>
        <dt>Measurement window</dt><dd style={{ textAlign: 'left' }}>{String(provenance.measurementWindow ?? 'Point-in-time record.')}</dd>
        <dt>Adapter state</dt><dd>{detail.source.state}</dd>
        <dt>Source latency</dt><dd>{detail.source.latencyMs !== null ? `${detail.source.latencyMs} ms` : '—'}</dd>
      </dl>

      <h4>Availability evidence</h4>
      <dl className="kv">
        <dt>1 day</dt><dd>{detail.availability.day1 !== null ? formatPercent(detail.availability.day1) : '—'}</dd>
        <dt>7 days</dt><dd>{detail.availability.day7 !== null ? formatPercent(detail.availability.day7) : '—'}</dd>
        <dt>30 days</dt><dd>{detail.availability.day30 !== null ? formatPercent(detail.availability.day30) : '—'}</dd>
        <dt>Method</dt><dd className="mono">{detail.availability.method ?? 'unavailable'}</dd>
      </dl>
      <div className="callout" style={{ marginTop: 10 }}>{detail.availability.note}</div>

      <h4>Capacity evidence</h4>
      {detail.capacity ? (
        <dl className="kv">
          <dt>Evidence</dt><dd><EvidenceBadge value={detail.capacityEvidence} /></dd>
          <dt>CPU total</dt><dd>{formatCores(detail.capacity.cpuTotalCores)}</dd>
          <dt>CPU available</dt><dd>{formatCores(detail.capacity.cpuAvailableCores)}</dd>
          <dt>Memory total</dt><dd>{formatBytes(detail.capacity.memoryTotalBytes)}</dd>
          <dt>Memory available</dt><dd>{formatBytes(detail.capacity.memoryAvailableBytes)}</dd>
          <dt>Storage available</dt><dd>{formatBytes(detail.capacity.storageAvailableBytes)}</dd>
          <dt>GPU</dt><dd>{detail.capacity.gpuAvailable ?? '—'} / {detail.capacity.gpuTotal ?? '—'}</dd>
        </dl>
      ) : (
        <div className="callout warn">
          Capacity is <strong>UNAVAILABLE</strong>. The source does not expose capacity for this
          network. ComputePulse does not estimate it.
        </div>
      )}

      <h4>Latest observations</h4>
      <div className="stack-sm">
        {detail.observations.map((observation) => (
          <div key={`${observation.metric_key}-${observation.observed_at}`} className="row-between" style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 6 }}>
            <div>
              <div style={{ fontSize: 11.5 }}>{observation.name ?? observation.metric_key}</div>
              <div className="cell-sub mono">{observation.metric_key}</div>
            </div>
            <div className="text-right">
              <div className="mono" style={{ fontSize: 11.5 }}>
                {formatNumber(observation.value, { maximumFractionDigits: 4 })} {observation.unit}
              </div>
              <EvidenceBadge value={observation.evidence_type ?? observation.status} />
            </div>
          </div>
        ))}
      </div>

      <h4>Provider identity</h4>
      <dl className="kv">
        <dt>External ID</dt><dd className="mono" style={{ textAlign: 'left', fontSize: 10 }}>{detail.externalId}</dd>
        <dt>Operator</dt><dd className="mono" style={{ textAlign: 'left', fontSize: 10 }}>{detail.operatorAddress ?? '—'}</dd>
        <dt>Host reference</dt><dd className="mono" style={{ textAlign: 'left', fontSize: 10 }}>{detail.hostReference ?? '—'}</dd>
        <dt>Health signal</dt><dd>{detail.healthSignal}</dd>
      </dl>
      <p className="tiny muted" style={{ marginTop: 10 }}>{detail.hostNote}</p>
    </>
  );
}
