// ABOUTME: Press release page for the Rewind launch announcement
// ABOUTME: Full text of "Vine Revisited" press release from November 13, 2024

import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { MarketingLayout } from '@/components/MarketingLayout';

export function PressReleasePage() {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        {/* Back link */}
        <Link
          to="/news"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to News
        </Link>

        <Card>
          <CardContent className="pt-8 pb-8 space-y-6">
            {/* Header */}
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground uppercase tracking-wide">
                Press Release
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Vine Revisited - A Return to the Halcyon Days of the Internet
              </h1>
              <p className="text-xl text-muted-foreground">
                With a grant funded by Jack Dorsey, Rabble has created a new social video app - Rewind - an open source revival of Vine videos and its six-second video creation capabilities
              </p>
              <div className="text-sm text-muted-foreground">
                Web Summit Lisbon, November 13, 2024
              </div>
            </div>

            {/* Body */}
            <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
              <p>
                Today, Rabble, one of Twitter's first employees and the person who hired Jack Dorsey, has launched Rewind, an open-source social video app built on the Nostr protocol. The project, currently in beta mode, is funded by Dorsey through his non-profit "And Other Stuff." Rewind revives the short-form video format popularized by Vine, which Dorsey shut down in early 2017 during his tenure as Twitter's CEO. The new video app reimagines the concept as a decentralized, open-source alternative.
              </p>

              <div>
                <h2 className="text-2xl font-bold mb-4">Bringing Back Beloved Vine Content & Giving Creators Owner Rights</h2>
                <p>
                  Rewind provides access to over 100,000 archived Vine videos from the Internet Archive, which until now have been inaccessible, and allows users to make their own six-second videos and follow creators they love. Original Vine creators will also be able to reclaim ownership of their content, add new content, and, if they wish, request their content and account be removed as long as their accounts had been previously verified in Twitter.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-4">Taking A Stand Against AI Slop</h2>
                <p>
                  With AI-produced content fast becoming indistinguishable from regular content, AI slop has been flooding centralized mainstream social media platforms with requirements to tag AI content being largely ignored or enforced. Rewind, which flags suspected GenAI content and prevents it from being posted, has been designed to bring back the days of 'real content made by real people'.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-4">Ad-based Algorithms Aren't the Only Approach</h2>
                <p>
                  "Social media is social first: it's about people and human connection. Vine represented an era of authentic human expression in six-second looping videos. Big tech companies want to remove the people and make all AI-generated social media apps where users are passive consumers of the algorithmic feed," says Rabble.
                </p>
                <p>
                  "I want to show people that we don't need to settle for this dystopia. The new Rewind app is built on open source permissionless open protocols, and reflects the rights I outlined in my call for a new social media Bill of Rights. With apps like Rewind we can see the alternative. It's possible to enable creators to publish engaging content, without needing to game an ad algorithm which promotes toxicity and thrives on conflict," said Rabble. "They should also have full ownership of their content, and the right to remove it if they so desire, along with the ability to be compensated for their creativity."
                </p>
                <p>
                  The Nostr protocol works just like internet or email protocols where the user chooses their web browser, or email service provider, and regardless of their choice, can still access all of their contacts and their content.
                </p>
                <p>
                  "Nostr - the underlying open source protocol being used by Rewind - is empowering developers to create a new generation of apps without the need for VC-backing, toxic business models or huge teams of engineers," says Jack Dorsey. "The reason I funded the non-profit, and Other Stuff, is to allow creative engineers like Rabble to show what's possible in this new world, by using permissionless protocols which can't be shut down based on the whim of a corporate owner."
                </p>
              </div>

              <div className="border-t pt-6">
                <p className="font-medium">
                  Rewind is open to a limited number of users for beta testing at{' '}
                  <Link to="/open-source" className="text-primary hover:underline">
                    divine.video/open-source
                  </Link>
                  .
                </p>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-xl font-bold mb-2">For more information:</h3>
                <p>
                  Alice@flockmktg.com<br />
                  +1 415 740 8174
                </p>
              </div>

              <div className="text-center text-2xl text-muted-foreground pt-6">
                ###
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </MarketingLayout>
  );
}

export default PressReleasePage;
