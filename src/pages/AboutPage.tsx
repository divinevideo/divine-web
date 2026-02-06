// ABOUTME: About page explaining the OpenVine/Divine Web project
// ABOUTME: Contains project history, mission, and creator information

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Heart, Archive, Shield } from 'lucide-react';
import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';
import { ApplePodcastEmbed } from '@/components/ApplePodcastEmbed';

export function AboutPage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ZendeskWidget />
      <h1 className="text-4xl font-bold mb-8">About diVine</h1>

      <div className="space-y-8">
        {/* The Story */}
        <Card className="border-2 border-brand-light-green dark:border-brand-dark-green">
          <CardHeader>
            <CardTitle>The Story Behind diVine</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <p className="text-lg">
              In an era of AI-generated content, diVine is a new short-form video app inspired by
              Vine's creative 6-second format, preserving authentic human creativity.
            </p>
            <div className="not-prose space-y-3">
              <Button asChild size="lg" className="w-full sm:w-auto h-auto py-3 whitespace-normal">
                <Link to="/authenticity" className="flex items-center justify-center gap-2 text-center">
                  <Heart className="h-5 w-5 flex-shrink-0" />
                  <span>Our Mission: Social Media By Humans, For Humans</span>
                </Link>
              </Button>
              <div className="bg-brand-dark-green p-4 rounded-lg border border-brand-green">
                <p className="text-sm text-brand-light-green mb-2">
                  <strong className="text-brand-off-white">In the News:</strong>
                </p>
                <div className="space-y-2">
                  <a
                    href="https://techcrunch.com/2025/11/12/jack-dorsey-funds-divine-a-vine-reboot-that-includes-vines-video-archive/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-green hover:text-brand-light-green inline-flex items-center gap-1"
                  >
                    TechCrunch: Jack Dorsey funds diVine, a Vine reboot that includes Vine's video archive
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <div>
                    <a href="https://about.divine.video/news/" className="text-brand-green hover:text-brand-light-green text-sm">
                      View all press coverage →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remember Vine */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Inspired by Vine's Creative Format
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Between 2013 and 2017, Vine was a popular platform that allowed creators to share
              six-second videos capturing spontaneous moments of creativity. When Twitter shut down Vine,
              millions of creative videos were lost.
            </p>
            <div className="bg-brand-dark-green p-4 rounded-lg border border-brand-green">
              <p className="text-brand-light-green">
                <strong className="text-brand-off-white">Important:</strong> diVine is an independent short-form video app with no affiliation
                to X (formerly Twitter) or the original Vine platform. We're a separate project built on
                open-source technology and the decentralized Nostr protocol. diVine preserves archived videos
                from the Internet Archive and enables new 6-second video creation using similar creative constraints.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Podcast Feature */}
        <Card>
          <CardHeader>
            <CardTitle>Behind the Scenes of the diVine Launch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Listen to founder Rabble discuss the vision behind diVine on the Revolution.Social podcast.
            </p>
            <ApplePodcastEmbed
              episodeUrl="https://podcasts.apple.com/us/podcast/vine-revisited-and-the-fight-against-ai-slop/id1824528874?i=1000737216404"
              title="Vine Revisited and The Fight Against AI Slop"
              description="Behind the scenes of the diVine launch - preserving authentic human creativity"
              showName="Revolution.Social • S1 Bonus"
              duration="21 min"
            />
          </CardContent>
        </Card>

        {/* Why Bring It Back */}
        <Card>
          <CardHeader>
            <CardTitle>Why Bring It Back?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The idea for diVine came during interviews for the{" "}
              <a href="https://revolution.social" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Revolution.Social podcast
              </a>. When interviewing{" "}
              <a href="https://revolution.social/episodes/yoel-roth-on-banning-trump-battling-bots-amp-the-d/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Yoel Roth
              </a>{" "}
              and{" "}
              <a href="https://revolution.social/episodes/taylor-lorenz-on-moral-panics-tech-villains-amp-pr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Taylor Lorenz
              </a>, both talked passionately about how much they missed Vine and the unique creative culture it fostered.
            </p>
            <p className="text-muted-foreground">
              That's when the thought hit: how hard could it be to revive Vine? With today's decentralized technologies,
              we could bring back that spontaneous creativity—but this time, make it impossible for any corporation to
              shut down again.
            </p>
            <p className="text-muted-foreground">
              The goal is to create a platform that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Preserves digital creative legacy</li>
              <li>Prevents content loss due to corporate decisions</li>
              <li>Empowers creators through decentralized technology</li>
            </ul>
          </CardContent>
        </Card>

        {/* Vine Archive */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Preserving Archived Videos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              When Twitter shut down Vine in 2017, millions of creative videos were at risk of being lost forever.
              Fortunately, the volunteer archivists at{" "}
              <a href="https://wiki.archiveteam.org/index.php/Vine" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                ArchiveTeam
              </a>{" "}
              preserved many videos from the original platform through Internet Archive efforts.
            </p>
            <p className="text-muted-foreground">
              diVine has imported archived videos from ArchiveTeam's preservation work, giving these authentic
              pre-AI era videos a new home on the decentralized web. We're committed to restoring creator ownership
              and attribution when possible, honoring those who created these cultural artifacts.
            </p>
            <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">
              "Do it for the Vine!" — A motto from the creative community, circa 2015
            </blockquote>
          </CardContent>
        </Card>

        {/* Digital Rights */}
        <Card>
          <CardHeader>
            <CardTitle>Fighting for Digital Rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground mb-4">diVine upholds key digital rights:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full" />
                <span>Content ownership</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full" />
                <span>Data portability</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full" />
                <span>Privacy control</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full" />
                <span>Algorithmic transparency</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full" />
                <span>Content permanence</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Part of a broader movement for digital rights and user ownership. Learn more at{" "}
              <a href="https://rights.social" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Rights.Social
              </a>.
            </p>
          </CardContent>
        </Card>

        {/* Key Features */}
        <Card>
          <CardHeader>
            <CardTitle>Key Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Nostr Protocol</h4>
                <p className="text-sm text-muted-foreground">
                  Decentralized and censorship-resistant. Built on{" "}
                  <a href="https://nostr.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Nostr
                  </a>, a protocol that makes it impossible for any single entity to control or censor your content.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Composable Moderation</h4>
                <p className="text-sm text-muted-foreground">
                  Like Bluesky's moderation, you choose who your moderators are. Create your own
                  moderation lists or subscribe to ones you trust.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Blossom Media Servers</h4>
                <p className="text-sm text-muted-foreground">
                  Multiple media servers mean you can host your own content, choose who hosts it,
                  or use community servers. Your videos aren't locked to one provider.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Algorithmic Choice</h4>
                <p className="text-sm text-muted-foreground">
                  Using Nostr custom algorithms and DVMs (Data Vending Machines), you can choose
                  your algorithm or even create new ones for others to use.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Direct Recording</h4>
                <p className="text-sm text-muted-foreground">
                  Authentic moments without AI filters
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Open Source</h4>
                <p className="text-sm text-muted-foreground">
                  Community-built and maintained. Check out our{" "}
                  <a href="https://github.com/rabble/divine-web" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    web app
                  </a>{" "}
                  and{" "}
                  <a href="https://github.com/rabble/nostrvine" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Flutter app
                  </a>{" "}
                  on GitHub.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ProofMode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Cryptographic Authenticity with ProofMode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              In an era where AI can generate realistic fake videos, diVine uses ProofMode to help you
              distinguish real camera captures from AI-generated content.
            </p>
            <p className="text-muted-foreground">
              ProofMode adds cryptographic proofs to videos, including device hardware attestation,
              OpenPGP signatures, and content hashes. This raises the bar for authenticity and helps
              restore trust in video content.
            </p>
            <p className="text-sm text-muted-foreground">
              <Link to="/proofmode" className="text-primary hover:underline">
                Learn more about ProofMode
              </Link>.
            </p>
          </CardContent>
        </Card>

        {/* Creator */}
        <Card>
          <CardHeader>
            <CardTitle>Created by Rabble</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Inspired by Vine's simple creative format and projects like{" "}
              <a href="https://neocities.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Neocities
              </a>,
              diVine brings back spontaneous, creative 6-second video sharing.
            </p>
            <p className="text-muted-foreground">
              Rabble is building decentralized social media technologies and fighting for digital rights.
            </p>
            <p className="text-sm text-muted-foreground">
              Learn more at{" "}
              <a href="https://rabblelabs.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                RabbleLabs.com
              </a>{" "}
              or read about the history of social media at{" "}
              <a href="https://revolution.social" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Revolution.Social
              </a>.
            </p>
          </CardContent>
        </Card>

        {/* Mobile Apps */}
        <Card>
          <CardHeader>
            <CardTitle>Get the Mobile App</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              <strong>iOS:</strong> TestFlight is full (10k sign ups in 4 hours!) - Stay tuned for updates
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default AboutPage;