// ABOUTME: Frequently Asked Questions page for diVine Web
// ABOUTME: Answers common questions about the platform, Nostr, and how to use diVine

import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  HelpCircle,
  Video,
  Shield,
  Key,
  Globe,
  Upload,
  Settings,
  Hash
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ZendeskWidget } from '@/components/ZendeskWidget';
import { MarketingLayout } from '@/components/MarketingLayout';

function FAQQuestion({
  value,
  question,
  children
}: {
  value: string;
  question: string;
  children: React.ReactNode;
}) {
  const handleHashClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = `${window.location.pathname}#${value}`;
    window.history.pushState({}, '', url);
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <AccordionItem value={value} id={value}>
      <AccordionTrigger className="group">
        <div className="flex items-center justify-between w-full pr-2">
          <span className="text-left">{question}</span>
          <a
            href={`#${value}`}
            onClick={handleHashClick}
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Copy link to this question"
          >
            <Hash className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </a>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

export function FAQPage() {
  const [openItem, setOpenItem] = useState<string>('');

  useEffect(() => {
    // Handle hash navigation on page load
    if (window.location.hash) {
      const hash = window.location.hash.substring(1);
      setOpenItem(hash);
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, []);

  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ZendeskWidget />
      <div className="text-center space-y-4 mb-8">
        <div className="flex items-center justify-center gap-3">
          <HelpCircle className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold">Frequently Asked Questions</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Everything you need to know about diVine
        </p>
      </div>

      <div className="space-y-8">
        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full" value={openItem} onValueChange={setOpenItem}>
              <FAQQuestion value="what-is" question="What is diVine?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    diVine is an independent short-form video app inspired by Vine's creative 6-second format.
                    It allows you to create and share looping videos using the decentralized Nostr protocol,
                    making your content censorship-resistant and truly owned by you.
                  </p>
                  <p>
                    Unlike traditional social media platforms, diVine doesn't store your data on centralized
                    servers. Instead, it uses the Nostr protocol to distribute your content across a network
                    of independent relays.
                  </p>
                  <p className="font-semibold">
                    diVine has no affiliation with X (formerly Twitter) or the original Vine platform.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="different" question="How is diVine different from TikTok or Instagram Reels?">
                <div className="text-muted-foreground space-y-2">
                  <p><strong>You own your content:</strong> Your videos are cryptographically signed with your private keys,
                  proving ownership.</p>
                  <p><strong>Decentralized:</strong> No single company controls the platform or can delete your content.</p>
                  <p><strong>Censorship-resistant:</strong> Built on Nostr, making it nearly impossible to censor.</p>
                  <p><strong>No algorithms:</strong> You choose what you see, or pick from community-created algorithms.</p>
                  <p><strong>Open source:</strong> The code is public and anyone can contribute or build their own client.</p>
                  <p><strong>6-second loops:</strong> Inspired by Vine's format, keeping it simple and creative.</p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="vine-videos" question="What happened to videos from the original Vine platform?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    When Twitter shut down Vine in 2017, volunteer archivists at{' '}
                    <a href="https://wiki.archiveteam.org/index.php/Vine" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      ArchiveTeam
                    </a>{' '}
                    preserved many videos through Internet Archive efforts before they disappeared forever.
                  </p>
                  <p>
                    diVine (an independent app with no affiliation to Vine or Twitter/X) has imported these
                    archived videos, giving them a permanent home on the decentralized web. These videos are
                    marked with a special badge to indicate they're from the Internet Archive.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="classic-vines" question="How many archived videos have been imported?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    So far, we've successfully imported from the Internet Archive:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Around 170,000 archived videos</strong></li>
                    <li><strong>About 62,000 creator accounts</strong></li>
                  </ul>

                  <p className="font-semibold mt-4">
                    Not all old videos are recovered yet
                  </p>
                  <p>
                    The recovery effort is ongoing. Many more videos likely exist in various archives,
                    including the Common Crawl dataset (the same data AI companies use for training).
                    However, working through Common Crawl has been beyond the scope of this project so far.
                  </p>

                  <p className="font-semibold mt-4">
                    What else needs to be restored?
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      <strong>Millions of comments:</strong> We have comments data from the archives,
                      but haven't restored them yet. This is a priority for future development.
                    </li>
                    <li>
                      <strong>User avatars:</strong> We've recovered some profile pictures from the archives
                      and the goal is to restore those as well.
                    </li>
                  </ul>

                  <div className="mt-4 pt-4 border-t">
                    <p className="font-semibold mb-2">Want to help with digital archaeology?</p>
                    <p>
                      We welcome help in the digital archaeology efforts to recover more archived videos! If you have
                      expertise in data recovery, archive research, or access to old backups, please{' '}
                      <Link to="/support" className="text-primary hover:underline">
                        get in touch
                      </Link>
                      . Every recovered video helps preserve internet culture history.
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t bg-brand-dark-green p-4 rounded-lg border border-brand-green">
                    <p className="font-semibold mb-2 text-brand-off-white">Do you have old videos to share?</p>
                    <p className="text-brand-light-green">
                      If you have collections of archived short-form videos (with or without metadata), we'd love to
                      have them to help preserve them on Divine! Whether it's a handful of videos or an
                      extensive archive, every contribution helps preserve this important piece of internet
                      culture. Please{' '}
                      <Link to="/support" className="text-brand-green hover:text-brand-light-green">
                        contact us
                      </Link>
                      {' '}to share your collection.
                    </p>
                  </div>
                </div>
              </FAQQuestion>

              <FAQQuestion value="vine-account-recovery" question="How do I claim my archived creator account?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    <strong>We're working on building an account recovery system.</strong>
                  </p>
                  <p>
                    Users who can prove they owned an account from the original Vine platform (through
                    associated Twitter, Instagram, Musically/TikTok, or YouTube accounts) will be able to
                    claim their diVine account and receive login credentials.
                  </p>
                  <p className="font-semibold">
                    This feature isn't ready yet.
                  </p>
                  <p>
                    diVine is a one-person dev project, and these things take time. Please{' '}
                    <Link to="/support" className="text-primary hover:underline">
                      email us
                    </Link>
                    {' '}about your account, but please have patience as we work to build this system.
                  </p>

                  <div className="mt-4 pt-4 border-t">
                    <p className="font-semibold mb-2">Want your archived content taken down?</p>
                    <p>
                      If you want your archived content removed from Divine, we will need evidence
                      that it's yours. Please file a{' '}
                      <Link to="/dmca" className="text-primary hover:underline">
                        DMCA takedown request
                      </Link>
                      {' '}with proof of ownership, and we'll process it accordingly.
                    </p>
                  </div>
                </div>
              </FAQQuestion>

              <FAQQuestion value="missing-vine" question="Where is a specific video I'm looking for?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    We're actively working to load more archived videos into the system, but unfortunately
                    the archive team was only able to save a small percentage of videos that existed on
                    the original Vine platform.
                  </p>
                  <p>
                    <strong>Many videos are lost to history.</strong> Some may only exist on Twitter's
                    servers but are no longer publicly accessible. When Twitter shut down Vine in 2017,
                    not all content was archived, and much of it disappeared permanently.
                  </p>
                  <p>
                    If you're looking for a specific video that isn't on Divine, it's possible it was never
                    archived or has been lost. However, we continue to search for and import recovered
                    videos as new archives are discovered.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="who-built" question="Who built Divine?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    diVine was created by{' '}
                    <a
                      href="https://rabblelabs.com/about"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      @rabble
                    </a>
                    , a long-time advocate for decentralized social media and open-source software.
                  </p>
                  <p>
                    This project was funded by a grant from{' '}
                    <a
                      href="https://andotherstuff.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      And Other Stuff
                    </a>
                    , an organization supporting innovative projects in decentralized technology and
                    open-source development.
                  </p>
                  <p>
                    diVine is open source, and we welcome contributions from the community. Check out our{' '}
                    <a
                      href="https://github.com/rabble/divine-web"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      web app
                    </a>{' '}
                    and{' '}
                    <a
                      href="https://github.com/rabble/nostrvine"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Flutter app
                    </a>{' '}
                    repositories on GitHub to learn more or get involved.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="rabble-name" question="How did Rabble get their name?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    In the 1990s, Rabble started an activist website called{' '}
                    <a
                      href="http://protest.net"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      protest.net
                    </a>{' '}
                    and helped build the media activist network{' '}
                    <a
                      href="http://indymedia.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      indymedia.org
                    </a>
                    . In that work, they didn't want to use their real name online, so they set up a contact
                    email: rabble-rousers@protest.net. That got shortened to "rabble."
                  </p>
                  <p>
                    When Odeo (the company that became Twitter) started, there were two Evans on the team:
                    Rabble and Evan Williams. To keep everyone from getting confused, Mr. Williams went by "Ev"
                    and Rabble used their username around the office. It stuck, and the nickname migrated from
                    online to the real world.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="jack-dorsey-ownership" question="Does Jack Dorsey own all or part of diVine?">
                <div className="text-muted-foreground space-y-3">
                  <p>
                    No. While Jack Dorsey is providing funding for diVine, it is not an investment and he holds no equity in, or ownership of diVine.
                  </p>
                  <p>
                    Jack Dorsey explains his support:
                  </p>
                  <blockquote className="border-l-4 border-brand-green pl-4 italic text-sm">
                    "Nostr - the underlying open source protocol being used by Divine - is empowering developers to create a new generation of apps without the need for VC-backing, toxic business models or huge teams of engineers. The reason I funded the non-profit, and Other Stuff, is to allow creative engineers like Rabble to show what's possible in this new world, by using permissionless protocols which can't be shut down based on the whim of a corporate owner."
                  </blockquote>
                </div>
              </FAQQuestion>
            </Accordion>
          </CardContent>
        </Card>

        {/* Accounts & Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Accounts & Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full" value={openItem} onValueChange={setOpenItem}>
              <FAQQuestion value="create-account" question="How do I create an account?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    <strong>Mobile app:</strong> The diVine iOS app automatically creates new Nostr keys for you when you first open it.
                    No registration required - you can start posting immediately!
                  </p>
                  <p>
                    <strong>Web app:</strong> You have several options:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Browser extension:</strong> Use extensions like Alby, nos2x, or Flamingo</li>
                    <li><strong>Private key (advanced):</strong> Import your existing Nostr private key (nsec)</li>
                    <li><strong>Remote signer:</strong> Use a bunker URL for secure remote signing</li>
                  </ul>
                  <p className="mt-2">
                    <strong>Optional:</strong> If you want a username@divine.video address, you can register for one after creating your account.
                    This is completely optional - most users don't need it.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="nostr" question="What is Nostr?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    Nostr (Notes and Other Stuff Transmitted by Relays) is a simple, open protocol that
                    enables censorship-resistant social media. Instead of storing data on one company's servers,
                    Nostr distributes content across many independent relays.
                  </p>
                  <p>
                    Your account is just a public/private key pair - no email, phone number, or personal
                    information required. This means true ownership and privacy.
                  </p>
                  <p>
                    Learn more at{' '}
                    <a href="https://nostr.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      nostr.org
                    </a>
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="multiple-devices" question="Can I use my account on multiple devices?">
                <div className="text-muted-foreground">
                  <p>
                    Yes! Since Nostr is decentralized, you can use your account on any Nostr client
                    (diVine web, diVine iOS app, or any other Nostr app) by importing your private key
                    or connecting your browser extension. Your profile and content will appear the same
                    across all clients.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="lost-key" question="What if I lose my private key?">
                <div className="text-muted-foreground space-y-2">
                  <p className="font-semibold text-destructive">
                    Important: There is NO password recovery on Nostr!
                  </p>
                  <p>
                    If you lose your private key (nsec), you lose access to your account permanently.
                    This is the trade-off for true decentralization - no company can recover your account,
                    but also no company can lock you out.
                  </p>
                  <p>
                    We strongly recommend:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Save your private key in a password manager</li>
                    <li>Write it down on paper and store it securely</li>
                    <li>Use a browser extension that securely stores your key</li>
                    <li>Or use a password manager to store your key securely</li>
                  </ul>
                </div>
              </FAQQuestion>

              <FAQQuestion value="divine-username" question="Can I get a username@divine.video address?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    Yes! We're currently beta testing a username registration system that allows you to
                    claim a human-readable address like username@divine.video (also known as a NIP-05 identifier).
                  </p>
                  <p>
                    <strong>What is a NIP-05 identifier?</strong>
                  </p>
                  <p>
                    A NIP-05 identifier is an email-like address that makes it easier for people to find and
                    verify you on Nostr. Instead of sharing a long public key (npub), you can share
                    username@divine.video.
                  </p>
                  <p>
                    <strong>Is it required?</strong>
                  </p>
                  <p>
                    No! This is completely optional. Most users don't need a NIP-05 identifier to use Divine.
                    Your Nostr public key works perfectly fine for posting, following, and interacting on the platform.
                  </p>
                  <p>
                    <strong>Beta Testing Status:</strong>
                  </p>
                  <p>
                    The username registration system is currently in beta testing. If you're interested in
                    claiming a username@divine.video address, stay tuned for announcements about when
                    registration opens to all users.
                  </p>
                </div>
              </FAQQuestion>
            </Accordion>
          </CardContent>
        </Card>

        {/* Posting & Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Posting & Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full" value={openItem} onValueChange={setOpenItem}>
              <FAQQuestion value="post-video" question="How do I post a video?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    Currently, you can post videos using the diVine mobile apps.
                    The web version supports browsing and viewing videos, with posting features coming soon.
                  </p>
                  <p>
                    iOS TestFlight is currently full (10k signups in 4 hours!). Stay tuned for updates on mobile app availability.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="video-requirements" question="What are the video requirements?">
                <div className="text-muted-foreground">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Length:</strong> 6 seconds maximum (just like original Vine!)</li>
                    <li><strong>Format:</strong> MP4</li>
                    <li><strong>Loop:</strong> Videos automatically loop for the perfect vine experience</li>
                    <li><strong>Size:</strong> Recommended max 10MB for best performance</li>
                  </ul>
                </div>
              </FAQQuestion>

              <FAQQuestion value="edit-delete" question="Can I edit or delete my videos?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    <strong>Yes!</strong> You can delete any video you've posted and edit your video records
                    (such as titles, descriptions, and hashtags) at any time.
                  </p>
                  <p>
                    <strong>How deletion works:</strong> When you delete a video, diVine removes it from our
                    systems and sends a deletion request to all Nostr relays. Most relays honor these deletion
                    requests. However, because Nostr is decentralized, some relays may retain copies - this is
                    the trade-off for a censorship-resistant platform.
                  </p>
                  <p>
                    <strong>Editing metadata:</strong> You can update your video's information (title, description,
                    hashtags) by editing the event record. Changes will propagate across the Nostr network.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="hashtags" question="How do hashtags work?">
                <div className="text-muted-foreground">
                  <p>
                    Add hashtags to your video description (like #comedy or #skateboarding) to help
                    others discover your content. You can browse videos by hashtag using the hashtag
                    discovery page or by clicking on any hashtag in a video description.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="lists" question="Can I create and curate lists of videos?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    <strong>Yes! This is a feature that every user can use on Divine.</strong>
                  </p>
                  <p>
                    On the original Vine, only Vine employees could curate lists for categories and
                    "Editor's Choice" collections. Now on Divine, this powerful curation tool is open
                    to all users!
                  </p>
                  <p>
                    <strong>What you can do with lists:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Create themed collections of videos (e.g., "Best Comedy Vines", "Skateboarding Tricks", "Cooking Tips")</li>
                    <li>Organize your favorite videos into personalized playlists</li>
                    <li>Share curated collections with others</li>
                    <li>Follow lists created by other users to discover great content</li>
                    <li>Build "Editor's Choice" style collections for your own niche or community</li>
                  </ul>
                  <p>
                    Lists use Nostr's NIP-51 (Lists) protocol, making them decentralized and portable
                    across different Nostr clients. Your lists belong to you and can be accessed from
                    any compatible app.
                  </p>
                  <p>
                    This democratization of curation means the best collections are built by passionate
                    community members, not just platform employees!
                  </p>
                </div>
              </FAQQuestion>
            </Accordion>
          </CardContent>
        </Card>

        {/* Privacy & Safety */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy & Safety
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full" value={openItem} onValueChange={setOpenItem}>
              <FAQQuestion value="privacy" question="Is my content private?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    No, all content on diVine is public by default. Nostr is designed as a public
                    protocol similar to Twitter or Instagram. Everything you post can be seen by anyone.
                  </p>
                  <p>
                    However, your personal information is more private than traditional social media
                    because you don't need to provide email, phone number, or real name to use Divine.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="moderation" question="diVine trust and safety guidelines and policy">
                <div className="text-muted-foreground space-y-2">
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="font-semibold text-destructive mb-2">
                      Zero Tolerance for Objectionable Content
                    </p>
                    <p>
                      diVine maintains a strict zero-tolerance policy for objectionable content and abusive users.
                      By using Divine, you agree to our{' '}
                      <Link to="/terms" className="text-primary hover:underline font-semibold">
                        Terms of Service
                      </Link>
                      {' '}which prohibit:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                      <li>Child Sexual Abuse Material (CSAM)</li>
                      <li>Illegal activities and content</li>
                      <li>Harassment, abuse, and hate speech</li>
                      <li>Violence and threats</li>
                      <li>Spam and malicious content</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold mb-2">Content Filtering</p>
                    <p>We filter objectionable content using:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>CSAM hash-matching through Cloudflare and BunnyCDN</li>
                      <li>AI-powered content analysis</li>
                      <li>Human moderation review</li>
                      <li>User reports and community moderation</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold mb-2">User Tools for Blocking Abusive Users</p>
                    <p>You have multiple tools to protect yourself:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Block users to prevent all interactions</li>
                      <li>Mute users to hide their content</li>
                      <li>Report objectionable content for review</li>
                      <li>Subscribe to community-created moderation lists</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold mb-2">Composable Moderation</p>
                    <p>
                      diVine uses composable moderation, similar to Bluesky's approach. Instead of one
                      central moderator, you can:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Choose which moderation lists you want to follow</li>
                      <li>Create your own moderation lists</li>
                      <li>Subscribe to community-created moderation lists</li>
                      <li>Control what you see while respecting different community standards</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-brand-dark-green border border-brand-green rounded-lg">
                    <p className="font-semibold mb-2 text-brand-off-white">Decentralized Network & Limited Responsibility</p>
                    <p className="mb-2 text-brand-light-green">
                      The diVine app can connect to multiple servers (relays and media servers) across the
                      decentralized Nostr network. <strong className="text-brand-off-white">We only bear responsibility for content hosted on
                      our own servers.</strong>
                    </p>
                    <p className="mb-2 text-brand-light-green">
                      Content on other servers is moderated according to their operators' policies. When you
                      use Divine, you may see content from various servers with different moderation standards.
                    </p>
                    <p className="text-brand-light-green">
                      <strong className="text-brand-off-white">Run your own servers:</strong> If you want different moderation policies, you're
                      welcome to run your own Nostr relays and Blossom media servers with whatever policies you
                      prefer. The diVine app can connect to any compatible server.
                    </p>
                  </div>

                  <p>
                    <Link to="/safety" className="text-primary hover:underline">
                      Learn more about our safety standards
                    </Link>
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="report" question="How do I report inappropriate content?">
                <div className="text-muted-foreground space-y-2">
                  <div className="p-3 bg-brand-dark-green border border-brand-green rounded-lg">
                    <p className="font-semibold text-destructive mb-2">
                      24-Hour Response Commitment
                    </p>
                    <p className="font-semibold text-brand-off-white">
                      We commit to reviewing and responding to all objectionable content reports within 24 hours.
                    </p>
                    <p className="mt-2 text-brand-light-green">
                      For reports of illegal content (especially CSAM), our response is immediate. We will remove
                      the content, ban the violating account, and report to appropriate authorities.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold mb-2">How to Report Content</p>
                    <p>
                      You can report content using Nostr's reporting system (NIP-56), which creates a
                      public report that both diVine moderators and your followers can see. Reports help build
                      community-driven moderation through trust networks.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold mb-2">For Severe Issues</p>
                    <p>
                      For illegal content, CSAM, or DMCA violations, please contact us immediately through
                      the{' '}
                      <Link to="/support" className="text-primary hover:underline">
                        support page
                      </Link>.
                    </p>
                    <p className="mt-2">
                      You can also report CSAM directly to NCMEC's{' '}
                      <a
                        href="https://www.cybertipline.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        CyberTipline
                      </a>.
                    </p>
                  </div>

                  <p>
                    Review our{' '}
                    <Link to="/dmca" className="text-primary hover:underline">
                      DMCA policy
                    </Link>
                    {' '}for copyright violations and our{' '}
                    <Link to="/safety" className="text-primary hover:underline">
                      Safety Standards
                    </Link>
                    {' '}for more information about content moderation.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="block" question="Can I block users?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    Yes! You can block any user, and their content won't appear in your feeds.
                    Blocking is stored in your account and follows you across all Nostr clients.
                  </p>
                  <p className="font-semibold">
                    Important: Blocks have limitations on decentralized platforms
                  </p>
                  <p>
                    Just like with Bluesky, blocks on diVine don't prevent users from seeing your content
                    if they want to use special tools or alternative clients. Our primary app attempts to
                    respect your blocks, but it's not a foolproof system.
                  </p>
                  <p className="text-destructive font-semibold">
                    Don't use diVine for private videos.
                  </p>
                  <p>
                    All videos posted to diVine are public by default. If you need true privacy for video content,
                    don't post it on Divine.
                  </p>
                  <p className="font-semibold">
                    Direct messages ARE private
                  </p>
                  <p>
                    However, direct messages between users are end-to-end encrypted. We cannot read your
                    messages that you send between users or when you share videos privately via DM. Your
                    private conversations are truly private.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="ai-data-selling" question="Is diVine going to sell our data or content to AI companies?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    No, diVine is not in the business of selling user data or content to AI companies for training.
                    We don't do it, we won't do it.
                  </p>
                  <p>
                    We can't stop AI companies which want to ignore terms of service and people's copyright from
                    scraping publicly accessible data, just like it's hard to stop AI companies from scraping
                    publicly available websites.
                  </p>
                </div>
              </FAQQuestion>
            </Accordion>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Features & Interactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full" value={openItem} onValueChange={setOpenItem}>
              <FAQQuestion value="ai-detection" question="How do you prove it's not AI?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    diVine uses multiple layers of verification to distinguish authentic, human-created
                    content from AI-generated videos:
                  </p>

                  <div>
                    <p className="font-semibold mb-1">1. User Reporting</p>
                    <p>
                      Our community helps identify AI-generated content through our reporting system.
                      When users report content as AI-generated, those reports are shared with your followers
                      through our composable moderation system, creating trust networks for content filtering.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">2. ProofMode Verification</p>
                    <p>
                      Videos shot directly in the diVine mobile app can use ProofMode to cryptographically
                      prove they were captured on a real phone camera, not generated by AI. ProofMode creates
                      verifiable signatures that confirm the video's authenticity.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">3. Machine Learning Detection</p>
                    <p>
                      We use advanced machine learning techniques to analyze videos and detect:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>AI-generated content patterns and artifacts</li>
                      <li>Videos recorded off another screen (screen recordings)</li>
                      <li>Synthetic media characteristics</li>
                    </ul>
                  </div>

                  <p className="font-semibold text-orange-600 dark:text-orange-400">
                    Important: No AI detection system is foolproof
                  </p>
                  <p>
                    While we do our best to identify AI-generated content, detection technology is constantly
                    evolving alongside AI generation capabilities. We combine multiple approaches - technical
                    verification, machine learning, and community reporting - to provide the most robust
                    protection possible.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="proofmode" question="What is ProofMode?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    ProofMode is a system for cryptographically proving that videos were captured
                    by a real camera, not generated by AI. It includes:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Device hardware attestation</li>
                    <li>OpenPGP signatures</li>
                    <li>Content hashes and timestamps</li>
                  </ul>
                  <p>
                    Videos with ProofMode verification show a special badge, helping you trust
                    that what you're watching is authentic.
                  </p>
                  <p>
                    <Link to="/proofmode" className="text-primary hover:underline">
                      Learn more about ProofMode
                    </Link>
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="algorithms" question="Can I choose my own algorithm?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    Yes! diVine supports multiple feed algorithms:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Home:</strong> Videos from people you follow</li>
                    <li><strong>Discovery:</strong> All recent videos</li>
                    <li><strong>Trending:</strong> Most popular videos by engagement</li>
                    <li><strong>Hashtags:</strong> Videos tagged with specific topics</li>
                  </ul>
                  <p>
                    In the future, we'll support custom algorithms created by the community using
                    Nostr's DVM (Data Vending Machine) system.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="relays" question="What are relays and can I choose which ones to use?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    Relays are servers that store and distribute Nostr events. Think of them like
                    email servers - they relay your messages to others.
                  </p>
                  <p>
                    diVine uses specific relays optimized for video content, but you can configure
                    your own relay list if you prefer. Using multiple relays ensures your content
                    stays available even if one relay goes down.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="monetization" question="Can I monetize my content?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    <strong>Yes - this is a priority feature we're building!</strong> One of the major problems
                    with the original Vine was that there was no way for Viners to make money from their content.
                    This led many creators to leave the platform, contributing to Vine's eventual shutdown.
                  </p>
                  <p>
                    diVine fixes this fundamental problem. Because you're in control of your account and content
                    using Nostr, this new system can never be taken away from you.
                  </p>

                  <div>
                    <p className="font-semibold mb-1">Future Paid Features</p>
                    <p>
                      Similar to Twitch, we'll also be providing paid accounts for additional services in the future.
                      Premium features might include:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Enhanced analytics and creator tools</li>
                      <li>Priority video hosting and delivery</li>
                      <li>Subscriber-only content features</li>
                      <li>Advanced customization options</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-brand-dark-green border border-brand-green rounded-lg">
                    <p className="font-semibold mb-2 text-brand-off-white">Always Open and Permissionless</p>
                    <p className="text-brand-light-green">
                      The diVine system will always be open source using permissionless open protocols. This means:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mt-2 text-brand-light-green">
                      <li>You own your audience - they follow you, not the platform</li>
                      <li>You can take your content and followers to any compatible client</li>
                      <li>No platform lock-in or arbitrary account termination</li>
                      <li>The code is transparent and auditable by anyone</li>
                    </ul>
                    <p className="mt-2 text-brand-light-green">
                      This fundamental architecture ensures that creators can build sustainable businesses on Divine
                      without fear of losing everything if the platform changes direction.
                    </p>
                  </div>
                </div>
              </FAQQuestion>
            </Accordion>
          </CardContent>
        </Card>

        {/* Technical */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Technical Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full" value={openItem} onValueChange={setOpenItem}>
              <FAQQuestion value="open-source" question="Is diVine open source?">
                <div className="text-muted-foreground">
                  <p>
                    Yes! diVine is completely open source. You can view the code, contribute improvements,
                    or even run your own version of Divine:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                    <li>
                      <a
                        href="https://github.com/rabble/nostrvine"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        iOS/Flutter App on GitHub
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://github.com/rabble/divine-web"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Web App on GitHub
                      </a>
                    </li>
                  </ul>
                </div>
              </FAQQuestion>

              <FAQQuestion value="hosting" question="Where are videos stored?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    <strong>CDN Delivery:</strong> diVine uses Cloudflare and BunnyCDN to deliver videos
                    quickly and efficiently to users around the world.
                  </p>
                  <p>
                    <strong>Blossom Server Storage:</strong> Videos are stored on Blossom servers, which are
                    decentralized media servers for Nostr. Users can choose among many Blossom media servers
                    in the app to host their content.
                  </p>
                  <p>
                    This decentralized approach means:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>You can choose which Blossom server hosts your videos</li>
                    <li>You can run your own Blossom server if you prefer</li>
                    <li>Videos aren't locked to one provider</li>
                    <li>Community members can help host content</li>
                    <li>Content is delivered globally via Cloudflare and BunnyCDN for best performance</li>
                  </ul>
                </div>
              </FAQQuestion>

              <FAQQuestion value="mobile-app" question="Is there a mobile app?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    Yes! diVine mobile apps are available in beta for both iOS and Android.
                    Both apps include camera recording, video upload, and all viewing features.
                  </p>
                  <p className="text-muted-foreground">
                    iOS TestFlight is currently full (10k signups in 4 hours!). Stay tuned for updates.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="other-apps" question="Can I use other Nostr apps with my diVine account?">
                <div className="text-muted-foreground">
                  <p>
                    Absolutely! Your Nostr account works across all Nostr applications. You can use
                    the same account for diVine videos, Damus for text posts, Amethyst for Android,
                    and many other Nostr clients. Your profile and follows sync across all of them.
                  </p>
                </div>
              </FAQQuestion>

              <FAQQuestion value="cost" question="Do I need cryptocurrency to use Divine?">
                <div className="text-muted-foreground space-y-2">
                  <p>
                    <strong>No!</strong> You can browse, post, and interact with diVine completely free.
                    diVine doesn't require any cryptocurrency or payment to use.
                  </p>
                  <p>
                    diVine is <strong>not</strong> a blockchain, cryptocurrency, Bitcoin, or "Web3" project.
                    While diVine uses the Nostr protocol (a decentralized communication protocol), it has nothing
                    to do with cryptocurrency, NFTs, or blockchain technology. It's simply a video sharing platform
                    that gives you control over your content.
                  </p>
                </div>
              </FAQQuestion>
            </Accordion>
          </CardContent>
        </Card>

        {/* Still have questions? */}
        <Card className="bg-brand-dark-green border-brand-green">
          <CardHeader>
            <CardTitle className="text-brand-off-white">Still have questions?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-brand-light-green">
              We're here to help! Check out these resources:
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link to="/about">About Divine</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/support">Contact Support</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/privacy">Privacy Policy</Link>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="https://nostr.org"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn About Nostr
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default FAQPage;
