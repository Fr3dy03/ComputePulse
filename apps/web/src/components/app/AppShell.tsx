'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  Activity,
  AlertOctagon,
  ArrowUpRight,
  BellRing,
  BookOpen,
  Boxes,
  ChartNoAxesCombined,
  ChevronRight,
  Cpu,
  FileText,
  Gauge,
  LayoutDashboard,
  Menu,
  Network,
  Plug,
  Server,
  Settings,
  X,
} from 'lucide-react';
import { Brand } from '@/components/ui';
import { BotChainMark } from '@/components/BotChainFooter';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  count?: number | null;
  exact?: boolean;
};

export interface AppCounts {
  networks?: number;
  providers?: number;
  monitors?: number;
  incidents?: number;
  failingMonitors?: number;
}

export function AppShell({
  children,
  counts,
  apiOnline,
  generatedAt,
}: {
  children: ReactNode;
  counts: AppCounts;
  apiOnline: boolean;
  generatedAt: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const groups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: 'Observe',
      items: [
        { href: '/app', label: 'Overview', icon: LayoutDashboard, exact: true },
        { href: '/app/networks', label: 'Networks', icon: Network, count: counts.networks },
        { href: '/app/providers', label: 'Providers', icon: Server, count: counts.providers },
        { href: '/app/monitors', label: 'Monitors', icon: Activity, count: counts.monitors },
      ],
    },
    {
      label: 'Respond',
      items: [
        { href: '/app/incidents', label: 'Incidents', icon: AlertOctagon, count: counts.incidents },
        { href: '/app/alert-rules', label: 'Alert rules', icon: BellRing },
      ],
    },
    {
      label: 'Analyse',
      items: [
        { href: '/app/capacity', label: 'Capacity', icon: Cpu },
        { href: '/app/benchmarks', label: 'Benchmarks', icon: ChartNoAxesCombined },
        { href: '/app/reports', label: 'Reports', icon: FileText },
      ],
    },
    {
      label: 'Configure',
      items: [
        { href: '/app/integrations', label: 'Integrations', icon: Plug },
        { href: '/app/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const current =
    groups
      .flatMap((group) => group.items)
      .filter((item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href)))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null;

  const detailLabel = pathname.startsWith('/app/') && pathname !== current?.href
    ? pathname.split('/').filter(Boolean).slice(-1)[0]
    : null;

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${open ? 'open' : ''}`} aria-label="Application navigation">
        <div className="row-between">
          <Brand href="/app" />
          <button
            className="icon-btn app-close"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={15} />
          </button>
        </div>
        <div className="sidebar-org">
          <span className="avatar">CP</span>
          <div>
            <div className="name">ComputePulse Ops</div>
            <div className="plan">operator · local reference</div>
          </div>
        </div>
        <nav>
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? 'active' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon className="nav-icon" size={14} />
                    <span>{item.label}</span>
                    {item.count !== undefined && item.count !== null ? (
                      <span className="count">{item.count}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Link href="/documentation">
            <BookOpen size={13} /> Documentation
            <ArrowUpRight size={10} style={{ marginLeft: 'auto' }} />
          </Link>
          <Link href="/">
            <Boxes size={13} /> Marketing site
            <ArrowUpRight size={10} style={{ marginLeft: 'auto' }} />
          </Link>
          <div className="tiny muted" style={{ padding: '8px 10px 0' }}>
            {apiOnline ? 'API connected' : 'API unavailable'} · UTC
          </div>
        </div>
      </aside>
      {open ? <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}

      <div className="app-main">
        <div className="app-topbar">
          <div className="row" style={{ gap: 10 }}>
            <button
              className="icon-btn mobile-menu-btn"
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={15} />
            </button>
            <div className="crumbs">
              <Link href="/app">Operations</Link>
              {current ? (
                <>
                  <ChevronRight size={11} />
                  <strong>{current.label}</strong>
                </>
              ) : null}
              {detailLabel ? (
                <>
                  <ChevronRight size={11} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                    {decodeURIComponent(detailLabel)}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div className="topbar-status">
            <span className="item">
              <span className={`status-dot ${apiOnline ? 'live' : 'down'}`} />
              {apiOnline ? 'API ONLINE' : 'API OFFLINE'}
            </span>
            <span className="item">
              <Gauge size={11} /> {counts.failingMonitors ?? 0} FAILING MONITORS
            </span>
            <span className="item">
              {generatedAt ? `SNAPSHOT ${new Date(generatedAt).toISOString().slice(11, 16)}Z` : 'NO SNAPSHOT'}
            </span>
          </div>
        </div>
        <div className="app-content">
          {children}
          <BotChainMark compact />
        </div>
      </div>
    </div>
  );
}
