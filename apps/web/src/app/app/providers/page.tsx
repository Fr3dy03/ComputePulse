import Link from 'next/link';
import { Clock3, Database, Radio, Server } from 'lucide-react';
import {
  apiGet,
  type NetworkSummary,
  type Overview,
  type ProviderListItem,
} from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { DataNote, PageHead, StatCard } from '@/components/ui';
import { ProvidersTable } from '@/components/ProvidersTable';

export const dynamic = 'force-dynamic';

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const networkId = single(query.networkId);
  const health = single(query.health);
  const evidence = single(query.evidence);
  const search = single(query.search);
  const availabilityWindow = single(query.availabilityWindow);
  const hasIncident = single(query.hasIncident) === 'true';

  const params = new URLSearchParams({
    pageSize: '25',
    page: '1',
    sort: 'name',
  });
  if (networkId) params.set('networkId', networkId);
  if (health) params.set('health', health);
  if (evidence) params.set('evidence', evidence);
  if (search) params.set('search', search);
  if (availabilityWindow) params.set('availabilityWindow', availabilityWindow);
  if (hasIncident) params.set('hasIncident', 'true');

  const [networksResponse, providersResponse, overviewResponse] = await Promise.all([
    apiGet<{ data: NetworkSummary[] }>('/api/v1/networks'),
    apiGet<{ data: ProviderListItem[]; meta: Record<string, unknown> }>(
      `/api/v1/providers?${params.toString()}`,
    ),
    apiGet<Overview>('/api/v1/overview'),
  ]);

  const networks = networksResponse.data?.data ?? [];
  const initial = providersResponse.data
    ? {
        data: providersResponse.data.data,
        meta: providersResponse.data.meta as {
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
          availabilityWindow: string;
        },
      }
    : null;
  const overview = overviewResponse.data;

  return (
    <>
      <PageHead
        breadcrumb={<>Operations / <strong>Providers</strong></>}
        title="Provider directory"
        description="Cross-network provider records with source-reported health, availability windows, capacity evidence, observation freshness and active incidents. Open a row for full provenance."
        actions={
          <Link href="/app/monitors/new" className="btn btn-primary btn-sm">
            Connect an endpoint
          </Link>
        }
        meta={
          <>
            <span><Server size={11} /> {formatNumber(overview?.providerCounts.total ?? (initial?.meta.total ?? 0))} indexed providers</span>
            <span><Clock3 size={11} /> Availability windows are source-reported</span>
            <span><Database size={11} /> Capacity is provider-reported or UNAVAILABLE</span>
            <span><Radio size={11} /> No implicit host probing</span>
          </>
        }
      />

      <div className="grid grid-4 mb-24">
        <StatCard label="Total records" value={formatNumber(overview?.providerCounts.total)} sub="Across Akash and Flux" icon="server" />
        <StatCard label="Reported healthy" value={formatNumber(overview?.providerCounts.healthy)} sub="Source-reported state" icon="check" accent="green" />
        <StatCard label="Reported offline" value={formatNumber(overview?.providerCounts.down)} sub="Not a ComputePulse probe result" icon="alert" accent="red" />
        <StatCard label="Capacity reporting" value={formatNumber(networks.reduce((total, network) => total + network.capacityProviders, 0))} sub="Providers with capacity evidence" icon="database" />
      </div>

      {providersResponse.error ? (
        <div className="error-banner">Provider records could not be loaded: {providersResponse.error}</div>
      ) : null}

      <ProvidersTable
        initial={initial}
        networks={networks}
        initialFilters={{
          networkId,
          health,
          evidence,
          search,
          availabilityWindow,
          hasIncident,
        }}
      />

      <DataNote>
        Health values are source claims. A provider marked DOWN by Akash is not necessarily
        unreachable from your network, and a provider marked HEALTHY has not been independently probed
        by ComputePulse. Use an explicit endpoint monitor when you need direct availability evidence.
        Flux does not expose provider liveness in its public list, so every Flux row is UNKNOWN.
      </DataNote>
    </>
  );
}
