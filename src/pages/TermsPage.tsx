// ABOUTME: Terms of Service page for Divine
// ABOUTME: Defines user agreements, content policies, and platform responsibilities

import { Link } from 'react-router-dom';
import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';

export function TermsPage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <ZendeskWidget />
        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last Updated: March 30, 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          {/* 1. Acceptance of Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="mb-3">
              By accessing or using Divine&trade; (the &ldquo;Service&rdquo;), you agree to these Terms of Service
              (&ldquo;Terms&rdquo;). If you do not agree, do not use the Service.
            </p>
            <p className="mb-3">
              The Service is provided by Verse Communications PBC dba Divine (&ldquo;Divine,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). These Terms form a binding agreement
              between you and Divine.
            </p>
            <p>
              By using the Service, you also agree to our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and{' '}
              <Link to="/safety" className="text-primary hover:underline">Safety Standards</Link>, which are
              incorporated by reference. If there is a conflict between these Terms and those policies, these
              Terms control to the extent of the conflict.
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

          {/* 3. Nature of the Service */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Nature of the Service</h2>
            <p className="mb-3">
              Divine primarily operates as a non-custodial interface for reading, writing, and interacting with
              Nostr events, although certain optional authentication, signing, backup, or recovery features may
              involve server-side key management as described in Section 4.
            </p>
            <p className="mb-3">
              The Service may index, display, surface, cache, transmit, or host Nostr events and related media,
              and may also display or link to externally hosted content. Unless expressly stated otherwise, Divine
              does not own or control independent relays, third-party storage providers, archives, or external
              hosts.
            </p>
            <p>
              All third-party trademarks, logos, and brand names that appear through the Service remain the
              property of their respective owners. Divine does not claim affiliation with or endorsement by any
              third-party brand or platform. Any historical or legacy content surfaced through the Service may
              include both user-submitted material and content accessed from external archival or legacy sources
              (such as publicly available internet archives or prior platform submissions) and is not content
              created, owned, or endorsed by Divine.
            </p>
          </section>

          {/* 4. Eligibility, Accounts, and Authentication */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              4. Eligibility, Accounts, and Authentication
            </h2>
            <p className="mb-3">
              You must be at least 16 years old to create an account or use the Service without verifiable
              parental consent. If you are under 16, you may use the Service only with the involvement and consent
              of a parent or legal guardian, where permitted by applicable law. If we become aware that a user
              under 16 is using the Service without such consent where required by law, we may restrict or
              terminate access and delete associated data as required or permitted by applicable law.
            </p>
            <p className="mb-3">
              Some mature content may be hidden by default or restricted to adults using age-screening or
              age-restriction tools based on declared or inferred age, as described in our Safety Standards. You
              may access age-restricted content only if you are at least 18 years old, and you are responsible for
              complying with all applicable age restrictions. Divine may rely on user-provided information and
              available signals to enforce such restrictions but does not guarantee that all age-restricted content
              will be inaccessible to underage users.
            </p>
            <p className="mb-3">
              Your Nostr identity is tied to your Nostr keypair. If you use your own key, you are solely
              responsible for safeguarding your private key and any related credentials.
            </p>
            <p className="mb-3">
              Divine may offer an optional feature called Divine Login. If you use Divine Login, you authorize
              Divine to encrypt, store, manage, back up, recover, and use your signing material on your behalf to
              authenticate you and sign actions you initiate through the Service. Divine Login is different from
              self-custodied use; if you instead use a self-custodied Nostr key and do not use Divine Login, you
              do not have an account on Divine&rsquo;s servers.
            </p>
            <p>
              Any Nostr event published or signed with your key, or through credentials or signing flows you
              authorize, may be treated as authorized by you. If your key, login credentials, or recovery methods
              are lost, compromised, or misused, Divine may be unable to restore access or undo associated
              actions.
            </p>
          </section>

          {/* 5. User Content, Representations, and License */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              5. User Content, Representations, and License
            </h2>
            <p className="mb-3">
              You retain ownership of your user content. Nothing in these Terms transfers ownership of your user
              content to Divine.
            </p>
            <p className="mb-3">
              By posting, uploading, submitting, or making user content available through the Service, you grant
              Divine a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to host,
              store, reproduce, process, adapt, publish, display, transmit, distribute, and create derivative
              works from that content as reasonably necessary to operate, secure, improve, promote, and provide
              the Service.
            </p>
            <p className="mb-3">
              You represent and warrant that: (a) you have all rights, licenses, consents, and permissions
              necessary to submit and use the content; (b) the content and its publication do not infringe,
              misappropriate, or violate any third-party rights, laws, or contractual restrictions; (c) any
              metadata, links, descriptions, and tags you provide are accurate and not misleading; and (d) any
              externally hosted content you reference is lawful and that you have the right to make it available
              through the Service.
            </p>
            <p>
              You are responsible for the content you upload, publish, or reference, whether it is stored on
              Divine-controlled infrastructure or on third-party systems. Divine does not act as your agent,
              fiduciary, or legal representative in enforcing your rights against others, and you remain
              responsible for protecting your own rights.
            </p>
          </section>

          {/* 6. Prohibited Content and Conduct */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              6. Prohibited Content and Conduct
            </h2>
            <p className="mb-3">
              You may not use the Service to create, upload, publish, distribute, solicit, promote, or facilitate:
              (a) child sexual abuse material (CSAM), child sexual exploitation, or any sexualized content
              involving minors; (b) illegal content or unlawful activity; (c) copyright, trademark, trade secret,
              privacy, publicity, or other rights violations; (d) violence, credible threats, graphic gore, or
              content intended to incite physical harm; (e) harassment, bullying, abuse, stalking, or hateful
              conduct targeting individuals or groups; (f) non-consensual intimate imagery, doxxing, or disclosure
              of private, confidential, or sensitive information without authorization; (g) pornographic content,
              except that certain non-pornographic mature content may be restricted or age-gated under our Safety
              Standards; (h) spam, scams, fraud, phishing, malware, or harmful code; (i) impersonation or
              deceptive conduct that is likely to mislead others about identity, affiliation, endorsement, or
              authority; or (j) synthetic, manipulated, or AI-generated media used to deceive, exploit,
              impersonate, or otherwise violate these Terms or our Safety Standards.
            </p>
            <p className="mb-3">
              You also may not: (A) create multiple accounts or identities for deceptive, evasive, or disruptive
              purposes; (B) reserve usernames for resale, misuse, or to block legitimate use, or buy, sell,
              transfer, or trade accounts, Divine-issued usernames, likes, reposts, follows, or similar engagement
              signals; (C) engage in bulk, automated, or coordinated posting, commenting, messaging, tagging, or
              monetization schemes that encourage objectionable behavior unless expressly authorized by Divine;
              (D) scrape, crawl, probe, scan, reverse engineer, bypass, or otherwise interfere with the Service
              or any non-public system, API, or security control; (E) circumvent rate limits, moderation tools,
              access controls, or safety systems; (F) overload, degrade, or disrupt the Service, Divine-controlled
              infrastructure, or connected systems; or (G) use the Service in violation of applicable law.
            </p>
            <p>
              Divine has a zero-tolerance policy for CSAM and other illegal child sexual exploitation. We may
              remove or block content from Divine-controlled infrastructure, suspend or terminate access, preserve
              evidence, report matters to the National Center for Missing &amp; Exploited Children&rsquo;s
              CyberTipline or other appropriate authorities where required or appropriate, and cooperate with law
              enforcement.
            </p>
          </section>

          {/* 7. Moderation, Reporting, and User Controls */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              7. Moderation, Reporting, and User Controls
            </h2>
            <p className="mb-3">
              Divine may use automated tools, hash-matching, third-party detection systems, human review, and
              other moderation measures to identify and limit objectionable content. These systems are not perfect
              and may not identify all prohibited or synthetic content before it appears.
            </p>
            <p className="mb-3">
              Users may report content or accounts through the tools made available in the Service. Divine may
              also support Nostr-compatible reporting mechanisms, including NIP-56 or similar standards. Reports
              may be visible to other users or clients depending on how the relevant protocol or client implements
              them.
            </p>
            <p className="mb-3">
              We aim to review reports of objectionable content promptly and generally within 24 hours, although
              response times may vary based on volume, severity, and available information. For suspected CSAM or
              other urgent illegal content, we may act immediately when appropriate.
            </p>
            <p>
              Divine also provides user controls such as blocking, muting, hidden-content settings, age-gating,
              and community moderation lists, including lists that may follow NIP-51 or similar standards. These
              controls apply within Divine-operated interfaces as implemented by Divine. Because Nostr is
              decentralized, blocking, muting, or removing content in Divine does not guarantee that the same
              content or account will be hidden, removed, or inaccessible through other clients, relays, archives,
              or hosts.
            </p>
          </section>

          {/* 8. Intellectual Property Complaints */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              8. Intellectual Property Complaints
            </h2>
            <p className="mb-3">
              Divine complies with the Digital Millennium Copyright Act (DMCA). If you believe content made
              available through Divine-controlled infrastructure infringes your copyright, you may send a notice to
              our DMCA contact at{' '}
              <a href="mailto:contact@divine.video" className="text-primary hover:underline">
                contact@divine.video
              </a>.
            </p>
            <p className="mb-3">
              Upon receipt of a facially valid notice, Divine may remove or disable access to the allegedly
              infringing material on Divine-controlled infrastructure and may take additional action against repeat
              infringers. Where appropriate, Divine will make reasonable efforts to notify the user who posted the
              content and provide information about the claim and the process for submitting a counter-notification.
              Users may submit counter-notifications as permitted by law.
            </p>
            <p>
              Divine can remove or disable content only on systems it owns or controls. If the underlying material
              is stored on an independent relay, third-party host, or archive, requests to remove the source
              material must be directed to that operator.
            </p>
          </section>

          {/* 9. Usernames, Verification, and Identity Handles */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              9. Usernames, Verification, and Identity Handles
            </h2>
            <p className="mb-3">
              Your core identity on Divine is your Nostr keypair, which you control and may use with compatible
              Nostr clients and services.
            </p>
            <p className="mb-3">
              Divine may also display a human-readable username or handle for use within Divine-operated services,
              such as username.divine.video. Divine-issued usernames are service identifiers only. They are not
              personal property, are not part of your Nostr key-based identity, and may be changed, revoked,
              reclaimed, or reassigned by Divine for safety, technical, operational, legal, or anti-abuse reasons.
            </p>
            <p className="mb-3">
              If you associate your Nostr identity with an external identifier or verification method that you
              control, such as a domain-based NIP-05 identifier, that external identifier remains subject to the
              rules and ownership of the underlying system or domain.
            </p>
            <p className="mb-3">
              Any linked-account, legacy-identity, badge, or other verification feature is optional, may rely on
              third parties, may fail, change, become unavailable, or be revoked at any time, and does not create
              ownership or other property rights in any Divine-issued username, handle, badge, or account
              placement.
            </p>
            <p className="mb-3">
              Your rights in your Nostr keys and user content are not affected by changes to any Divine-issued
              username.
            </p>
            <p className="mb-3">
              Divine does not and cannot act as your agent, legal representative, or fiduciary in enforcing your
              rights against third parties, and you are solely responsible for asserting and protecting your own
              rights.
            </p>
            <p className="mb-3">
              As described in Section 14, Divine cannot guarantee removal of your content from third-party relays
              or media hosts not controlled by Divine.
            </p>
            <p>
              You acknowledge that the Service may display URLs or references to externally hosted content, and
              you are solely responsible for ensuring that such content is lawful, safe, and accurately described
              in your Nostr events. For more information, see Section 17.
            </p>
          </section>

          {/* 10. Divine Intellectual Property and Service License */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              10. Divine Intellectual Property and Service License
            </h2>
            <p className="mb-3">
              Except for user content and third-party content, Divine and its licensors own the Service and its
              associated intellectual property (&ldquo;Divine Marks&rdquo;).
            </p>
            <p className="mb-3">
              The Service may include open-source components that are licensed under separate open-source licenses.
              Your rights in those components are governed by the applicable open-source licenses, not by these
              Terms.
            </p>
            <p>
              Subject to your compliance with these Terms, Divine grants you a limited, personal, non-exclusive,
              non-transferable, revocable license to access and use the hosted Service. This license does not
              grant you any right to use the Divine Marks except as necessary to use the Service, and it does not
              extend to independent deployments, forks, relays, or self-hosted instances operated by third
              parties.
            </p>
          </section>

          {/* 11. Service Operations and Platform Rights */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              11. Service Operations and Platform Rights
            </h2>
            <p className="mb-3">
              Divine may remove content, restrict features, suspend or terminate access, investigate violations,
              cooperate with law enforcement, and take other actions reasonably necessary to protect users, comply
              with law, enforce these Terms, or maintain the integrity of the Service.
            </p>
            <p className="mb-3">
              Divine may implement rate limits, throttling, queueing, circuit breakers, access restrictions,
              geographic limitations, or other protective measures to maintain stability, security, and
              performance.
            </p>
            <p>
              The Service may be unavailable, degraded, or delayed due to maintenance, scaling constraints,
              traffic surges, network conditions, relay outages, third-party host failures, or other factors.
              Divine does not guarantee uninterrupted availability, storage, delivery, or performance.
            </p>
          </section>

          {/* 12. Termination and Deletion Requests */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              12. Termination and Deletion Requests
            </h2>
            <p className="mb-3">
              You may stop using the Service at any time. You may also request deletion of content or account data
              stored on Divine-controlled infrastructure, subject to applicable law, safety requirements, backup
              retention, dispute preservation, and technical limitations.
            </p>
            <p className="mb-3">
              Divine may suspend, restrict, or terminate your access to the Service at any time for violations of
              these Terms, safety or legal concerns, technical risk, or other reasonable operational needs.
            </p>
            <p className="mb-3">
              Because the Service interacts with decentralized systems, termination or deletion by Divine may
              remove access or visibility within Divine-controlled infrastructure without removing content from
              independent relays, external hosts, archives, caches, backups, search results, or third-party
              clients.
            </p>
            <p>
              Sections that by their nature should survive termination will survive, including Sections 5, 13, 14,
              16, 17, 18, 19, and 21.
            </p>
          </section>

          {/* 13. Decentralization and Content Persistence */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              13. Decentralization and Content Persistence
            </h2>
            <p className="mb-3">
              Divine operates on or interacts with the decentralized Nostr protocol. As a result: (a) the Service
              may connect to multiple relays, storage layers, or servers across the internet; (b) content you
              publish may be copied, indexed, cached, mirrored, or archived by independent relays, clients, hosts,
              or third parties; (c) content removed from Divine-controlled interfaces may remain available
              elsewhere; (d) other Nostr clients may apply different moderation or display rules; and (e) once
              content is published, complete removal may be difficult or impossible.
            </p>
            <p>
              If you want different moderation or storage rules, you may be able to use or operate your own
              compatible relays, media servers, or other infrastructure. Divine does not control how independent
              operators handle content.
            </p>
          </section>

          {/* 14. Third-Party Systems and External Links */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              14. Third-Party Systems and External Links
            </h2>
            <p className="mb-3">
              The Service may display, preview, retrieve, cache, or link to content stored on third-party servers,
              storage networks, relays, archives, or websites. Divine does not own or control those systems and is
              not responsible for their availability, security, legality, accuracy, retention, or compliance with
              law.
            </p>
            <p className="mb-3">
              Accessing externally hosted content may expose you to risks, including malware, scams, phishing,
              offensive material, or broken links. You assume the risks associated with interacting with
              third-party content and services.
            </p>
            <p>
              Divine may stop displaying or linking to any external content at any time, but Divine cannot require
              a third-party operator to delete or modify content it controls.
            </p>
          </section>

          {/* 15. Beta and Experimental Features */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              15. Beta and Experimental Features
            </h2>
            <p>
              The Service may include features or tools labeled beta, preview, early access, experimental, or
              similar. Those features are provided &ldquo;as is,&rdquo; may contain bugs or errors, may be
              changed or discontinued at any time, and may be subject to additional terms or limitations.
            </p>
          </section>

          {/* 16. Disclaimers About User Content and Monitoring */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              16. Disclaimers About User Content and Monitoring
            </h2>
            <p className="mb-3">
              User content is the responsibility of the user who created, uploaded, or referenced it. The fact
              that content appears through the Service does not mean that Divine endorses, verifies, or approves
              it.
            </p>
            <p>
              Divine may moderate content, but Divine has no general obligation to monitor all content, proactively
              detect every violation, or enforce these Terms in every instance. Subject to applicable law, Divine
              disclaims liability arising from user-generated content and from content stored or served by third
              parties.
            </p>
          </section>

          {/* 17. Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">17. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Divine and its officers, directors, employees,
              contractors, service providers, and affiliates from and against any claims, liabilities, damages,
              judgments, losses, costs, and expenses, including reasonable attorneys&rsquo; fees, arising out of or
              related to: (a) your user content; (b) your use of the Service; (c) your violation of these Terms;
              or (d) your violation of any law or third-party right.
            </p>
          </section>

          {/* 18. Disclaimer of Warranties and Limitation of Liability
            * The following four paragraphs are rendered uppercase via inline
            * style (NOT the Tailwind `uppercase` class) to satisfy the UCC
            * § 2-316 "conspicuousness" requirement for warranty disclaimers
            * and limitation-of-liability language in U.S. commercial terms.
            * The brand-rule guardrail (tests/brand/no-uppercase-class.test.ts)
            * only matches Tailwind `uppercase` in className, so this exception
            * is deliberate and legally load-bearing. Do not refactor without
            * legal review.
            */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              18. Disclaimer of Warranties and Limitation of Liability
            </h2>
            <p className="mb-3" style={{ textTransform: 'uppercase' }}>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the maximum extent
              permitted by law, Divine disclaims all warranties, express, implied, statutory, or otherwise,
              including any warranties of merchantability, fitness for a particular purpose, title,
              non-infringement, accuracy, quiet enjoyment, or that the Service will be uninterrupted, secure, or
              error-free.
            </p>
            <p className="mb-3" style={{ textTransform: 'uppercase' }}>
              Divine does not guarantee the authenticity, legality, accuracy, safety, or availability of any user
              content, Nostr event, relay, or externally hosted file.
            </p>
            <p className="mb-3" style={{ textTransform: 'uppercase' }}>
              Divine makes reasonable efforts to prevent the display of AI-generated or synthetic media on the
              Service; however, some AI-generated content may bypass our detection systems. Divine does not
              guarantee that all AI-generated content will be identified or blocked before it is served to users.
              Divine will take reasonable steps to promptly remove such content when it is reported through the
              app. Divine does not guarantee that content can be removed, corrected, or made unavailable across
              decentralized networks or third-party systems.
            </p>
            <p className="mb-3" style={{ textTransform: 'uppercase' }}>
              To the maximum extent permitted by law, Divine will not be liable for any indirect, incidental,
              special, consequential, or punitive damages arising out of or related to your use of or inability to
              use the Service, including data loss, failures of relays or third-party hosts, or any inability to
              remove decentralized content, even if Divine has been advised of the possibility of such damages.
            </p>
            <p>
              Nothing in these Terms excludes or limits liability that cannot be excluded or limited under
              applicable law.
            </p>
          </section>

          {/* 19. Dispute Resolution; Governing Law; Class Action Waiver */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              19. Dispute Resolution; Governing Law; Class Action Waiver
            </h2>
            <p className="mb-3">
              Before filing a legal claim relating to the Service or these Terms, you agree to first contact
              Divine in writing and give us at least 30 days to try to resolve the dispute informally.
            </p>
            <p className="mb-3">
              If a dispute cannot be resolved informally, either party may pursue any remedy available under
              applicable law in a court of competent jurisdiction. These Terms are governed by the laws of the
              State of Delaware, without regard to conflict-of-law principles.
            </p>
            <p>
              To the maximum extent permitted by law, each party may bring claims only in its individual capacity
              and not as a plaintiff or class member in any purported class, collective, consolidated, or
              representative action.
            </p>
          </section>

          {/* 20. Changes to These Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">20. Changes to These Terms</h2>
            <p>
              We may modify these Terms from time to time. When we do, we will post the updated version and revise
              the &ldquo;Last Updated&rdquo; date above. Unless a different effective date is stated, changes will
              become effective 30 days after posting. Your continued use of the Service after the effective date of
              updated Terms constitutes your acceptance of the revised Terms.
            </p>
          </section>

          {/* 21. Entire Agreement; Severability; Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              21. Entire Agreement; Severability; Contact Information
            </h2>
            <p className="mb-3">
              These Terms, together with the Privacy Policy and Safety Standards, constitute the entire agreement
              between you and Divine regarding the Service and supersede prior or contemporaneous agreements on
              that subject.
            </p>
            <p className="mb-3">
              If any provision of these Terms is held invalid, unlawful, or unenforceable, that provision will be
              enforced to the maximum extent permitted and the remaining provisions will remain in full force and
              effect.
            </p>
            <p>
              For questions about these Terms, contact us through our{' '}
              <Link to="/support" className="text-primary hover:underline">Support Page</Link> or at{' '}
              <a href="mailto:contact@divine.video" className="text-primary hover:underline">
                contact@divine.video
              </a>.
            </p>
          </section>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default TermsPage;
