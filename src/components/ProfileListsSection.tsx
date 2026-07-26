// ABOUTME: Mixed people-list and video-list discovery shelf for public profiles

import { nip19 } from 'nostr-tools';
import { Link } from 'react-router-dom';
import { ProfileListCard } from '@/components/ProfileListCard';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { usePeopleLists } from '@/hooks/usePeopleLists';
import { useVideoLists } from '@/hooks/useVideoLists';
import { mergeProfileLists } from '@/lib/profileLists';

export function ProfileListsSection({ pubkey }: { pubkey: string }) {
  const peopleQuery = usePeopleLists(pubkey);
  const videoQuery = useVideoLists(pubkey);
  const lists = mergeProfileLists(peopleQuery.data ?? [], videoQuery.data ?? []);
  const isLoading = peopleQuery.isLoading || videoQuery.isLoading;

  if (!isLoading && lists.length === 0) return null;

  return (
    <section aria-labelledby="profile-lists-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader id="profile-lists-heading" className="text-xl">Lists</SectionHeader>
        <Link
          to={`/profile/${nip19.npubEncode(pubkey)}/lists`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          See all
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && lists.length === 0
          ? Array.from({ length: 3 }, (_, index) => (
              <Skeleton
                key={index}
                data-list-skeleton
                className="h-32 rounded-[22px]"
              />
            ))
          : lists.slice(0, 3).map((list) => (
              <ProfileListCard key={list.key} list={list} />
            ))}
      </div>
    </section>
  );
}
