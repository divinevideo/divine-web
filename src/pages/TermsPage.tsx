// ABOUTME: Terms of Service (EULA) page for Divine
// ABOUTME: Defines user agreements, content policies, and platform responsibilities

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, FileText, UserX, Flag } from 'lucide-react';
import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';

export function TermsPage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ZendeskWidget />
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">
        Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <div className="space-y-6">
        {/* Acceptance of Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Acceptance of Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              By accessing or using Divine ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, you must not use the Service.
            </p>
            <p className="text-muted-foreground">
              The Service is provided by Divine ("we," "us," or "our"). These terms constitute a legally
              binding agreement between you and Divine.
            </p>
          </CardContent>
        </Card>

        {/* Zero Tolerance Policy */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Zero Tolerance for Objectionable Content and Abusive Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-semibold">
              Divine maintains a strict zero-tolerance policy for objectionable content and abusive behavior.
            </p>

            <div>
              <h3 className="font-semibold mb-2">Prohibited Content</h3>
              <p className="text-muted-foreground mb-2">
                The following content is strictly prohibited on Divine:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li><strong>Child Sexual Abuse Material (CSAM):</strong> Any content depicting or exploiting minors</li>
                <li><strong>Illegal Activities:</strong> Content promoting or facilitating illegal activities</li>
                <li><strong>Violence and Threats:</strong> Content depicting graphic violence or threatening harm to others</li>
                <li><strong>Harassment and Abuse:</strong> Content that bullies, harasses, or abuses other users</li>
                <li><strong>Hate Speech:</strong> Content that promotes hatred or discrimination against protected groups</li>
                <li><strong>Non-Consensual Content:</strong> Sharing private content without consent (revenge porn, doxxing, etc.)</li>
                <li><strong>Spam and Malware:</strong> Malicious content or excessive unsolicited commercial content</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Consequences of Violations</h3>
              <p className="text-muted-foreground mb-2">
                Users who post prohibited content or engage in abusive behavior will face immediate action:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>Immediate removal of offending content</li>
                <li>Suspension or permanent ban from the platform</li>
                <li>Reporting to appropriate authorities for illegal content</li>
                <li>Cooperation with law enforcement investigations</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Content Reporting and Moderation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Content Filtering and User Reporting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Automated Content Filtering</h3>
              <p className="text-muted-foreground">
                Divine employs multiple methods to filter objectionable content:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>CSAM hash-matching through Cloudflare and BunnyCDN filtering systems</li>
                <li>AI-powered content analysis to detect adult content, violence, and other sensitive material</li>
                <li>Automated age-gating for content identified as adult or explicit</li>
                <li>Real-time scanning and blocking of known prohibited content</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">User Reporting Mechanism</h3>
              <p className="text-muted-foreground mb-2">
                All users have the ability to report objectionable content. When you report content:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>Reports are submitted using the Nostr protocol (NIP-56)</li>
                <li>Your followers can see your reports and use them to filter their own feeds</li>
                <li>Reports contribute to the decentralized moderation ecosystem</li>
                <li>Reports create a web of trust that helps communities self-moderate</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                To report content, use the report button on any post or contact us at{' '}
                <Link to="/support" className="text-primary hover:underline">
                  our support page
                </Link>.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Response Time Commitment</h3>
              <p className="font-semibold text-destructive">
                We commit to reviewing and responding to reports of objectionable content within 24 hours.
              </p>
              <p className="text-muted-foreground mt-2">
                For reports of illegal content (especially CSAM), we take immediate action:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>Content is blocked from our infrastructure upon verification</li>
                <li>Violating accounts are removed from the platform</li>
                <li>Reports are filed with NCMEC's CyberTipline for CSAM</li>
                <li>Law enforcement is notified when appropriate</li>
                <li>We cooperate fully with legal investigations</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* User Blocking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5" />
              Blocking and Muting Abusive Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Divine provides mechanisms for users to protect themselves from abusive users:
            </p>

            <div>
              <h3 className="font-semibold mb-2">User Blocking</h3>
              <p className="text-muted-foreground">
                You can block any user on Divine. When you block a user:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>You will no longer see their content in your feeds</li>
                <li>They cannot interact with your content</li>
                <li>They cannot send you direct messages</li>
                <li>The block persists across all Nostr-compatible clients</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Content Muting</h3>
              <p className="text-muted-foreground">
                You can mute specific users, hashtags, or keywords to customize your feed experience
                without permanently blocking users.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Community Moderation Lists</h3>
              <p className="text-muted-foreground">
                Subscribe to moderation lists curated by trusted community members to automatically
                filter content based on community standards (NIP-51).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* User Responsibilities */}
        <Card>
          <CardHeader>
            <CardTitle>User Responsibilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">By using Divine, you agree to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground">
              <li>Comply with all applicable laws and regulations</li>
              <li>Respect the rights of other users</li>
              <li>Not post prohibited or objectionable content</li>
              <li>Not engage in abusive behavior toward other users</li>
              <li>Not attempt to circumvent our content filtering or moderation systems</li>
              <li>Accurately represent yourself and not impersonate others</li>
              <li>Respect intellectual property rights</li>
              <li>Report illegal or abusive content when you encounter it</li>
            </ul>
          </CardContent>
        </Card>

        {/* Age Restrictions */}
        <Card>
          <CardHeader>
            <CardTitle>Age Restrictions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Divine is not intended for users under the age of 16. If you are under 16, you may not
              create an account or use the Service.
            </p>
            <p className="text-muted-foreground">
              Some content on Divine is age-restricted and requires users to be 18 or older to view.
              By accessing age-restricted content, you certify that you are at least 18 years old.
            </p>
          </CardContent>
        </Card>

        {/* Platform Rights and Limitations */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Rights and Limitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Divine reserves the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground">
              <li>Remove any content that violates these Terms</li>
              <li>Suspend or terminate accounts that violate these Terms</li>
              <li>Modify or discontinue the Service at any time</li>
              <li>Update these Terms of Service as needed</li>
              <li>Cooperate with law enforcement investigations</li>
              <li>Take any action necessary to protect users and comply with the law</li>
            </ul>
          </CardContent>
        </Card>

        {/* Decentralization Notice */}
        <Card className="border-brand-yellow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Important Notice About Decentralization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Divine operates on the decentralized Nostr protocol. This means:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground">
              <li>The Divine app can connect to multiple servers (relays and media servers) across the network</li>
              <li>Content you post is distributed across multiple independent relays</li>
              <li>Even if we remove content from our platform, it may persist on other relays</li>
              <li>Other Nostr clients may display content using different moderation policies</li>
              <li>Once content is shared, it may be difficult or impossible to completely remove</li>
            </ul>

            <div className="p-3 bg-brand-dark-green border border-brand-green rounded-lg">
              <p className="font-semibold mb-2 text-brand-off-white">Limited Responsibility</p>
              <p className="text-brand-light-green mb-2">
                <strong className="text-brand-off-white">We only bear responsibility for content hosted on our own servers.</strong> Content on
                other servers in the Nostr network is moderated according to their operators' policies.
              </p>
              <p className="text-brand-light-green">
                While we maintain strict moderation on content served through Divine, we cannot control
                content on the broader Nostr network. Users should be aware of this when posting content.
              </p>
            </div>

            <p className="text-muted-foreground">
              <strong>Run your own servers:</strong> If you want different moderation policies, you're welcome
              to run your own Nostr relays and Blossom media servers with whatever policies you prefer. The
              Divine app can connect to any compatible server.
            </p>
          </CardContent>
        </Card>

        {/* Disclaimer and Limitation of Liability */}
        <Card>
          <CardHeader>
            <CardTitle>Disclaimer and Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. DIVINE DISCLAIMS ALL
              WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-muted-foreground">
              DIVINE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
            </p>
          </CardContent>
        </Card>

        {/* Governing Law */}
        <Card>
          <CardHeader>
            <CardTitle>Governing Law</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              These Terms of Service shall be governed by and construed in accordance with the laws
              of the United States and the State of California, without regard to conflict of law principles.
            </p>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="bg-brand-dark-green border-brand-green">
          <CardHeader>
            <CardTitle className="text-brand-off-white">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-brand-light-green">
              For questions about these Terms of Service, please contact us:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-brand-light-green">
              <li>
                <Link to="/support" className="text-brand-green hover:text-brand-light-green">
                  Support Page
                </Link>
              </li>
              <li>
                Email:{' '}
                <a href="mailto:contact@divine.video" className="text-brand-green hover:text-brand-light-green">
                  contact@divine.video
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default TermsPage;
