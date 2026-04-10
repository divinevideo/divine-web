// ABOUTME: Safety Standards page for Divine
// ABOUTME: Documents content policies, enforcement practices, and user safety tools

import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';
import { useTranslation } from 'react-i18next';

export function SafetyPage() {
  const { t } = useTranslation('safety');

  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <ZendeskWidget />
        <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
        <p className="text-muted-foreground mb-8">{t('updated')}</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          {/* 1. Overview */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Overview</h2>
            <p className="mb-3">
              These Safety Standards describe the rules and enforcement practices that apply to use of the
              Divine&trade; app (the &ldquo;Service&rdquo;). The Service is provided by Verse Communications PBC
              dba Divine (&ldquo;Divine&rdquo;). These standards are incorporated into and form part of the Terms
              of Service.
            </p>
            <p>
              Divine enforces these standards within Divine-controlled infrastructure. Because the Service
              operates on decentralized systems, enforcement actions may not affect content or activity outside
              Divine-operated interfaces.
            </p>
          </section>

          {/* 2. Definitions */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Definitions</h2>
            <p className="mb-3">
              <strong className="text-foreground">&ldquo;Divine-controlled infrastructure&rdquo;</strong> means
              websites, apps, relays, media storage, APIs, and other systems owned or controlled by Divine.
            </p>
            <p className="mb-3">
              <strong className="text-foreground">&ldquo;Externally hosted content&rdquo;</strong> means any
              video, image, audio file, or other media referenced within a Nostr event that is stored on
              third-party infrastructure.
            </p>
            <p className="mb-3">
              <strong className="text-foreground">&ldquo;Nostr&rdquo;</strong> means the decentralized protocol
              known as &ldquo;Notes and Other Stuff Transmitted by Relays,&rdquo; which enables users to publish,
              retrieve, and verify content using cryptographic keypairs and signed messages.
            </p>
            <p className="mb-3">
              <strong className="text-foreground">&ldquo;Nostr event&rdquo;</strong> means a cryptographically
              signed data object published using the Nostr protocol. A Nostr event may include a public key,
              timestamp, event kind, content, tags, metadata, and a digital signature. Once broadcast, Nostr
              events may be stored or replicated across multiple independent relays, including relays Divine does
              not own or control.
            </p>
            <p className="mb-3">
              <strong className="text-foreground">&ldquo;Nostr keypair&rdquo;</strong> means the cryptographic
              public/private keypair used to create, sign, and authenticate Nostr events. The public key functions
              as a user identifier across the Nostr protocol, and the private key is required to sign events and
              prove authorship.
            </p>
            <p className="mb-3">
              <strong className="text-foreground">&ldquo;Relay&rdquo;</strong> means any independently operated
              server implementing the Nostr protocol for receiving, storing, indexing, or redistributing Nostr
              events. Unless expressly stated otherwise, relays are not operated by Divine.
            </p>
            <p>
              <strong className="text-foreground">&ldquo;User content&rdquo;</strong> means any Nostr event,
              media, metadata, username, profile information, or other material submitted, published, uploaded,
              linked, or otherwise made available by a user through the Service, whether hosted by Divine or
              externally.
            </p>
          </section>

          {/* 3. Prohibited Content and Conduct */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              3. Prohibited Content and Conduct
            </h2>
            <p className="mb-3">
              Users may not use the Service to create, publish, distribute, or facilitate content or activity
              that is unlawful, harmful, violates applicable law, or violates the Terms of Service.
            </p>
            <p className="mb-3">
              This includes, without limitation, content involving child sexual abuse or exploitation, harassment
              or abuse, credible threats of violence, non-consensual intimate imagery, doxxing or disclosure of
              private information, scams or fraud, malware, impersonation, or deceptive conduct.
            </p>
            <p>
              Users may not use synthetic, manipulated, or AI-generated media in a manner that deceives,
              impersonates, exploits, or materially misleads others.
            </p>
          </section>

          {/* 4. Child Safety */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Child Safety</h2>
            <p>
              Divine maintains a zero-tolerance policy for child sexual abuse material and related exploitation.
              Divine may remove such content from Divine-controlled infrastructure, restrict access, preserve
              evidence, and report to appropriate authorities where required or appropriate.
            </p>
          </section>

          {/* 5. Mature Content */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Mature Content</h2>
            <p>
              Certain mature content may be restricted, hidden by default, or made available only to users who
              meet applicable age requirements. Users are responsible for complying with all age restrictions.
            </p>
          </section>

          {/* 6. Platform Integrity and Abuse */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              6. Platform Integrity and Abuse
            </h2>
            <p>
              Users may not interfere with the operation or integrity of the Service, including by circumventing
              safeguards, engaging in coordinated manipulation, or using automation or bulk activity in ways that
              degrade the Service or harm users.
            </p>
          </section>

          {/* 7. Enforcement */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Enforcement</h2>
            <p className="mb-3">
              Divine may take action in response to violations of these Safety Standards, including removing or
              limiting content within Divine-controlled infrastructure, restricting or suspending access, disabling
              features, or taking other actions reasonably necessary to protect users and the Service. Actions may
              include limiting visibility or access to content within Divine-controlled interfaces without removing
              the underlying content from decentralized networks.
            </p>
            <p className="mb-3">
              In cases involving imminent harm, credible threats, or illegal activity, Divine may take immediate
              action, including removal of content and referral to appropriate authorities.
            </p>
            <p>
              Divine may also cooperate with law enforcement or other authorities where required or appropriate.
            </p>
          </section>

          {/* 8. Moderation Methods */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">8. Moderation Methods</h2>
            <p>
              Divine may use automated tools, third-party systems, human review, and other methods to identify
              and address violations. These systems are not perfect, and Divine does not guarantee that all
              violations will be detected or prevented. Divine has no general obligation to monitor all content or
              proactively detect all violations.
            </p>
          </section>

          {/* 9. Reporting */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">9. Reporting</h2>
            <p>
              Users may report content or accounts through tools made available in the Service. Divine aims to
              review reports of objectionable content promptly and generally within 24 hours, although response
              times may vary based on volume, severity, and available information.
            </p>
          </section>

          {/* 10. User Controls */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">10. User Controls</h2>
            <p>
              The Service may provide tools such as blocking, muting, filtering, and moderation lists that allow
              users to manage their experience. These controls apply within Divine-operated interfaces as
              implemented by Divine.
            </p>
          </section>

          {/* 11. Decentralization Limitation */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              11. Decentralization Limitation
            </h2>
            <p>
              Enforcement actions apply only within Divine-controlled infrastructure and do not extend to
              independent relays, clients, or third-party systems. Because the Service interacts with
              decentralized systems, content or accounts removed or restricted within Divine-controlled
              infrastructure may remain visible or accessible through other clients, relays, or third-party
              systems. Divine does not control how independent operators handle content.
            </p>
          </section>

          {/* 12. Automated Decision-Making */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              12. Automated Decision-Making
            </h2>
            <p>
              Divine does not engage in automated decision-making or profiling that produces legal or similarly
              significant effects on users within the meaning of applicable data protection law.
            </p>
          </section>

          {/* 13. Appeals */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">13. Appeals</h2>
            <p>
              Divine may, but is not obligated to, review requests to reconsider moderation decisions.
            </p>
          </section>

          {/* 14. Updates */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">14. Updates</h2>
            <p>
              These Safety Standards may be updated from time to time. When we do, we will post the updated
              version and revise the &ldquo;Last Updated&rdquo; date above. Unless a different effective date is
              stated, changes will become effective 30 days after posting. Your continued use of the Service after
              the effective date of the updated Safety Standards constitutes your acceptance of them.
            </p>
          </section>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default SafetyPage;
