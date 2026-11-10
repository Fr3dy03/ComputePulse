import type { ReactNode } from 'react';

export function PageHero({
  eyebrow,
  title,
  lede,
  actions,
  meta,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <section className="section" style={{ paddingTop: 72, paddingBottom: 40 }}>
      <div className="container">
        <div className="eyebrow">{eyebrow}</div>
        <h1 style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4rem)', maxWidth: 900, marginTop: 18 }}>
          {title}
        </h1>
        <p className="lede" style={{ maxWidth: 760, marginTop: 20 }}>{lede}</p>
        {actions ? <div className="hero-actions">{actions}</div> : null}
        {meta ? <div className="hero-meta">{meta}</div> : null}
      </div>
    </section>
  );
}

export function MarketingSection({
  children,
  tone,
  id,
}: {
  children: ReactNode;
  tone?: 'panel';
  id?: string;
}) {
  return (
    <section
      className="section"
      id={id}
      style={tone === 'panel' ? { background: 'rgba(25, 35, 45, 0.45)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' } : undefined}
    >
      <div className="container">{children}</div>
    </section>
  );
}
