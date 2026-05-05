// ABOUTME: Polymorphic dispatch card that renders the correct list card based on Nostr kind
// ABOUTME: kind 30000 → PeopleListCard, kind 30005 → VideoListCard

import { PeopleListCard } from './PeopleListCard';
import { VideoListCard } from './VideoListCard';
import type { PeopleList } from '@/types/peopleList';
import type { VideoList } from '@/hooks/useVideoLists';

type UnifiedListInput =
  | { kind: 30000; list: PeopleList }
  | { kind: 30005; list: VideoList };

export function UnifiedListCard(input: UnifiedListInput) {
  if (input.kind === 30000) {
    return <PeopleListCard list={input.list} />;
  }
  return <VideoListCard list={input.list} />;
}
