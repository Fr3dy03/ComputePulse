'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiGet, type History } from '@/lib/api';
import { formatNumber } from '@/lib/format';

const WINDOWS = ['1h', '24h', '7d', '30d'] as const;
type WindowKey = (typeof WINDOWS)[number] | 'custom';

interface MetricOption {
  key: string;
  label: string;
  unit: string;
}

export function HistoryChart({
  scope,
  id,
  metricKeys,
  initialMetric,
  initialHistory,
  title = 'Observed history',
}: {
  scope: 'providers' | 'networks';
  id: string;
  metricKeys: MetricOption[];
  initialMetric?: string;
  initialHistory?: History | null;
  title?: string;
}) {
  const defaultMetric = initialMetric ?? metricKeys[0]?.key ?? '';
  const [metric, setMetric] = useState(defaultMetric);
  const [windowKey, setWindowKey] = useState<WindowKey>('24h');
  const [history, setHistory] = useState<History | null>(initialHistory ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async (
    nextMetric: string,
    nextWindow: WindowKey,
    customFrom?: string,
    customTo?: string,
  ) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ metricKey: nextMetric, window: nextWindow });
    if (nextWindow === 'custom') {
      if (customFrom) params.set('from', new Date(customFrom).toISOString());
      if (customTo) params.set('to', new Date(customTo).toISOString());
    }
    const response = await apiGet<History>(
      `/api/v1/${scope}/${encodeURIComponent(id)}/history?${params.toString()}`,
    );
    if (response.error) {
      setError(response.error);
    } else {
      setHistory(response.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!initialHistory || metric !== defaultMetric || windowKey !== '24h') {
      void load(metric, windowKey);
    }
    // Only re-run when the operator changes the control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, windowKey]);

  const coverage = history?.coverage;
  const selectedMetric = metricKeys.find((option) => option.key === metric);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <div className="tiny muted" style={{ marginTop: 3 }}>
            {selectedMetric?.label ?? metric} · bucket{' '}
            {history ? `${history.window.bucketSeconds}s` : '—'}
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="window-tabs" role="group" aria-label="History window">
            {WINDOWS.map((item) => (
              <button
                key={item}
                type="button"
                className={windowKey === item ? 'active' : undefined}
                onClick={() => setWindowKey(item)}
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              className={windowKey === 'custom' ? 'active' : undefined}
              onClick={() => setWindowKey('custom')}
              style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
            >
              custom
            </button>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={() => void load(metric, windowKey, from, to)}
            aria-label="Refresh history"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : undefined} />
          </button>
        </div>
      </div>
      <div style={{ padding: '14px 16px 18px' }}>
        <div className="row wrap" style={{ gap: 10, marginBottom: 14 }}>
          <label className="field" style={{ minWidth: 220, flex: 1 }}>
            <span className="sr-only">Metric</span>
            <select value={metric} onChange={(event) => setMetric(event.target.value)}>
              {metricKeys.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {windowKey === 'custom' ? (
            <>
              <label className="field" style={{ minWidth: 180 }}>
                <span className="sr-only">From</span>
                <input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="field" style={{ minWidth: 180 }}>
                <span className="sr-only">To</span>
                <input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
              <button
                className="btn btn-sm"
                type="button"
                onClick={() => void load(metric, 'custom', from, to)}
                disabled={!from || !to}
              >
                Apply window
              </button>
            </>
          ) : null}
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {history ? (
          <>
            <Chart history={history} metric={selectedMetric} />
            <div className="row-between wrap" style={{ marginTop: 12, gap: 10 }}>
              <div className="legend">
                <span><i style={{ background: 'var(--cyan)' }} /> observed bucket</span>
                <span><i style={{ background: 'rgba(212,90,85,.55)' }} /> missing window</span>
                <span><i style={{ background: 'var(--border)' }} /> no sample</span>
              </div>
              <div className="tiny muted">
                Coverage {coverage ? `${coverage.observedBuckets}/${coverage.expectedBuckets} buckets` : '—'}
                {coverage && coverage.missingBuckets > 0
                  ? ` · ${coverage.missingBuckets} missing`
                  : ''}
              </div>
            </div>
            {coverage?.missingBuckets ? (
              <div className="callout warn" style={{ marginTop: 12 }}>
                <strong>Coverage gap.</strong> {coverage.missingBuckets} expected bucket
                {coverage.missingBuckets === 1 ? '' : 's'} contain no observation. Gaps are
                shown as gaps; they are never filled with zero or interpolated.
              </div>
            ) : null}
            <div className="tiny muted" style={{ marginTop: 10 }}>
              {history.window.from} → {history.window.to} · {history.window.seconds}s window ·
              method: source collection buckets
            </div>
          </>
        ) : (
          <div className="chart-empty">
            {loading ? 'Loading observations…' : 'No history returned for this selection.'}
          </div>
        )}
      </div>
    </section>
  );
}

function Chart({ history, metric }: { history: History; metric?: MetricOption }) {
  const points = history.points;
  const width = 900;
  const height = 230;
  const padding = { left: 52, right: 16, top: 18, bottom: 28 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  const unit = points[0]?.unit ?? metric?.unit ?? '';

  const { min, max } = useMemo(() => {
    if (!values.length) return { min: 0, max: 1 };
    let low = Math.min(...values);
    let high = Math.max(...values);
    if (low === high) {
      const delta = Math.abs(low) * 0.1 || 1;
      low -= delta;
      high += delta;
    }
    const pad = (high - low) * 0.12;
    return { min: low - pad, max: high + pad };
  }, [values]);

  if (!points.length) {
    return <div className="chart-empty">No observations inside this time window.</div>;
  }

  const start = new Date(history.window.from).getTime();
  const end = new Date(history.window.to).getTime();
  const x = (at: string) => {
    if (end <= start) return padding.left + plotW / 2;
    return padding.left + ((new Date(at).getTime() - start) / (end - start)) * plotW;
  };
  const y = (value: number) => padding.top + (1 - (value - min) / (max - min)) * plotH;

  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      return;
    }
    const command = `${current.length === 0 ? 'M' : 'L'}${x(point.at).toFixed(1)},${y(point.value).toFixed(1)}`;
    current.push(command);
  });
  if (current.length > 1) segments.push(current.join(' '));

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => min + (max - min) * ratio);
  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => start + (end - start) * ratio);

  return (
    <svg className="chart-box" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Metric history chart">
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(tick)}
            y2={y(tick)}
            className="chart-grid"
          />
          <text x={padding.left - 8} y={y(tick) + 3} textAnchor="end" className="chart-label">
            {formatNumber(tick, { maximumFractionDigits: 3, compact: Math.abs(tick) > 10_000 })}
          </text>
        </g>
      ))}
      {timeTicks.map((tick) => (
        <text
          key={tick}
          x={padding.left + ((tick - start) / Math.max(1, end - start)) * plotW}
          y={height - 8}
          textAnchor="middle"
          className="chart-label"
        >
          {new Date(tick).toISOString().slice(history.window.seconds > 172_800 ? 5 : 11, history.window.seconds > 172_800 ? 10 : 16)}
        </text>
      ))}
      {segments.map((segment, index) => (
        <path key={index} d={segment} className="chart-line" />
      ))}
      {points.map((point, index) => {
        if (point.value === null) return null;
        const previousMissing = index > 0 && points[index - 1]?.value === null;
        return (
          <circle
            key={point.at}
            cx={x(point.at)}
            cy={y(point.value)}
            r={previousMissing ? 3.5 : 2.2}
            fill={previousMissing ? 'var(--amber)' : 'var(--cyan)'}
          >
            <title>
              {point.at}: {formatNumber(point.value, { maximumFractionDigits: 4 })} {point.unit}
              {' · '}{point.samples} sample{point.samples === 1 ? '' : 's'}
              {' · '}{point.evidence ?? 'unknown evidence'}
            </title>
          </circle>
        );
      })}
      <text x={width - padding.right} y={padding.top - 6} textAnchor="end" className="chart-label">
        {unit || 'value'}
      </text>
    </svg>
  );
}
