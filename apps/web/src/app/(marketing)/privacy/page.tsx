import Link from 'next/link';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Callout } from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const metadata = {
  title: 'Privacy — ComputePulse',
  description: 'How ComputePulse handles source data, operator data, credentials and retention.',
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="A short policy for an observability product."
        lede="ComputePulse collects public infrastructure data and a limited set of operator configuration records. It does not sell data, run advertising trackers, or publish credentials."
        meta={
          <>
            <span><ShieldCheck size={11} /> effective 10 November 2026</span>
            <span><LockKeyhole size={11} /> secrets encrypted at rest</span>
          </>
        }
      />

      <MarketingSection>
        <div className="prose" style={{ maxWidth: 850 }}>
          <h2>1. Scope</h2>
          <p>
            This policy describes the reference ComputePulse deployment. A production operator must
            replace this page with its own reviewed policy and identify its legal entity, contact
            address and jurisdiction. The reference deployment is a technical demonstration, not a
            hosted commercial service.
          </p>

          <h2>2. Data we collect</h2>
          <h3>Public infrastructure data</h3>
          <p>
            ComputePulse reads documented public APIs: the Akash Console provider index, the Flux
            daemon node list and block count, and BOT Chain / Bohr JSON-RPC endpoints. The collected
            fields include provider identifiers, operator addresses, host references, locations,
            reported capacity, uptime windows, chain height and RPC latency. These records are already
            public at the source. ComputePulse stores them with source and observation timestamps.
          </p>
          <h3>Operator configuration data</h3>
          <p>
            When you create a monitor, alert rule, integration, incident or setting, the deployment
            stores the configuration you submit: names, target URLs, request headers, expected status,
            thresholds, incident notes and an audit record of mutations. Monitor headers and webhook
            secrets are encrypted with AES-256-GCM before storage; the API returns only whether a
            secret exists.
          </p>
          <h3>Technical logs</h3>
          <p>
            The reference deployment records collection errors, HTTP status codes, monitor latency,
            request timing and audit entries. It does not run a third-party analytics script or an
            advertising pixel. The web application does not require a tracking cookie.
          </p>

          <h2>3. How we use data</h2>
          <ul>
            <li>To display provider, network, capacity and incident evidence.</li>
            <li>To evaluate alert rules and deliver configured notifications.</li>
            <li>To maintain history, coverage and freshness information.</li>
            <li>To audit operator actions and diagnose collection or delivery failures.</li>
            <li>To protect the service against abuse, SSRF attempts and unauthorised mutations.</li>
          </ul>
          <p>
            ComputePulse does not sell personal data, build advertising profiles, or use provider data
            to make trading, lending or employment decisions.
          </p>

          <h2>4. Legal basis and consent</h2>
          <p>
            Where data protection law applies, a production operator must identify its legal basis for
            processing. Public source records are processed to provide infrastructure observability.
            Operator configuration is processed to perform the requested service. The reference
            deployment does not ask for marketing consent because it does not send marketing.
          </p>

          <h2>5. Sharing</h2>
          <p>
            Data leaves the deployment only through integrations the operator configures: a signed
            webhook, an SMTP server, a Prometheus scraper, an OTLP collector or a public chain
            transaction when the optional incident registry is enabled. Those destinations are chosen
            by the operator and have their own privacy practices. ComputePulse does not include a
            hidden third-party data broker.
          </p>

          <h2>6. Retention</h2>
          <p>
            The default reference configuration retains observations for 30 days and monitor checks
            for 14 days. Retention is configurable in Settings and enforced by the maintenance task.
            Audit entries, incident records and settings persist until the operator removes them or the
            database is reset. Reducing retention deletes history permanently.
          </p>

          <h2>7. Security</h2>
          <p>
            Controls include encrypted credentials, SSRF validation for monitors and webhooks,
            rate-limiting, bearer-token protection for admin mutations when configured, audit logging
            and a no-redirect outbound fetch policy. No system is perfectly secure. Report a suspected
            vulnerability through the contact route and do not include live secrets.
          </p>

          <h2>8. Your choices</h2>
          <p>
            Depending on applicable law, you may request access, correction or deletion of operator
            configuration data. Because public infrastructure records are indexed from external
            sources, a correction request should identify the upstream record. The reference
            deployment may be reset without notice.
          </p>

          <h2>9. International processing</h2>
          <p>
            The reference deployment runs locally on the operator&apos;s machine. A production
            deployment may process data in the region where its API, database and integrations run.
            The operator is responsible for disclosing that region and any transfer mechanism.
          </p>

          <h2>10. Children</h2>
          <p>
            ComputePulse is an infrastructure operations product. It is not directed at children and
            does not knowingly collect personal data from them.
          </p>

          <h2>11. Changes</h2>
          <p>
            This policy may change as the product changes. The effective date at the top of the page
            will be updated. A production operator must publish its own notice and obtain any required
            consent.
          </p>

          <h2>12. Contact</h2>
          <p>
            Use the <Link href="/contact">contact page</Link>. If no contact address is configured,
            the deployment intentionally displays no fabricated address. Security reports should be
            sent through the operator&apos;s private channel.
          </p>
        </div>

        <Callout tone="warn">
          <strong>Reference template.</strong> This policy is product-specific but not legal advice.
          Replace it with a reviewed policy before operating a public or commercial deployment.
        </Callout>
      </MarketingSection>
    </>
  );
}
