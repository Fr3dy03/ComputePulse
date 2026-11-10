'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Brand } from '@/components/ui';

const NAV = [
  { href: '/platform', label: 'Platform' },
  { href: '/compute-providers', label: 'Providers' },
  { href: '/cross-network-monitoring', label: 'Networks' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/metric-methodology', label: 'Methodology' },
  { href: '/documentation', label: 'Docs' },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container">
        <Brand />
        <nav className="main-nav" aria-label="Primary navigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'active' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link href="/app" className="btn btn-ghost btn-sm">
            View Network Status
          </Link>
          <Link href="/app/monitors/new" className="btn btn-primary btn-sm">
            Connect a Provider
          </Link>
          <button
            className="icon-btn mobile-nav-button"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={open}
            id="mobile-nav-toggle"
          >
            {open ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="container" style={{ paddingBottom: 14, display: 'grid', gap: 4 }}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{ padding: '6px 0', color: 'var(--secondary)' }}>
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
