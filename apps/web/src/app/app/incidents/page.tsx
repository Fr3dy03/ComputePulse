import Link from 'next/link';
import { AlertOctagon, Clock3, Filter, Network, ShieldAlert } from 'lucide-react';
import { apiGet, type IncidentSummary, type NetworkSummary, type Overview } from '@/lib/api';
import { formatAge, formatDateTime, formatNumber } from '@/lib/format';
import {
  DataNote,
  PageHead,
  SeverityBadge,
  StatCard,
  StatusBadge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const status = single(query.status);
  const severity = single(query.severity);
  const networkId = single(query.networkId);
  const providerId = single(query.providerId);
  const search = single(query.search);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (severity) params.set('severity', severity);
  if (networkId) params.set('networkId', networkId);
  if (providerId) params.set('providerId', providerId);
  if (search) params.set('search', search);

  const [incidentsResponse, overviewResponse, networksResponse] = await Promise.all([
    apiGet<{ data: IncidentSummary[] }>(`/api/v1/incidents?${params.toString()}`),
    apiGet<Overview>('/api/v1/overview'),
    apiGet<{ data: NetworkSummary[] }>('/api/v1/networks'),
  ]);
  const incidents = incidentsResponse.data?.data ?? [];
  const overview = overviewResponse.data;
  const networks = networksResponse.data?.data ?? [];

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Incidents</strong></>}
        title="Incidents"
        description="Correlated incidents and operator-authored records. Each carries a source, event timeline, remediation digest and optional on-chain commitment status."
        meta={
          <>
            <span><AlertOctagon size={11} /> {overview?.incidents.active ?? 0} active</span>
            <span><ShieldAlert size={11} /> {overview?.incidents.critical ?? 0} critical</span>
            <span><Clock3 size={11} /> onset is detection time unless source supplied it</span>
          </>
        }
      />

      {incidentsResponse.error ? <div className="error-banner">{incidentsResponse.error}</div> : null}

      <div className="grid grid-4 mb-24">
        <StatCard label="Active" value={overview?.incidents.active ?? '—'} sub="open, acknowledged, investigating or mitigated" icon="alert" accent={overview?.incidents.active ? 'red' : 'green'} />
        <StatCard label="Critical" value={overview?.incidents.critical ?? '—'} sub="active critical severity" icon="alert" accent={overview?.incidents.critical ? 'red' : 'green'} />
        <StatCard label="Total recorded" value={overview?.incidents.total ?? '—'} sub="correlated + operator-authored" icon="database" />
        <StatCard label="Filtered view" value={formatNumber(incidents.length)} sub={status ? `status: ${status}` : 'all statuses'} icon="help" />
      </div>

      <div className="panel mb-24">
        <form method="get" className="filter-bar" style={{ borderBottom: 0 }}>
          <label className="field wide">
            <span>Search title, summary, provider</span>
            <input name="search" defaultValue={search ?? ''} placeholder="provider or incident text" />
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={status ?? ''}>
              <option value="">All statuses</option>
              {['open', 'acknowledged', 'investigating', 'mitigated', 'resolved', 'closed'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Severity</span>
            <select name="severity" defaultValue={severity ?? ''}>
              <option value="">All severities</option>
              {['critical', 'major', 'minor', 'warning', 'info'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Network</span>
            <select name="networkId" defaultValue={networkId ?? ''}>
              <option value="">All networks</option>
              {networks.map((network) => (
                <option key={network.id} value={network.id}>{network.name}</option>
              ))}
            </select>
          </label>
          {providerId ? <input type="hidden" name="providerId" value={providerId} /> : null}
          <button className="btn btn-sm btn-primary" type="submit"><Filter size={12} /> Apply</button>
          <Link href="/app/incidents" className="btn btn-sm btn-ghost">Reset</Link>
        </form>
        {providerId ? <div className="tiny muted" style={{ padding: '0 16px 14px' }}>Filtered to provider <span className="mono">{providerId}</span>.</div> : null}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Incident ledger</h2>
          <span className="tiny muted">Newest first · lifecycle actions on detail</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Incident</th>
                <th>Network / provider</th>
                <th>Status</th>
                <th>Detected</th>
                <th>Source</th>
                <th>Anchor</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td><SeverityBadge severity={incident.severity} /></td>
                  <td style={{ maxWidth: 360 }}>
                    <Link href={`/app/incidents/${incident.id}`} className="cell-title">{incident.title}</Link>
                    <div className="cell-sub">{incident.summary?.slice(0, 140)}{incident.summary && incident.summary.length > 140 ? '…' : ''}</div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}><Network size={11} style={{ color: 'var(--secondary)' }} />{incident.network_name ?? 'Unscoped'}</div>
                    <div className="cell-sub mono">{incident.provider_external_id ? `${incident.provider_external_id.slice(0, 24)}…` : 'no provider'}</div>
                  </td>
                  <td><StatusBadge value={incident.status} /><div className="cell-sub">{incident.event_count ?? 1} event{incident.event_count === '1' ? '' : 's'}</div></td>
                  <td className="num">{formatAge((Date.now() - new Date(incident.detected_at).getTime()) / 1000)}<div className="cell-sub">{formatDateTime(incident.detected_at)}</div></td>
                  <td className="tiny"><span className="mono">{incident.source}</span>{incident.source_url ? <div className="cell-sub">source-linked</div> : null}</td>
                  <td className="tiny">{incident.anchor_status ?? 'not_anchored'}</td>
                </tr>
              ))}
              {!incidents.length ? (
                <tr><td colSpan={7}><div className="table-empty">No incidents match this filter. An empty incident list is not a guarantee of provider health.</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <DataNote>
        Correlated incidents are opened from observed source state. The exact outage onset is not
        inferred when the source does not provide it; <code>started_at</code> is the detection time.
        Operator-authored incidents are explicitly labelled and are not source observations.
      </DataNote>
    </>
  );
}
