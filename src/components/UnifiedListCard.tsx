// ABOUTME: Polymorphic dispatch card that renders the correct list card based on Nostr kind
// ABOUTME: kind 30000 → PeopleListCard, kind 30005 → VideoListCard

import { PeopleListCard } from './PeopleListCard';
import { VideoListCard } from './VideoListCard';
import type { PeopleList } from '@/types/peopleList';
import type { VideoList } from '@/hooks/useVideoLists';
import type { DiscoveryListPreviews } from '@/hooks/useDiscoveryListPreviews';

const PREVIEW_MEMBERS_PER_LIST = 3;

type UnifiedListInput = (
  | { kind: 30000; list: PeopleList }
  | { kind: 30005; list: VideoList }
) & {
  previews?: DiscoveryListPreviews;
};

export function UnifiedListCard(input: UnifiedListInput) {
  if (input.kind === 30000) {
    const membersPreview = input.previews
      ? input.list.members.slice(0, PREVIEW_MEMBERS_PER_LIST).map((pubkey) => ({
          pubkey,
          metadata: input.previews!.getMemberMetadata(pubkey),
        }))
      : undefined;
    return <PeopleListCard list={input.list} membersPreview={membersPreview} />;
  }
  const thumbnail = input.previews?.getVideoThumbnail(input.list.pubkey, input.list.id);
  return <VideoListCard list={input.list} thumbnail={thumbnail} />;
}
