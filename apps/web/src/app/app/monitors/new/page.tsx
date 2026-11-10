import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { apiGet, type NetworkSummary } from '@/lib/api';
import { PageHead } from '@/components/ui';
import { MonitorForm } from '@/components/MonitorForm';

export const dynamic = 'force-dynamic';

export default async function NewMonitorPage() {
  const { data } = await apiGet<{ data: NetworkSummary[] }>('/api/v1/networks');
  return (
    <>
      <PageHead
        breadcrumb={<><Link href="/app/monitors">Monitors</Link> / <strong>New</strong></>}
        title="Connect a provider endpoint"
        description="Create an explicit, SSRF-validated endpoint monitor. This is the only path by which ComputePulse probes a provider host reference."
        meta={
          <>
            <span><ShieldCheck size={11} /> Private addresses rejected</span>
            <span><ShieldCheck size={11} /> No redirects followed</span>
            <span><ShieldCheck size={11} /> Credentials encrypted at rest</span>
          </>
        }
      />
      <div className="grid split-2-1" style={{ alignItems: 'start' }}>
        <MonitorForm networks={data?.data ?? []} />
        <div className="stack">
          <div className="panel panel-pad">
            <h3>Security boundary</h3>
            <p className="tiny mt-8">
              Monitor targets are validated before every request: scheme, DNS resolution, public
              address class, port allowlist and redirects. This prevents the monitor worker from
              becoming an SSRF bridge into private infrastructure.
            </p>
            <div className="mono-label mt-12">Allowed by default</div>
            <div className="row wrap mt-8" style={{ gap: 6 }}>
              {['443', '80', '3000', '8000', '8080', '8443', '16127'].map((port) => (
                <span className="badge" key={port}>{port}</span>
              ))}
            </div>
            <p className="tiny mt-12">
              Private, loopback, link-local, multicast and metadata addresses are rejected. DNS is
              revalidated after resolution to prevent rebinding.
            </p>
          </div>
          <div className="panel panel-pad">
            <h3>What is measured</h3>
            <ul className="tiny muted mt-8" style={{ paddingLeft: 16 }}>
              <li>HTTP status code returned at the timestamp</li>
              <li>End-to-end request latency in milliseconds</li>
              <li>Attempt count and timeout/error text</li>
              <li>Expected body marker presence</li>
              <li>Observed availability from stored checks</li>
            </ul>
            <p className="tiny mt-12">
              A monitor does not validate workload execution, GPU health or chain finality.
            </p>
          </div>
          <div className="panel panel-pad">
            <h3>Need a provider adapter?</h3>
            <p className="tiny mt-8">
              Source adapters are server-side modules with documented rate limits and evidence
              contracts. They are not created from the browser. See the adapter documentation for the
              contribution model.
            </p>
            <Link href="/documentation" className="link-arrow mt-8">Provider adapter guide</Link>
          </div>
        </div>
      </div>
    </>
  );
}
