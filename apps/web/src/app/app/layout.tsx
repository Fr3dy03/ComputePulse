import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { apiGet, type Overview } from '@/lib/api';
import { AppShell } from '@/components/app/AppShell';

export const metadata: Metadata = {
  title: {
    default: 'Operations',
    template: '%s · ComputePulse Operations',
  },
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { data } = await apiGet<Overview>('/api/v1/overview');
  return (
    <AppShell
      counts={{
        networks: data?.networks.length,
        providers: data?.providerCounts.total,
        monitors: data?.monitors.total,
        incidents: data?.incidents.active,
        failingMonitors: data?.monitors.down,
      }}
      apiOnline={Boolean(data)}
      generatedAt={data?.generatedAt ?? null}
    >
      {children}
    </AppShell>
  );
}
