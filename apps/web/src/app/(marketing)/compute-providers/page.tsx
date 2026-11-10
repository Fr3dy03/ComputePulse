import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Filter,
  Globe2,
  Server,
  ShieldCheck,
  Signal,
} from 'lucide-react';
import {
  apiGet,
  type NetworkSummary,
  type Overview,
  type ProviderListItem,
} from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { Callout, DataNote, StatCard } from '@/components/ui';
import { ProvidersTable } from '@/components/ProvidersTable';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const dynamic = 'force-dynamic';

export default async function ComputeProvidersPage() {
  const [networksResponse, providersResponse, overviewResponse] = await Promise.all([
    apiGet<{ data: NetworkSummary[] }>('/api/v1/networks'),
    apiGet<{ data: ProviderListItem[]; meta: Record<string, unknown> }>(
      '/api/v1/providers?pageSize=25&page=1&sort=name',
    ),
    apiGet<Overview>('/api/v1/overview'),
  ]);

  const networks = networksResponse.data?.data ?? [];
  const overview = overviewResponse.data;
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

  const akash = networks.find((network) => network.id === 'akash-mainnet');
  const flux = networks.find((network) => network.id === 'flux-mainnet');

  return (
    <>
      <PageHero
        eyebrow="Compute providers"
        title="Find a provider without trusting a green dot."
        lede="Search the live cross-network provider directory, filter by health, evidence or availability window, and open any row to inspect its source record. Capacity is shown only where a provider actually reports it."
        actions={
          <>
            <Link href="/app/providers" className="btn btn-primary">Open full directory <ArrowRight size={14} /></Link>
            <Link href="/app/monitors/new" className="btn">Connect a Provider</Link>
          </>
        }
        meta={
          <>
            <span><Server size={11} /> {formatNumber(overview?.providerCounts.total ?? initial?.meta.total ?? 0)} indexed providers</span>
            <span><Database size={11} /> reported capacity only</span>
            <span><ShieldCheck size={11} /> no implicit endpoint probing</span>
          </>
        }
      />

      <MarketingSection>
        <div className="grid grid-4">
          <StatCard
            label="Akash providers"
            value={akash ? formatNumber(akash.providerCount) : '—'}
            sub={akash ? `${formatNumber(akash.healthCounts.healthy ?? 0)} source-reported healthy` : 'source unavailable'}
            icon="server"
          />
          <StatCard
            label="Flux nodes"
            value={flux ? formatNumber(flux.providerCount) : '—'}
            sub="Liveness and capacity not exposed"
            icon="radio"
            accent="blue"
          />
          <StatCard
            label="Capacity reporting"
            value={formatNumber(networks.reduce((total, network) => total + network.capacityProviders, 0))}
            sub="Provider-reported fields"
            icon="database"
          />
          <StatCard
            label="Active incidents"
            value={overview?.incidents.active ?? '—'}
            sub="Correlated from source state"
            icon="alert"
            accent={overview && overview.incidents.active > 0 ? 'red' : 'green'}
          />
        </div>

        <div className="grid grid-3 mt-24">
          {[
            {
              icon: <Globe2 size={16} />,
              title: 'Akash Network',
              body: 'A compute marketplace. The Console API exposes provider online state, 1d/7d/30d uptime windows and reported CPU, memory, storage and GPU capacity.',
            },
            {
              icon: <Cpu size={16} />,
              title: 'Flux Network',
              body: 'A compute network with a public FluxNode list. The list exposes node identity and last confirmed height, but no liveness flag and no capacity fields.',
            },
            {
              icon: <Signal size={16} />,
              title: 'BOT Chain / Bohr',
              body: 'Settlement and commitment networks. They expose chain and RPC signals, not compute providers. ComputePulse shows their chain metrics instead of an empty provider table.',
            },
          ].map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="icon-box">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection tone="panel">
        <div className="section-head">
          <div>
            <div className="eyebrow">Live directory</div>
            <h2 style={{ marginTop: 12 }}>Filter the actual provider index.</h2>
            <p style={{ marginTop: 12, maxWidth: 700 }}>
              Health, evidence, availability window, search and incident filters query the API. The
              table keeps the signature columns: provider, network, health, latency, availability
              window, capacity, freshness and active incident. Open a row for provenance.
            </p>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <Filter size={13} style={{ color: 'var(--secondary)' }} />
            <span className="mono-label">live api</span>
          </div>
        </div>

        {providersResponse.error ? (
          <div className="error-banner mb-16">
            The provider index could not be loaded: {providersResponse.error}. No sample rows are
            substituted.
          </div>
        ) : null}

        <ProvidersTable initial={initial} networks={networks} />

        <DataNote>
          Provider health is a source claim. A row marked DOWN by Akash has not been probed from your
          network, and a row marked HEALTHY has not been independently verified. Flux rows are always
          UNKNOWN because the public list has no liveness field. Use an explicit monitor for direct
          endpoint evidence.
        </DataNote>
      </MarketingSection>

      <MarketingSection>
        <div className="grid split-2-1" style={{ alignItems: 'start' }}>
          <div>
            <div className="eyebrow">Column definitions</div>
            <h2 style={{ marginTop: 12 }}>Reading the table correctly.</h2>
            <div className="stack-sm mt-24">
              {[
                ['Latency', 'The source API request duration that produced the row. It is not a provider ping. Endpoint latency only exists for monitors you create.'],
                ['Availability window', 'Akash reports a 24h, 7d and 30d uptime window. The table defaults to 24h and can switch windows. Missing values stay blank.'],
                ['Capacity information', 'Reported CPU/memory/storage/GPU fields. Totals are inventory claims, not a schedulability guarantee. Flux is UNAVAILABLE.'],
                ['Observation freshness', 'The record age against the adapter stale threshold. Fresh, delayed, stale and unavailable are distinct states.'],
                ['Active incident', 'Open linked incidents. A dash means no linked incident was returned, not that the provider is incident-free everywhere.'],
              ].map(([title, body]) => (
                <div className="feature" key={title}>
                  <div className="feature-num">·</div>
                  <div>
                    <h3>{title}</h3>
                    <p style={{ marginTop: 7 }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="stack">
            <div className="panel panel-pad">
              <div className="row-between">
                <h3>What you can do here</h3>
                <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
              </div>
              <ul className="tiny muted" style={{ paddingLeft: 16, lineHeight: 1.9, marginBottom: 0 }}>
                <li>Search by provider name, external ID or operator address.</li>
                <li>Filter by network, health state or evidence type.</li>
                <li>Switch availability windows without losing the sample context.</li>
                <li>Open the provenance drawer before acting on a value.</li>
                <li>Jump to an explicit monitor when direct evidence is required.</li>
              </ul>
            </div>
            <Callout tone="warn">
              <strong>No bulk endpoint scanning.</strong> Flux node IPs appear as references only.
              ComputePulse does not mass-probe public provider hosts. Monitoring is opt-in and must be
              authorised by the operator.
            </Callout>
            <div className="panel panel-pad">
              <div className="mono-label mb-8">Need a direct measurement?</div>
              <p className="tiny muted">
                Create an HTTP or JSON-RPC monitor for an endpoint you operate. SSRF validation,
                timeout, retry and response assertions are built in.
              </p>
              <Link href="/app/monitors/new" className="btn btn-sm btn-primary mt-12">
                Configure a monitor
              </Link>
            </div>
          </div>
        </div>
      </MarketingSection>

      <section className="cta-band">
        <div className="container">
          <div className="eyebrow">Provider operations</div>
          <h2 style={{ margin: '16px 0 18px' }}>Know what is reported, measured and missing.</h2>
          <p style={{ maxWidth: 620, marginBottom: 26 }}>
            Open the directory, inspect provenance, or start with the network view. Nothing here is
            backfilled when a source goes quiet.
          </p>
          <div className="btn-row">
            <Link href="/app/providers" className="btn btn-primary">Browse providers <ArrowRight size={14} /></Link>
            <Link href="/provider-observability" className="btn">How rows explain themselves</Link>
          </div>
        </div>
      </section>
    </>
  );
}
