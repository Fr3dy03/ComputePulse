import Link from 'next/link';
import { ScrollText, ShieldCheck } from 'lucide-react';
import { Callout } from '@/components/ui';
import { MarketingSection, PageHero } from '@/components/marketing/PageHero';

export const metadata = {
  title: 'Terms — ComputePulse',
  description: 'Terms for the ComputePulse reference observability deployment.',
};

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Terms"
        title="What this software promises — and what it does not."
        lede="ComputePulse is an evidence-first observability tool. It reports what a source said and what it measured. It does not guarantee provider reliability, workload execution or an SLA."
        meta={
          <>
            <span><ScrollText size={11} /> effective 10 November 2026</span>
            <span><ShieldCheck size={11} /> no token or financial product</span>
          </>
        }
      />

      <MarketingSection>
        <div className="prose" style={{ maxWidth: 850 }}>
          <h2>1. Acceptance</h2>
          <p>
            By using this deployment, you agree to these terms. If you do not agree, do not use the
            service. A production operator must replace these reference terms with its own reviewed
            terms and identify the contracting entity.
          </p>

          <h2>2. What ComputePulse is</h2>
          <p>
            ComputePulse is off-chain observability software. It reads documented public provider and
            chain APIs, stores observations with provenance, runs operator-configured endpoint checks,
            evaluates alert rules, keeps an incident lifecycle and can optionally commit incident
            hashes to a role-controlled smart contract.
          </p>
          <p>
            It is not a compute marketplace, a block explorer, a custody service, a token issuer, a
            staking product, an escrow service or a financial adviser.
          </p>

          <h2>3. Evidence and no warranty of accuracy</h2>
          <p>
            Source data may be incomplete, delayed, inaccurate or unavailable. A provider&apos;s
            reported uptime is a claim, not an independently verified SLA. Report capacity is not a
            guarantee of schedulable capacity. A successful RPC response does not prove finality. A
            green status does not prove that a workload will run.
          </p>
          <p>
            The software is provided &quot;as is&quot; and &quot;as available&quot; without warranties
            of merchantability, fitness for a particular purpose, non-infringement or uninterrupted
            operation, to the maximum extent permitted by law.
          </p>

          <h2>4. No service-level agreement</h2>
          <p>
            The reference deployment has no SLA, uptime commitment, support window or recovery-time
            objective. Operators who need an SLA must negotiate one separately. Freshness labels and
            coverage percentages describe the data, not a service guarantee.
          </p>

          <h2>5. Acceptable use</h2>
          <ul>
            <li>Do not monitor endpoints you do not own or lack written authorisation to test.</li>
            <li>Do not use the service to scan, overload or probe public provider hosts in bulk.</li>
            <li>Do not attempt to bypass SSRF validation, rate limits or admin authentication.</li>
            <li>Do not upload malware, credentials you are not entitled to use, or unlawful content.</li>
            <li>Do not present source-reported values as independently verified facts.</li>
            <li>Do not use the service to create a token, financial product or misleading benchmark.</li>
          </ul>

          <h2>6. Monitoring authorisation</h2>
          <p>
            You are responsible for having permission to monitor every endpoint you add. ComputePulse
            applies technical SSRF protections, but technical controls do not create legal
            authorisation. The operator bears responsibility for its targets, request rates and any
            terms imposed by the target or its upstream source.
          </p>

          <h2>7. Third-party sources and integrations</h2>
          <p>
            Akash, Flux, BOT Chain, Bohr and any configured webhook, SMTP, Prometheus or OTLP
            destination are third-party services. Their availability, terms and data practices are
            outside ComputePulse&apos;s control. A source may change its API, rate-limit requests or
            stop exposing a field. ComputePulse records the failure; it does not promise a workaround.
          </p>

          <h2>8. Credentials and operator responsibilities</h2>
          <p>
            You are responsible for the security of your deployment, admin token, encryption key,
            database backups and integration secrets. Do not commit private keys or production
            credentials. The reference development encryption key must be replaced before any
            production use.
          </p>

          <h2>9. On-chain commitments</h2>
          <p>
            The optional incident registry stores hashes, addresses, statuses and timestamps. A
            transaction, once confirmed, cannot be edited or deleted by ComputePulse. You are
            responsible for the accuracy of what you anchor and for complying with the law in your
            jurisdiction. No token, slashing, penalty, escrow or financial return is provided.
          </p>

          <h2>10. Intellectual property</h2>
          <p>
            The ComputePulse name, interface and original source code are provided for evaluation and
            deployment under the terms of the repository. Third-party trademarks, logos and source data
            remain the property of their owners. The BOT Chain mark is used for attribution only and
            does not imply endorsement.
          </p>

          <h2>11. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, the authors and operators of the reference
            deployment are not liable for indirect, incidental, special, consequential or punitive
            damages, loss of profits, loss of data, business interruption, or decisions made in
            reliance on a displayed metric. Where liability cannot be excluded, it is limited to the
            amount you paid to use the reference deployment, which is zero.
          </p>

          <h2>12. Indemnity</h2>
          <p>
            You agree to indemnify the operator against claims arising from your monitoring targets,
            your configuration, your anchored content or your breach of these terms, to the extent
            permitted by law.
          </p>

          <h2>13. Termination and changes</h2>
          <p>
            The reference deployment may be stopped, reset or changed at any time without notice.
            These terms may be updated; the effective date will change. Continued use after an update
            constitutes acceptance of the revised terms.
          </p>

          <h2>14. Governing law</h2>
          <p>
            A production operator must specify its governing law and dispute forum. The reference
            deployment does not claim a jurisdiction. Nothing in these terms excludes rights that
            cannot be excluded under applicable law.
          </p>

          <h2>15. Contact</h2>
          <p>
            Questions about these terms can be raised through the <Link href="/contact">contact page</Link>.
          </p>
        </div>

        <Callout tone="warn">
          <strong>Reference template.</strong> These terms are product-specific but not legal advice.
          Have counsel review them before operating a public or commercial deployment.
        </Callout>
      </MarketingSection>
    </>
  );
}
