// ABOUTME: Hashtag discovery page showing trending and popular hashtags
// ABOUTME: Includes search functionality and hashtag statistics with enhanced explorer

import { HashtagExplorer } from '@/components/HashtagExplorer';
import { AppPage, AppPageHeader } from '@/components/AppPage';
import { DiscoverySectionNav } from '@/components/DiscoverySectionNav';

export function HashtagDiscoveryPage() {
  return (
    <AppPage width="wide">
      <AppPageHeader
        eyebrow="Conversation clusters"
        title="Hashtags"
        description="Follow live topics, niches, and recurring community memes."
      >
        <DiscoverySectionNav active="hashtags" />
      </AppPageHeader>

      <HashtagExplorer />
    </AppPage>
  );
}

export default HashtagDiscoveryPage;
