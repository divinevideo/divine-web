// ABOUTME: DMCA and copyright policy page for Divine
// ABOUTME: Describes how Divine handles copyright infringement claims and takedown procedures

import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';
import { useTranslation } from 'react-i18next';

export function DMCAPage() {
  const { t } = useTranslation('dmca');

  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <ZendeskWidget />
        <h1 className="text-4xl font-extrabold mb-4">{t('title')}</h1>
        <p className="text-muted-foreground mb-8">{t('updated')}</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          {/* 1. Overview */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.overview')}</h2>
            <p className="mb-3">
              Verse Communications PBC dba Divine (&ldquo;Divine&rdquo;) respects intellectual property rights
              and complies with the Digital Millennium Copyright Act (&ldquo;DMCA&rdquo;). This policy describes
              how Divine responds to claims of copyright infringement involving Divine-controlled infrastructure.
            </p>
            <p>
              For purposes of the DMCA, Divine has designated{' '}
              <a href="mailto:contact@divine.video" className="text-primary hover:underline">
                contact@divine.video
              </a>{' '}
              as its agent for receiving notices of claimed infringement.
            </p>
          </section>

          {/* 2. Definitions */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.definitions')}</h2>
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
              linked, or otherwise made available by a user through the Divine&trade; app (the
              &ldquo;Service&rdquo;), whether hosted by Divine or externally.
            </p>
          </section>

          {/* 3. Submitting a Notice */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.notice')}</h2>
            <p className="mb-3">
              If you believe that content available through Divine-controlled infrastructure infringes your
              copyright, you may submit a notice to{' '}
              <a href="mailto:contact@divine.video" className="text-primary hover:underline">
                contact@divine.video
              </a>.
            </p>
            <p>
              A valid notice must include your contact information, identification of the copyrighted work,
              identification of the allegedly infringing material and its location, a statement of good faith
              belief that the use is not authorized, a statement under penalty of perjury that the information is
              accurate, and your signature.
            </p>
          </section>

          {/* 4. Response to Notices */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.response')}</h2>
            <p className="mb-3">
              Upon receipt of a facially valid notice, Divine may remove or disable access to the allegedly
              infringing material on Divine-controlled infrastructure and may take additional action, including
              restricting access for repeat infringers.
            </p>
            <p className="mb-3">
              Divine evaluates notices for facial validity but does not adjudicate the underlying legal merits of
              any claim.
            </p>
            <p>
              Where appropriate, Divine may make reasonable efforts to notify the user who posted the content and
              provide information about the claim and the process for submitting a counter-notification.
            </p>
          </section>

          {/* 5. Counter-Notifications */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.counter')}</h2>
            <p className="mb-3">
              Users may submit counter-notifications as permitted by law. A valid counter-notification must
              include identification of the removed material, a statement under penalty of perjury, consent to
              jurisdiction, and the user&rsquo;s contact information.
            </p>
            <p>
              Divine may forward counter-notifications to the original complainant. Where required by law, Divine
              may restore removed content if the complainant does not initiate legal action within the applicable
              time period.
            </p>
          </section>

          {/* 6. Repeat Infringers */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.repeat')}</h2>
            <p>
              Divine maintains a policy of addressing repeat infringement and may restrict or terminate access for
              users who repeatedly infringe intellectual property rights.
            </p>
          </section>

          {/* 7. Scope of Control */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.control')}</h2>
            <p>
              Divine can remove or disable access to content only on systems it owns or controls. If the
              underlying material is stored on independent relays, third-party hosts, or archives, requests to
              remove that material must be directed to the relevant operator.
            </p>
          </section>

          {/* 8. User Responsibility */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.responsibility')}</h2>
            <p>
              Users are responsible for ensuring that they have the rights, licenses, and permissions necessary to
              publish or reference content through the Service.
            </p>
          </section>

          {/* 9. Good Faith Requirement */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.goodFaith')}</h2>
            <p>
              Submitting false or misleading claims may result in liability under applicable law.
            </p>
          </section>

          {/* 10. User Controls */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.userControls')}</h2>
            <p>
              The Service may provide tools such as blocking, muting, filtering, and moderation lists that allow
              users to manage their experience. These controls apply within Divine-operated interfaces as
              implemented by Divine.
            </p>
          </section>

          {/* 11. Relationship to Terms */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.relation')}</h2>
            <p>
              This policy operates alongside the Terms of Service. Users retain ownership of their content but
              grant Divine a license to use that content as described in the Terms.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">{t('sections.contact')}</h2>
            <p>
              <a href="mailto:contact@divine.video" className="text-primary hover:underline">
                contact@divine.video
              </a>
            </p>
          </section>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default DMCAPage;
