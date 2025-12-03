// ABOUTME: Media Resources page for press and media inquiries
// ABOUTME: Contains press contact, company info, team bios, and media assets

import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Mail, Download, FileText, Image } from 'lucide-react';
import { MarketingLayout } from '@/components/MarketingLayout';
import { ApplePodcastEmbed } from '@/components/ApplePodcastEmbed';

export function MediaResourcesPage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Media Resources</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about diVine, the short-form video platform preserving authentic human creativity.
          </p>
        </div>

        {/* Press Contact */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Press Contact
            </CardTitle>
            <CardDescription>
              For media inquiries, interviews, and press releases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link to="/press" className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contact Press Team
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* About diVine */}
        <Card>
          <CardHeader>
            <CardTitle>About diVine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              diVine is a decentralized short-form video platform built on the Nostr protocol,
              inspired by Vine's creative 6-second format. In an era of AI-generated content,
              diVine preserves authentic human creativity and gives creators true ownership of their content.
            </p>
            <p className="text-muted-foreground">
              diVine brings back the spontaneous creativity that made Vine special—but this time,
              built on open-source technology that makes it impossible for any corporation to shut down.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="space-y-2">
                <h4 className="font-semibold">Key Features</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 6-second looping videos</li>
                  <li>• Decentralized Nostr protocol</li>
                  <li>• ProofMode authenticity verification</li>
                  <li>• Creator ownership & portability</li>
                  <li>• Open source & community-driven</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Quick Facts</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Launched: November 2025</li>
                  <li>• Platform: Web, iOS, Android</li>
                  <li>• License: Open Source (MPL-2.0)</li>
                </ul>
              </div>
            </div>
            <div className="pt-4 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/about" className="inline-flex items-center gap-2">
                  Learn More About diVine
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/news/vine-revisited" className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Read Press Release
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About Rabble */}
        <Card>
          <CardHeader>
            <CardTitle>About Rabble (Founder & CEO)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-48 flex-shrink-0">
                <img
                  src="/rabble-headshot.jpg"
                  alt="Rabble"
                  className="aspect-square rounded-lg object-cover w-full mb-2"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Photo credit: Web Summit
                </p>
              </div>
              <div className="flex-1 space-y-4">
                <p className="text-muted-foreground">
                  Rabble is a veteran technologist and activist building decentralized social media
                  technologies and fighting for digital rights. Creator of diVine and host of the
                  Revolution.Social podcast, Rabble has been at the forefront of open-source and
                  decentralized technology for over two decades.
                </p>
                <p className="text-muted-foreground">
                  His work focuses on empowering users through decentralization, protecting digital
                  rights, and building tools that put creators first. With diVine, he's bringing back
                  the creative spontaneity of Vine while ensuring no corporation can ever shut it down again.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href="/rabble-headshot.jpg"
                      download="rabble-headshot.jpg"
                      className="inline-flex items-center gap-2"
                    >
                      <Download className="h-3 w-3" />
                      Download Photo
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href="https://revolution.social"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      Revolution.Social Podcast
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Podcast Feature */}
        <Card>
          <CardHeader>
            <CardTitle>Behind the Scenes of the diVine Launch</CardTitle>
            <CardDescription>
              Listen to founder Rabble discuss the vision behind diVine on the Revolution.Social podcast
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApplePodcastEmbed
              episodeUrl="https://podcasts.apple.com/us/podcast/vine-revisited-and-the-fight-against-ai-slop/id1824528874?i=1000737216404"
              title="Vine Revisited and The Fight Against AI Slop"
              description="Behind the scenes of the diVine launch - preserving authentic human creativity"
              showName="Revolution.Social • S1 Bonus"
              duration="21 min"
            />
          </CardContent>
        </Card>

        {/* Additional Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Additional Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button asChild variant="outline" className="justify-start h-auto py-4">
                <Link to="/faq" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-semibold">Frequently Asked Questions</div>
                    <div className="text-xs text-muted-foreground">Common questions about diVine</div>
                  </div>
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start h-auto py-4">
                <a
                  href="https://medium.com/revolution-social/we-deserve-better-a-new-social-media-bill-of-rights-28057b985cf2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-semibold">Digital Bill of Rights</div>
                    <div className="text-xs text-muted-foreground">Our commitment to user rights</div>
                  </div>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Screenshots & Media */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Screenshots & Media Assets
            </CardTitle>
            <CardDescription>
              High-resolution screenshots and demo videos for media use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Screenshots */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Image className="h-4 w-4" />
                App Screenshots
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col gap-3">
                    <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden border">
                      <img
                        src={`/screenshots/${i}_1.png`}
                        alt={`diVine screenshot ${i}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <a href={`/screenshots/${i}_1.png`} download={`divine-screenshot-${i}.png`}>
                      <Button size="sm" variant="outline" className="w-full">
                        <Download className="h-3 w-3 mr-2" />
                        Download
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Demo Videos */}
            {/* <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Video className="h-4 w-4" />
                Demo Videos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border">
                      <span className="text-sm text-muted-foreground">Demo Video {i}</span>
                    </div>
                    <Button size="sm" variant="outline" className="w-full">
                      <Download className="h-3 w-3 mr-2" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div> */}

            {/* Brand Assets */}
            <div>
              <h3 className="font-semibold mb-3">Brand Assets & Logos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Download diVine logos and brand assets for media use. Available in PNG and SVG formats.
              </p>

              {/* Cover Image */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3">Cover Image</h4>
                <div className="max-w-2xl">
                  <a
                    href="/og.png"
                    download="divine-cover-image.png"
                    className="group border rounded-lg p-4 hover:border-primary transition-colors block"
                  >
                    <div className="aspect-video bg-muted rounded flex items-center justify-center mb-3">
                      <img
                        src="/og.png"
                        alt="diVine cover image"
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">Social Media Cover Image</div>
                        <div className="text-xs text-muted-foreground">1920 × 1080 PNG</div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </a>
                </div>
              </div>

              {/* Icon Logos */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3">Icon Logos</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <a
                    href="/brand-assets/divine_icon_transparent.png"
                    download
                    className="group border rounded-lg p-4 hover:border-primary transition-colors"
                  >
                    <div className="aspect-square bg-muted rounded flex items-center justify-center mb-2">
                      <img
                        src="/brand-assets/divine_icon_transparent.png"
                        alt="Divine icon transparent"
                        className="w-20 h-20 object-contain"
                      />
                    </div>
                    <div className="text-sm font-medium">Icon - Transparent</div>
                    <div className="text-xs text-muted-foreground">PNG</div>
                  </a>

                  <a
                    href="/brand-assets/app_icon.png"
                    download
                    className="group border rounded-lg p-4 hover:border-primary transition-colors"
                  >
                    <div className="aspect-square bg-muted rounded flex items-center justify-center mb-2">
                      <img
                        src="/brand-assets/app_icon.png"
                        alt="Divine app icon"
                        className="w-20 h-20 object-contain"
                      />
                    </div>
                    <div className="text-sm font-medium">App Icon</div>
                    <div className="text-xs text-muted-foreground">PNG</div>
                  </a>
                </div>
              </div>

              {/* Wordmark Logos */}
              <div>
                <h4 className="text-sm font-medium mb-3">Wordmark Logos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Black on White */}
                  <div className="border rounded-lg p-4">
                    <div className="aspect-video bg-white rounded flex items-center justify-center mb-3 border">
                      <img
                        src="/brand-assets/Black_on_white.png"
                        alt="Divine logo - Black on white"
                        className="max-w-[80%] max-h-[80%] object-contain"
                      />
                    </div>
                    <div className="flex gap-2">
                      <a
                        href="/brand-assets/Black_on_white.png"
                        download
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="h-3 w-3 mr-1" />
                          PNG
                        </Button>
                      </a>
                      <a
                        href="/brand-assets/Black_on_white.svg"
                        download
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="h-3 w-3 mr-1" />
                          SVG
                        </Button>
                      </a>
                    </div>
                    <div className="text-sm font-medium mt-2">Black on White</div>
                  </div>

                  {/* White on Black */}
                  <div className="border rounded-lg p-4">
                    <div className="aspect-video bg-black rounded flex items-center justify-center mb-3 border">
                      <img
                        src="/brand-assets/White_on_black.png"
                        alt="Divine logo - White on black"
                        className="max-w-[80%] max-h-[80%] object-contain"
                      />
                    </div>
                    <div className="flex gap-2">
                      <a
                        href="/brand-assets/White_on_black.png"
                        download
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="h-3 w-3 mr-1" />
                          PNG
                        </Button>
                      </a>
                      <a
                        href="/brand-assets/White_on_black.svg"
                        download
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="h-3 w-3 mr-1" />
                          SVG
                        </Button>
                      </a>
                    </div>
                    <div className="text-sm font-medium mt-2">White on Black</div>
                  </div>

                  {/* Green on Ivory */}
                  <div className="border rounded-lg p-4">
                    <div className="aspect-video rounded flex items-center justify-center mb-3 border" style={{ backgroundColor: '#F5F5DC' }}>
                      <img
                        src="/brand-assets/Green_on_ivory.png"
                        alt="Divine logo - Green on ivory"
                        className="max-w-[80%] max-h-[80%] object-contain"
                      />
                    </div>
                    <div className="flex gap-2">
                      <a
                        href="/brand-assets/Green_on_ivory.png"
                        download
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="h-3 w-3 mr-1" />
                          PNG
                        </Button>
                      </a>
                      <a
                        href="/brand-assets/Green_on_ivory.svg"
                        download
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="h-3 w-3 mr-1" />
                          SVG
                        </Button>
                      </a>
                    </div>
                    <div className="text-sm font-medium mt-2">Green on Ivory</div>
                  </div>

                  {/* Ivory on Green */}
                  <div className="border rounded-lg p-4">
                    <div className="aspect-video rounded flex items-center justify-center mb-3 border" style={{ backgroundColor: '#2D5016' }}>
                      <img
                        src="/brand-assets/Ivory_on_Green.png"
                        alt="Divine logo - Ivory on green"
                        className="max-w-[80%] max-h-[80%] object-contain"
                      />
                    </div>
                    <div className="flex gap-2">
                      <a
                        href="/brand-assets/Ivory_on_Green.png"
                        download
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="h-3 w-3 mr-1" />
                          PNG
                        </Button>
                      </a>
                      <a
                        href="/brand-assets/Ivory_on_Green.svg"
                        download
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="h-3 w-3 mr-1" />
                          SVG
                        </Button>
                      </a>
                    </div>
                    <div className="text-sm font-medium mt-2">Ivory on Green</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer CTA */}
        <div className="bg-muted/50 rounded-lg border p-6 text-center">
          <h3 className="font-semibold mb-2">Need More Information?</h3>
          <p className="text-muted-foreground mb-4">
            Our press team is here to help with interviews, additional materials, or any questions.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button asChild size="lg">
              <Link to="/press">
                <Mail className="h-4 w-4 mr-2" />
                Contact Press Team
              </Link>
            </Button>
            <a
              href="mailto:press@divine.video"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              press@divine.video
            </a>
          </div>
        </div>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default MediaResourcesPage;
