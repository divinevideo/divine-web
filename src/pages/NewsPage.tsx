// ABOUTME: News page displaying press releases and media coverage about Divine
// ABOUTME: Links to press releases and articles about the platform

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, FileText } from 'lucide-react';
import { MarketingLayout } from '@/components/MarketingLayout';

const NEWS_OUTLETS = [
  {
    name: 'Yahoo',
    logo: '/logos/yahoo.png',
    url: 'https://www.yahoo.com/news/article/what-to-know-about-jack-dorseys-new-vine-revival-divine-215918687.html',
  },
  {
    name: 'TechCrunch',
    logo: '/logos/techcrunch.png',
    url: 'https://techcrunch.com/2025/11/12/jack-dorsey-funds-divine-a-vine-reboot-that-includes-vines-video-archive/',
  },
  {
    name: 'Business Insider',
    logo: '/logos/businessinsider.png',
    url: 'https://www.businessinsider.com/vine-reboot-divine-jack-dorsey-andotherstuff-2025-11',
  },
  {
    name: 'Newsweek',
    logo: '/logos/newsweek.png',
    url: 'https://www.newsweek.com/divine-everything-we-know-about-vines-reboot-11048434',
  },
];

export function NewsPage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-6">Latest News</h1>
        </div>

        <div className="space-y-8">
          {/* Seen In Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-center">As seen in</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center">
              {NEWS_OUTLETS.map((outlet) => (
                <a
                  key={outlet.name}
                  href={outlet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:grayscale hover:opacity-70 transition-all duration-200"
                  aria-label={`Read about Divine on ${outlet.name}`}
                >
                  <img
                    src={outlet.logo}
                    alt={outlet.name}
                    className={
                      outlet.name === 'Newsweek' || outlet.name === 'TechCrunch'
                        ? 'h-20 w-auto object-contain'
                        : 'h-16 w-auto object-contain'
                    }
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Featured Media */}
          <div>
            <div className="space-y-6">
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <div className="flex items-start gap-6">
                    <div className="w-32 shrink-0">
                      <img
                        src="/logos/techcrunch.png"
                        alt="TechCrunch"
                        className="w-full h-auto object-contain mt-1"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <CardTitle className="text-xl">
                        <a
                          href="https://techcrunch.com/2025/11/12/jack-dorsey-funds-divine-a-vine-reboot-that-includes-vines-video-archive/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          Jack Dorsey funds diVine, a Vine reboot that includes Vine’s video archive
                        </a>
                      </CardTitle>
                      <CardDescription>November 12, 2025</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    As generative AI content starts to fill our social apps, a project to bring back Vine’s six-second looping videos is launching with Twitter co-founder Jack Dorsey’s backing. On Thursday, a new app called diVine will give access to more than 100,000 archived Vine videos, restored from an older backup that was created before Vine’s shutdown.
                  </p>
                  <a
                    href="https://techcrunch.com/2025/11/12/jack-dorsey-funds-divine-a-vine-reboot-that-includes-vines-video-archive/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1.5"
                  >
                    Read full article on TechCrunch
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <div className="flex items-start gap-6">
                    <div className="w-32 shrink-0">
                      <img
                        src="/logos/businessinsider.png"
                        alt="Business Insider"
                        className="w-full h-auto object-contain mt-1"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <CardTitle className="text-xl">
                        <a
                          href="https://www.businessinsider.com/vine-reboot-divine-jack-dorsey-andotherstuff-2025-11"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          The founder of the Jack Dorsey-backed Vine revival is fighting against AI slop
                        </a>
                      </CardTitle>
                      <CardDescription>November 13,2025</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    DiVine, a decentralized reboot of Vine backed by Jack Dorsey, is resurrecting the long-lost super-short-form video platform. Behind the revival is one of the original Twitter employees who worked closely with Dorsey, Evan Henshaw-Plath, who goes by the alias Rabble. For the founder, diVine isn't just a nostalgia play for bringing back old six-second viral videos, but a sort of protest against the walled garden of "black box" algorithms that social media apps have become, with algorithms feeding users AI-generated content.
                  </p>
                  <a
                    href="https://www.businessinsider.com/vine-reboot-divine-jack-dorsey-andotherstuff-2025-11"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1.5"
                  >
                    Read full article on Business Insider
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <div className="flex items-start gap-6">
                    <div className="w-32 shrink-0">
                      <img
                        src="/logos/newsweek.png"
                        alt="Newsweek"
                        className="w-full h-auto object-contain"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <CardTitle className="text-xl">
                        <a
                          href="https://www.newsweek.com/divine-everything-we-know-about-vines-reboot-11048434"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          diVine: Everything We Know About Vine's Reboot
                        </a>
                      </CardTitle>
                      <CardDescription>November 14, 2025</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Jack Dorsey's latest social media experiment is launching with a promise: no AI slop. Backed by the former Twitter (now X) CEO and co-founder, the reboot of Vine—called diVine—will allow users to access over 100,000 archived six-second clips from the original platform, while creating new content in what its founders say will be a human-first space, designed to resist the spread of AI-generated content.

                  </p>
                  <a
                    href="https://www.newsweek.com/divine-everything-we-know-about-vines-reboot-11048434"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1.5"
                  >
                    Read full article on Newsweek
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* More Coverage */}
          <div>
            <h2 className="text-2xl font-bold mb-4">More Coverage</h2>
            <div className="space-y-3">
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">
                        <a
                          href="https://www.vice.com/en/article/vine-relaunches-as-divine/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          Vine Relaunches as Divine
                        </a>
                      </h3>
                      <p className="text-sm text-muted-foreground">Vice • November 18, 2025</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">
                        <a
                          href="https://stuff.co.za/2025/11/17/light-start-do-it-for-divine-send-a-ride/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          Light Start: Do it for diVine, Send a Ride
                        </a>
                      </h3>
                      <p className="text-sm text-muted-foreground">Stuff.co.za • November 17, 2025</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">
                        <a
                          href="https://www.cnn.com/2025/11/14/business/video/divine-jack-dorsey-cli-hrzn"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          Divine: Jack Dorsey's Vine revival
                        </a>
                      </h3>
                      <p className="text-sm text-muted-foreground">CNN • November 14, 2025</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">
                        <a
                          href="https://www.yahoo.com/news/article/what-to-know-about-jack-dorseys-new-vine-revival-divine-215918687.html"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          What to know about Jack Dorsey's new Vine revival, Divine
                        </a>
                      </h3>
                      <p className="text-sm text-muted-foreground">Yahoo News • November 14, 2025</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Press Releases */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Press Releases</h2>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl">
                        <a
                          href="/diVine%20launch%20press%20release%2011.13.25.pdf"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          Vine Revisited - A Return to the Halcyon Days of the Internet
                        </a>
                      </CardTitle>
                      <CardDescription>
                        November 13, 2025 • Press Release
                      </CardDescription>
                    </div>
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    With a grant funded by Jack Dorsey, Rabble has created diVine - an open source revival of Vine videos and its six-second video creation capabilities.
                  </p>
                  <a
                    href="/diVine%20launch%20press%20release%2011.13.25.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Read full press release →
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default NewsPage;
