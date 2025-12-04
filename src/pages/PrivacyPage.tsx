// ABOUTME: Privacy policy page explaining data collection and user rights
// ABOUTME: Based on OpenVine's privacy commitments and Nostr protocol principles

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Users, Database, UserCheck, AlertCircle } from 'lucide-react';
import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';

export function PrivacyPage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ZendeskWidget />
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

      <div className="space-y-8">
        {/* Key Commitments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Key Commitments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Rewind Web is committed to:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-primary rounded-full mt-1.5" />
                <span>Creating a social app with less abuse by design</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-primary rounded-full mt-1.5" />
                <span>Minimizing centralized data collection</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-primary rounded-full mt-1.5" />
                <span>Empowering user control</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-primary rounded-full mt-1.5" />
                <span>Enabling user ownership of identity</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Core Principles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Distributed Social Network
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-sm">Built on Nostr protocol</span>
            </div>
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-sm">Content stored across multiple relays</span>
            </div>
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-sm">Users can choose their own relays</span>
            </div>
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-sm">No single company controls the entire network</span>
            </div>
          </CardContent>
        </Card>

        {/* Data Collection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Data Collection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3">Information Collected</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Display Name</li>
                <li>• Public Identifier (cryptographic key)</li>
                <li>• Profile information</li>
                <li>• Public video content</li>
                <li>• Followers/Following lists</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">What We Don't Collect</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Extensive personal data</li>
                <li>• Information designed to generate revenue from user data</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Key Restrictions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Key Restrictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <p className="text-sm font-medium">User Limitations</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Not designed for children under 16</li>
                  <li>• Public content by default</li>
                  <li>• Users can delete their own content</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Sharing */}
        <Card>
          <CardHeader>
            <CardTitle>Data Sharing Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Rewind Web may share data:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• As part of distributed network operation</li>
              <li>• With necessary third-party services</li>
              <li>• When legally required</li>
              <li>• Potential ownership changes</li>
            </ul>
          </CardContent>
        </Card>

        {/* User Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              User Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full mt-1.5" />
                <span>Edit profile information</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full mt-1.5" />
                <span>Delete content</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full mt-1.5" />
                <span>Portable identity across Nostr-compatible platforms</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full mt-1.5" />
                <span>Option to completely delete account</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full mt-1.5" />
                <span>Block or mute other users</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full mt-1.5" />
                <span>Report objectionable content</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Content Moderation and Safety */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Content Moderation and Safety
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-3">Zero Tolerance Policy</h4>
              <p className="text-muted-foreground">
                Rewind maintains a strict zero-tolerance policy for objectionable content and abusive behavior.
                By using our service, you agree to our{' '}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>
                {' '}which prohibit:
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground mt-2 ml-4">
                <li>• Child Sexual Abuse Material (CSAM)</li>
                <li>• Illegal activities and content</li>
                <li>• Harassment, abuse, and hate speech</li>
                <li>• Spam and malicious content</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Content Filtering Methods</h4>
              <p className="text-muted-foreground mb-2">We filter objectionable content using:</p>
              <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                <li>• CSAM hash-matching through Cloudflare and BunnyCDN</li>
                <li>• AI-powered content analysis for adult content and violence</li>
                <li>• User reports and community moderation</li>
                <li>• Human moderation review</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">User Reporting Mechanism</h4>
              <p className="text-muted-foreground">
                All users can flag objectionable content for review. We commit to reviewing and acting on
                reports within 24 hours, with immediate action for illegal content. Learn more on our{' '}
                <Link to="/safety" className="text-primary hover:underline">
                  Safety Standards
                </Link>
                {' '}page.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">User Blocking Tools</h4>
              <p className="text-muted-foreground">
                Users have multiple tools to protect themselves from abusive users:
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground mt-2 ml-4">
                <li>• Block users to prevent all interactions</li>
                <li>• Mute users to hide their content</li>
                <li>• Subscribe to community moderation lists</li>
                <li>• Use trust networks for content filtering</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Enforcement Actions</h4>
              <p className="text-muted-foreground">
                Users who post prohibited content face immediate consequences:
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground mt-2 ml-4">
                <li>• Immediate content removal</li>
                <li>• Account suspension or permanent ban</li>
                <li>• Reporting to law enforcement for illegal content</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Important Note */}
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Important Note
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Users should understand content shared publicly may be copied by others,
              even after deletion. This is inherent to decentralized networks.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              For privacy-related questions, email:{' '}
              <a
                href="mailto:contact@rewind.community"
                className="text-primary hover:underline"
              >
                contact@rewind.community
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default PrivacyPage;