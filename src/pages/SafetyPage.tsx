// ABOUTME: Safety Standards page for diVine Web
// ABOUTME: Documents child safety protections and CSAM content filtering

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ShieldAlert, Lock, AlertTriangle, Eye, Users } from 'lucide-react';
import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';

export function SafetyPage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ZendeskWidget />
      <div className="text-center space-y-4 mb-8">
        <div className="flex items-center justify-center gap-3">
          <Shield className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold">Safety Standards</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Our commitment to protecting users and preventing child exploitation
        </p>
      </div>

      <div className="space-y-6">
        {/* Zero Tolerance Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Zero Tolerance for Child Exploitation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Divine maintains a zero-tolerance policy for Child Sexual Abuse Material (CSAM)
              and child sexual exploitation content. We employ multiple layers of protection
              to prevent, detect, and remove such content from our platform.
            </p>
            <p className="font-semibold">
              Any content depicting child sexual abuse or exploitation is strictly prohibited
              and will result in immediate removal and reporting to appropriate authorities.
            </p>
          </CardContent>
        </Card>

        {/* Technical Protections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Multi-Layer Content Filtering
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Divine implements industry-standard technical protections to prevent CSAM
              from appearing on our platform:
            </p>

            <div className="space-y-4 ml-4">
              <div>
                <h3 className="font-semibold mb-2">Cloudflare Protection</h3>
                <p className="text-muted-foreground">
                  All content served through Divine is filtered by Cloudflare's CSAM scanning
                  technology. Cloudflare actively monitors and blocks known CSAM content using
                  hash-matching databases maintained by organizations like the National Center
                  for Missing &amp; Exploited Children (NCMEC).
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">BunnyCDN Filtering</h3>
                <p className="text-muted-foreground">
                  Video content hosted on BunnyCDN infrastructure undergoes additional CSAM
                  detection and filtering. BunnyCDN employs automated scanning systems to
                  identify and block prohibited content before it can be distributed.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Hash Database Matching</h3>
                <p className="text-muted-foreground">
                  Our filtering systems cross-reference content against databases of known
                  CSAM maintained by law enforcement and child protection organizations,
                  including NCMEC's hash database.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Reporting System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              User Reporting System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Divine empowers users to report content that violates community standards or personal
              preferences. User reports are shared with your followers through the decentralized Nostr
              network to help them curate their own experience.
            </p>

            <div>
              <h3 className="font-semibold mb-2">What You Can Report</h3>
              <p className="text-muted-foreground mb-2">
                Users can report content for various reasons, including:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li><strong>Illegal Content:</strong> CSAM, illegal activities, violence, harassment</li>
                <li><strong>Adult Content:</strong> Explicit material that should be age-gated</li>
                <li><strong>AI-Generated Content:</strong> Synthetic media that should be labeled</li>
                <li><strong>Spam:</strong> Unwanted commercial content or repetitive posts</li>
                <li><strong>Misinformation:</strong> False or misleading information</li>
                <li><strong>Impersonation:</strong> Accounts pretending to be someone else</li>
                <li><strong>Copyright Violation:</strong> Unauthorized use of copyrighted material</li>
                <li><strong>Harassment:</strong> Bullying, threats, or targeted abuse</li>
                <li><strong>Other:</strong> Any content that violates community guidelines</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">How Reporting Works</h3>
              <p className="text-muted-foreground mb-2">
                When you report content on Divine:
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-4 text-muted-foreground">
                <li>Your report is published to the Nostr network using NIP-56 (content reporting)</li>
                <li>Divine reviews reports and takes appropriate action within 24 hours</li>
                <li>Anyone who follows you can see your reports and use them to filter their own feed</li>
                <li>Reports become part of the composable moderation ecosystem</li>
                <li>Communities can build trust networks based on shared reporting patterns</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-2">24-Hour Response Commitment</h3>
              <p className="font-semibold text-destructive">
                We commit to reviewing and responding to all content reports within 24 hours.
              </p>
              <p className="text-muted-foreground mt-2">
                For illegal content, especially CSAM, our response is immediate. Content is removed,
                violating accounts are banned, and reports are filed with appropriate authorities.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Social Reporting & Trust Networks</h3>
              <p className="text-muted-foreground">
                Divine's reporting system leverages social trust networks. When you report content,
                your followers can automatically filter out content you've flagged. This creates a
                web of trust where:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>Your reports help protect people who trust your judgment</li>
                <li>You can rely on reports from people you follow</li>
                <li>Communities can collectively moderate their spaces</li>
                <li>No single authority controls what everyone sees</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                For example, if you report a video as spam, your followers can automatically hide
                that video from their feeds. If enough trusted users report content, it can be
                automatically filtered for their entire networks.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">CSAM and Illegal Content Reporting</h3>
              <p className="text-muted-foreground mb-2">
                Content depicting child exploitation requires immediate action. If you encounter CSAM:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>Report it immediately through our{' '}
                  <Link to="/support" className="text-primary hover:underline">
                    support page
                  </Link>
                </li>
                <li>Or report directly to NCMEC's{' '}
                  <a
                    href="https://www.cybertipline.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    CyberTipline
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Divine's Response to Reports</h3>
              <p className="font-semibold text-destructive mb-2">
                We commit to reviewing and acting on objectionable content reports within 24 hours.
              </p>
              <p className="text-muted-foreground mb-2">
                When content is reported, Divine's moderation team:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>
                  <strong>Reviews all reports within 24 hours</strong> - We take every report seriously and respond quickly
                </li>
                <li>
                  <strong>CSAM reports are prioritized immediately</strong> - Illegal content receives instant attention
                </li>
                <li>
                  Takes appropriate action: warnings, content removal, or account suspension/permanent ban
                </li>
                <li>
                  <strong>Removes offending content</strong> from our platform and ejects users who posted prohibited material
                </li>
                <li>
                  Adds confirmed violations to our moderation lists
                </li>
                <li>
                  For CSAM: Immediately removes content, permanently bans the user, reports to NCMEC, and notifies law enforcement
                </li>
                <li>
                  Preserves evidence for legal proceedings when necessary
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Legal Compliance</h3>
              <p className="text-muted-foreground">
                Divine complies with all applicable laws regarding content reporting and moderation:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>18 U.S.C. § 2258A (mandatory CSAM reporting to NCMEC)</li>
                <li>18 U.S.C. § 2252 and § 2252A (CSAM prohibitions)</li>
                <li>DMCA takedown procedures for copyright violations</li>
                <li>Compliance with local laws regarding illegal content</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* AI-Powered Content Moderation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              AI-Powered Content Moderation & Age-Gating
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Divine employs advanced AI-powered content analysis to automatically detect and
              classify potentially sensitive content including adult material, violence, and
              AI-generated media.
            </p>

            <div>
              <h3 className="font-semibold mb-2">Automated Content Scoring</h3>
              <p className="text-muted-foreground mb-2">
                Every video uploaded to Divine is automatically analyzed and scored across multiple categories:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li><strong>Nudity Detection:</strong> Identifies adult content and explicit material</li>
                <li><strong>Violence Detection:</strong> Flags violent or disturbing content</li>
                <li><strong>AI-Generated Detection:</strong> Identifies synthetic or AI-created media</li>
                <li><strong>Additional Categories:</strong> Other content classifications as needed</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Age-Gating and Content Restrictions</h3>
              <p className="text-muted-foreground">
                Content identified as containing adult material is automatically age-gated or restricted:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>Videos with high nudity scores are marked as age-restricted</li>
                <li>Users must confirm they are 18+ to view age-restricted content</li>
                <li>Age-restricted content is excluded from public discovery feeds</li>
                <li>Moderators can manually adjust content ratings and restrictions</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Moderation Dashboard</h3>
              <p className="text-muted-foreground">
                Our moderation team uses a comprehensive dashboard that displays AI confidence scores
                for each content category, allowing human moderators to review, approve, age-restrict,
                or remove content based on both automated analysis and human judgment.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Composable Moderation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Composable Moderation System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Following Bluesky's composable moderation approach, Divine allows users to choose
              their own moderation experience rather than relying on a single centralized authority.
            </p>

            <div>
              <h3 className="font-semibold mb-2">How It Works</h3>
              <p className="text-muted-foreground mb-2">
                Composable moderation puts control in the hands of users and communities:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li><strong>Multiple Moderation Services:</strong> Choose from different moderation providers with different policies</li>
                <li><strong>Community Lists:</strong> Subscribe to moderation lists curated by trusted community members (NIP-51)</li>
                <li><strong>Personal Control:</strong> Block or mute individual users and content</li>
                <li><strong>Layered Filtering:</strong> Combine multiple moderation sources for comprehensive filtering</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Default Moderation</h3>
              <p className="text-muted-foreground">
                Divine provides a default moderation layer focused on:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>Blocking illegal content (CSAM, illegal activities)</li>
                <li>Age-gating adult content</li>
                <li>Filtering spam and malicious content</li>
                <li>Removing content that violates our Terms of Service</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Users who prefer stricter or more lenient moderation can supplement or replace our
                default moderation by subscribing to additional community moderation lists.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Transparency and Appeals</h3>
              <p className="text-muted-foreground">
                All moderation actions are transparent and appealable:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>Users can see which moderation list caused content to be filtered</li>
                <li>Content creators can appeal moderation decisions</li>
                <li>Users can unsubscribe from moderation lists they disagree with</li>
                <li>Community moderators publish their policies and decision-making criteria</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Additional Safety Measures */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Safety Measures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">User Empowerment</h3>
              <p className="text-muted-foreground">
                Divine provides users with tools to protect themselves and their communities:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                <li>User blocking and muting capabilities</li>
                <li>Community moderation lists (NIP-51)</li>
                <li>Content reporting system (NIP-56)</li>
                <li>Composable moderation allowing users to subscribe to trusted moderators</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Decentralized Architecture & Limited Responsibility</h3>
              <p className="text-muted-foreground mb-2">
                Divine operates on the decentralized Nostr protocol, which means the app can connect to
                multiple servers (relays and media servers) across the network. <strong>We maintain strict
                controls over content served through our infrastructure and only bear responsibility for
                content hosted on our own servers.</strong>
              </p>
              <p className="text-muted-foreground mb-2">
                Our CDN and filtering systems ensure that all media accessed through Divine.video has passed
                through our safety checks. However, content on other servers in the Nostr network is moderated
                according to their operators' policies.
              </p>
              <p className="text-muted-foreground">
                <strong>Run your own servers:</strong> If you want different moderation policies, you're welcome
                to run your own Nostr relays and Blossom media servers with whatever policies you prefer. The
                Divine app can connect to any compatible server.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="bg-brand-dark-green border-brand-green">
          <CardHeader>
            <CardTitle className="text-brand-off-white">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-brand-light-green">
              For questions about our safety standards or to report concerns:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-brand-light-green">
              <li>
                <Link to="/support" className="text-brand-green hover:text-brand-light-green">
                  Contact Support
                </Link>
              </li>
              <li>
                Report to NCMEC directly:{' '}
                <a
                  href="https://www.cybertipline.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-green hover:text-brand-light-green"
                >
                  CyberTipline
                </a>
              </li>
              <li>
                View our{' '}
                <Link to="/privacy" className="text-brand-green hover:text-brand-light-green">
                  Privacy Policy
                </Link>
                {' '}and{' '}
                <Link to="/dmca" className="text-brand-green hover:text-brand-light-green">
                  DMCA Policy
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default SafetyPage;
