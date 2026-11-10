import Link from 'next/link';
import { Brand } from '@/components/ui';
import { BotChainMark } from '@/components/BotChainFooter';

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { href: '/platform', label: 'Platform overview' },
      { href: '/provider-observability', label: 'Provider observability' },
      { href: '/cross-network-monitoring', label: 'Cross-network monitoring' },
      { href: '/app', label: 'Open operations app' },
    ],
  },
  {
    title: 'Coverage',
    links: [
      { href: '/compute-providers', label: 'Compute providers' },
      { href: '/network-operators', label: 'Network operators' },
      { href: '/integrations', label: 'Integrations' },
      { href: '/app/networks', label: 'Network directory' },
    ],
  },
  {
    title: 'Trust & reference',
    links: [
      { href: '/metric-methodology', label: 'Metric methodology' },
      { href: '/documentation', label: 'Documentation' },
      { href: '/faq', label: 'FAQ' },
      { href: '/app/reports', label: 'Operational reports' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand />
            <p>
              Cross-network provider observability with explicit evidence,
              freshness and provenance for every signal. Built for operators who
              need to know what is measured, reported or unavailable.
            </p>
            <div className="mt-16">
              <Link href="/contact" className="link-arrow">
                Contact the team
              </Link>
            </div>
          </div>
          {COLUMNS.map((column) => (
            <div className="footer-col" key={column.title}>
              <h4>{column.title}</h4>
              {column.links.map((link) => (
                <Link href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="bot-footer-app">
          <BotChainMark />
          <div className="row wrap" style={{ gap: 16 }}>
            <Link href="/privacy" className="tiny muted">
              Privacy
            </Link>
            <Link href="/terms" className="tiny muted">
              Terms
            </Link>
            <span className="tiny muted">© {new Date().getFullYear()} ComputePulse</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
