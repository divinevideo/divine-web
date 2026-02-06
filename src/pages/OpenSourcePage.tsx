// ABOUTME: Open source page showing project repositories and contribution info
// ABOUTME: Includes platform availability and technology stack details

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Github,
  Globe,
  Smartphone,
  Code2,
  Users,
  Heart
} from 'lucide-react';
import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';

export function OpenSourcePage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ZendeskWidget />
      <h1 className="text-4xl font-bold mb-8">Open Source Project</h1>

      <div className="space-y-8">
        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              Beta Testing Now Live!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg text-muted-foreground">
              Divine is a decentralized, open-source platform for short-form looping videos, built on the Nostr protocol.
              We're currently in <strong>beta testing</strong> and invite you to join us in shaping the future of creative video sharing!
            </p>
            <div className="bg-brand-dark-green p-4 rounded-lg border border-brand-green">
              <h3 className="font-semibold mb-3 text-brand-off-white">Join the Beta</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-500" />
                  <strong className="text-brand-off-white">iOS:</strong> <span className="text-brand-light-green">Beta is full (10k sign ups in 4 hours!) - Stay tuned for updates</span>
                </p>
                <p className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-green-500" />
                  <strong className="text-brand-off-white">Android:</strong> <span className="text-brand-light-green">Beta is full - Stay tuned for updates</span>
                </p>
                <p className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <strong className="text-brand-off-white">Web:</strong> <span className="text-brand-light-green">You're already here!</span> <Link to="/discovery" className="text-brand-green hover:text-brand-light-green">Start exploring</Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platforms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Available Platforms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <span>Web App</span>
                </div>
                <Badge className="bg-green-500">Live</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-blue-500" />
                  <span>iOS</span>
                </div>
                <Badge className="bg-yellow-500">Beta</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-green-500" />
                  <span>Android</span>
                </div>
                <Badge className="bg-yellow-500">Beta</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repositories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5 text-primary" />
              GitHub Repositories
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Flutter App Repository */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-blue-500" />
                    Mobile Applications
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Native iOS and Android apps
                  </p>
                </div>
                <Button asChild size="sm">
                  <a
                    href="https://github.com/divinevideo/divine-mobile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <Github className="h-4 w-4" />
                    View Repo
                  </a>
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Tech Stack:</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Flutter</Badge>
                  <Badge variant="outline">Dart</Badge>
                  <Badge variant="outline">Nostr</Badge>
                  <Badge variant="outline">Cross-platform</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Features:</strong>
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Native performance on iOS and Android</li>
                  <li>Optimized video playback and caching</li>
                  <li>Native camera integration</li>
                  <li>Offline support and background sync</li>
                </ul>
              </div>
            </div>

            {/* Web App Repository */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    Web Application
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    React-based web client for diVine
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <a
                    href="https://github.com/divinevideo/divine-web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <Github className="h-4 w-4" />
                    View Repo
                  </a>
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Tech Stack:</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">React 18</Badge>
                  <Badge variant="outline">TypeScript</Badge>
                  <Badge variant="outline">Vite</Badge>
                  <Badge variant="outline">TailwindCSS</Badge>
                  <Badge variant="outline">Nostrify</Badge>
                  <Badge variant="outline">shadcn/ui</Badge>
                  <Badge variant="outline">MKStack</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Features:</strong>
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Progressive Web App (PWA) support</li>
                  <li>Real-time Nostr event streaming</li>
                  <li>Responsive design for all screen sizes</li>
                  <li>Advanced search and discovery feeds</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Open Source Principles */}
        <Card>
          <CardHeader>
            <CardTitle>Key Open Source Principles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <h4 className="font-semibold flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full" />
                  Transparency
                </h4>
                <p className="text-sm text-muted-foreground pl-4">
                  All code is open and auditable
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full" />
                  Community-driven
                </h4>
                <p className="text-sm text-muted-foreground pl-4">
                  Built by and for the community
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full" />
                  Innovation
                </h4>
                <p className="text-sm text-muted-foreground pl-4">
                  Pushing boundaries of decentralized social
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full" />
                  Platform freedom
                </h4>
                <p className="text-sm text-muted-foreground pl-4">
                  No vendor lock-in or corporate control
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full" />
                  User privacy
                </h4>
                <p className="text-sm text-muted-foreground pl-4">
                  Your data, your control
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Community & Contribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              How to Contribute
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Join our open-source community and help build the future of decentralized video sharing!
              Whether you're a developer, designer, or just passionate about the project, there are many ways to contribute.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-primary" />
                  For Developers
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2 pl-6 list-disc">
                  <li>
                    <strong>Web Development:</strong> Help improve the React web app - fix bugs, add features, or enhance performance.
                    <div className="mt-1">
                      <a
                        href="https://github.com/divinevideo/divine-web/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs"
                      >
                        Browse web app issues →
                      </a>
                    </div>
                  </li>
                  <li>
                    <strong>Mobile Development:</strong> Contribute to the Flutter codebase for iOS and Android apps.
                    <div className="mt-1">
                      <a
                        href="https://github.com/divinevideo/divine-mobile/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs"
                      >
                        Browse Flutter app issues →
                      </a>
                    </div>
                  </li>
                  <li><strong>Documentation:</strong> Help improve our docs, write tutorials, or create examples.</li>
                  <li><strong>Testing:</strong> Report bugs, test new features, and help improve quality assurance.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  Other Ways to Help
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
                  <li>Share diVine with your community and spread the word</li>
                  <li>Report bugs and suggest improvements</li>
                  <li>Help answer questions from other users</li>
                  <li>Create content and showcase what you build</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button asChild>
                <a
                  href="https://github.com/divinevideo/divine-web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  Contribute to Web App
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href="https://github.com/divinevideo/divine-mobile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  Contribute to Flutter App
                </a>
              </Button>
            </div>

            <div className="text-sm text-muted-foreground pt-4 border-t">
              Developed by <span className="font-semibold">Rabble Labs</span> • Licensed under{' '}
              <a
                href="https://github.com/divinevideo/divine-web/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                MPL-2.0
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Special Recognition */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Special Recognition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Gratitude to ArchiveTeam for preserving hundreds of thousands of Vines during
              Twitter's platform shutdown. Their dedication to digital preservation
              ensures these creative moments live on.
            </p>
          </CardContent>
        </Card>

        {/* Motto */}
        <Card className="bg-brand-dark-green border-brand-green">
          <CardContent className="py-8 text-center">
            <blockquote className="text-xl font-semibold italic text-brand-off-white">
              "Liberating Vine, one loop at a time"
            </blockquote>
          </CardContent>
        </Card>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default OpenSourcePage;