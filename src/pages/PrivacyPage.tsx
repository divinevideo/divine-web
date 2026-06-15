// ABOUTME: Privacy Policy page for Divine
// ABOUTME: Explains data collection, use, disclosure, and user rights

import { useTranslation } from 'react-i18next';
import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';

export function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <ZendeskWidget />
        <h1 className="text-4xl font-extrabold mb-4">{t('privacyPage.title')}</h1>
        <p className="text-muted-foreground mb-8">{t('privacyPage.lastUpdated', { date: 'March 30, 2026' })}</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          {/* 1. Overview */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">1. Overview</h2>
            <p className="mb-3">
              This Privacy Policy explains how Verse Communications PBC dba Divine (&ldquo;Divine,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and discloses
              information in connection with the Divine&trade; app (the &ldquo;Service&rdquo;).
            </p>
            <p className="mb-3">
              Divine operates as an interface to the decentralized Nostr protocol. As a result, information you
              publish through the Service may be distributed across independent relays and systems that Divine
              does not own or control. This Privacy Policy applies only to information processed through
              Divine-controlled infrastructure.
            </p>
            <p>
              For purposes of applicable data protection law, Verse Communications PBC acts as the data
              controller for information processed through Divine-controlled infrastructure, except where
              otherwise specified.
            </p>
          </section>

          {/* 2. Definitions */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">2. Definitions</h2>
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

          {/* 3. Non-Custodial and Custodial Use */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">
              3. Non-Custodial and Custodial Use
            </h2>
            <p className="mb-3">
              Divine primarily operates as a non-custodial interface for interacting with Nostr events.
            </p>
            <p className="mb-3">
              If you use a self-custodied Nostr keypair, Divine does not store your private key and does not
              maintain a traditional account on your behalf. Your interactions with the Service are associated
              with your public key and the Nostr events you publish or retrieve.
            </p>
            <p>
              Divine may offer optional features, such as Divine Login, that involve server-side encryption,
              storage, backup, recovery, or management of signing material. If you use those features, Divine may
              process and store encrypted key material and related account data necessary to authenticate you and
              carry out actions you authorize. Additional disclosures or terms may apply to those features.
            </p>
          </section>

          {/* 4. Information We Collect */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">4. Information We Collect</h2>
            <p className="mb-3">
              Divine may collect and process information in several categories. The categories of personal
              information collected may include identifiers (such as public keys or IP addresses), internet or
              network activity information, and user-generated content.
            </p>
            <p className="mb-3">
              We collect information you provide directly, including Nostr events, profile metadata,
              communications with Divine, and reports submitted through the Service.
            </p>
            <p className="mb-3">
              We collect information automatically when you use the Service, including device and browser
              information, IP address, approximate location derived from network signals, and logs relating to
              interactions with Divine-controlled infrastructure.
            </p>
            <p className="mb-3">
              We may also collect and generate information for safety and moderation purposes, including reports,
              enforcement actions, and identifiers or hashes used to detect abuse, fraud, or prohibited content.
            </p>
            <p>
              Providing certain information may be necessary to use specific features of the Service. If you
              choose not to provide such information, some features may not function as intended.
            </p>
          </section>

          {/* 5. Public, Divine-Controlled, and Third-Party Data */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">
              5. Public, Divine-Controlled, and Third-Party Data
            </h2>
            <p className="mb-3">
              Because the Service operates on Nostr, it is important to distinguish between different categories
              of data.
            </p>
            <p className="mb-3">
              Nostr events are generally public and may be stored, replicated, indexed, or displayed by
              independent relays and clients. Once published, such data may remain available outside
              Divine-controlled infrastructure.
            </p>
            <p className="mb-3">
              Divine-controlled data includes information processed or stored on systems owned or operated by
              Divine, such as logs, moderation records, and account-related data associated with optional features
              like Divine Login.
            </p>
            <p>
              The Service may also display or link to externally hosted content stored on third-party servers,
              relays, archives, or storage providers. Divine does not own or control those systems and is not
              responsible for their handling of data.
            </p>
          </section>

          {/* 6. How We Use Information */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">6. How We Use Information</h2>
            <p className="mb-3">
              Divine processes information as reasonably necessary to operate, secure, maintain, and improve the
              Service.
            </p>
            <p className="mb-3">
              This includes rendering and transmitting Nostr events, authenticating users, caching or indexing
              content, enforcing Safety Standards, detecting and preventing abuse or illegal activity, responding
              to user inquiries, and complying with applicable law.
            </p>
            <p>
              Divine may also use information to maintain the reliability, performance, and security of the
              Service, including through logging, monitoring, and troubleshooting activities.
            </p>
          </section>

          {/* 7. Legal Bases for Processing */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">
              7. Legal Bases for Processing
            </h2>
            <p className="mb-3">
              Where applicable under data protection law, Divine processes personal data on the following legal
              bases:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-3">
              <li>
                To operate and provide the Service, including rendering and transmitting Nostr events: legitimate
                interests
              </li>
              <li>
                To authenticate users and enable account-related functionality, including Divine Login: contractual
                necessity and legitimate interests
              </li>
              <li>
                To enforce Safety Standards, prevent abuse, and maintain security: legitimate interests and legal
                obligations
              </li>
              <li>
                To comply with applicable law, including responding to lawful requests: legal obligations
              </li>
              <li>
                Where required, based on user consent: consent
              </li>
            </ul>
            <p>
              Where Divine relies on legitimate interests, it does so after considering the potential impact on
              users and their rights.
            </p>
          </section>

          {/* 8. Disclosure of Information */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">8. Disclosure of Information</h2>
            <p className="mb-3">
              Divine may disclose information to service providers that process data on our behalf and under our
              instructions to support the operation of Divine-controlled infrastructure, to comply with legal
              obligations or lawful requests, to protect the rights, safety, and integrity of the Service and its
              users, or as otherwise permitted by law.
            </p>
            <p>
              Because the Service interacts with decentralized systems, information contained in Nostr events may
              be accessible to independent relays, clients, and third-party systems outside Divine&rsquo;s
              control.
            </p>
          </section>

          {/* 9. International Data Transfers */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">
              9. International Data Transfers
            </h2>
            <p className="mb-3">
              Divine operates globally, and information may be processed in jurisdictions outside your country of
              residence, including the United States.
            </p>
            <p>
              Where required, Divine relies on appropriate safeguards for international data transfers, such as
              standard contractual clauses or other lawful mechanisms.
            </p>
          </section>

          {/* 10. Data Retention */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">10. Data Retention</h2>
            <p className="mb-3">
              Divine retains information for as long as reasonably necessary to operate the Service, comply with
              legal obligations, enforce its Terms and Safety Standards, and prevent abuse.
            </p>
            <p className="mb-3">
              Retention periods may vary depending on the nature of the data, including logs, moderation records,
              reports, and backup data. Some information may be retained for longer periods where required for
              legal, safety, or dispute-resolution purposes.
            </p>
            <p>
              Divine has no obligation to retain user content and may remove or cease storing or displaying
              content at its discretion, subject to applicable law.
            </p>
          </section>

          {/* 11. Your Rights */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">11. Your Rights</h2>
            <p className="mb-3">
              Depending on your jurisdiction, you may have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-3">
              <li>Access personal data held about you</li>
              <li>Request correction of inaccurate or incomplete data</li>
              <li>Request deletion of personal data</li>
              <li>Request restriction of processing</li>
              <li>Object to processing based on legitimate interests</li>
              <li>Request data portability</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mb-3">
              These rights may be limited in cases involving legal obligations, security considerations, or the
              decentralized nature of the Service.
            </p>
            <p className="mb-3">
              You also have the right to lodge a complaint with a supervisory authority in your jurisdiction if
              you believe your data has been processed in violation of applicable law.
            </p>
            <p>
              Requests may be submitted to{' '}
              <a href="mailto:contact@divine.video" className="text-primary hover:underline">
                contact@divine.video
              </a>.
            </p>
          </section>

          {/* 12. Automated Decision Making */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">12. Automated Decision Making</h2>
            <p>
              Divine does not engage in automated decision-making or profiling that produces legal or similarly
              significant effects on users within the meaning of applicable data protection law.
            </p>
          </section>

          {/* 13. Security */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">13. Security</h2>
            <p>
              Divine implements reasonable technical and organizational measures to protect information processed
              on Divine-controlled infrastructure. However, no system is completely secure, and Divine does not
              guarantee that information will be free from unauthorized access, loss, or alteration.
            </p>
          </section>

          {/* 14. Children */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">14. Children</h2>
            <p>
              Individuals under the age of 16 may use the Service only with the involvement and consent of a
              parent or legal guardian, where permitted by applicable law. If Divine becomes aware that such
              consent is not present where required, Divine may restrict or terminate access and delete associated
              data as required or permitted by applicable law.
            </p>
          </section>

          {/* 15. Decentralized System Notice */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">
              15. Decentralized System Notice
            </h2>
            <p>
              Because the Service interacts with decentralized networks, content may persist on independent
              relays, archives, or third-party systems even after it is removed from Divine-controlled
              infrastructure. Divine cannot guarantee deletion or control of such content.
            </p>
          </section>

          {/* 16. Changes to This Policy */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">16. Changes to This Policy</h2>
            <p>
              Divine may update this Privacy Policy from time to time. Updated versions will be posted with a
              revised &ldquo;Last Updated&rdquo; date. Unless a different effective date is stated, changes will
              become effective 30 days after posting. Your continued use of the Service after the effective date
              of the updated Privacy Policy constitutes your acceptance of it.
            </p>
          </section>

          {/* 17. California Privacy Rights */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">17. California Privacy Rights</h2>
            <p className="mb-3">
              If you are a California resident, you may have certain rights under the California Consumer Privacy
              Act (CCPA), as amended by the California Privacy Rights Act (CPRA), subject to applicable
              thresholds and limitations.
            </p>
            <p className="mb-3">
              These rights may include the ability to request access to categories and specific pieces of personal
              information we have collected about you, request deletion of personal information subject to certain
              exceptions, request correction of inaccurate personal information, and opt out of the sale or
              sharing of personal information where applicable.
            </p>
            <p className="mb-3">
              Divine does not sell personal information in the traditional sense and does not share personal
              information for cross-context behavioral advertising.
            </p>
            <p className="mb-3">
              You may submit requests related to your personal information by contacting{' '}
              <a href="mailto:contact@divine.video" className="text-primary hover:underline">
                contact@divine.video
              </a>. Divine will respond in accordance with applicable law.
            </p>
            <p>
              Because the Service interacts with decentralized systems, some information may not be within
              Divine&rsquo;s control and may not be capable of being deleted or modified by Divine.
            </p>
          </section>

          {/* 18. Contact */}
          <section>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">18. Contact</h2>
            <p className="mb-3">
              For questions about this Privacy Policy, contact:
            </p>
            <p className="mb-1">
              <strong className="text-foreground">Verse Communications PBC dba Divine</strong>
            </p>
            <p className="mb-1">9450 SW Gemini Dr., PMB 21667</p>
            <p className="mb-1">Beaverton, OR 97008</p>
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

export default PrivacyPage;
