// ABOUTME: Public detail page for a NIP-51 people list with member videos as primary content

import { ArrowLeft, UsersThree } from '@phosphor-icons/react';
import { nip19 } from 'nostr-tools';
import { Link, useParams } from 'react-router-dom';
import { PeopleListMembers } from '@/components/PeopleListMembers';
import { VideoGrid } from '@/components/VideoGrid';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePeopleList } from '@/hooks/usePeopleLists';
import { usePeopleListVideos } from '@/hooks/usePeopleListVideos';

function PeopleListContent({ pubkey, listId }: { pubkey: string; listId: string }) {
  const listQuery = usePeopleList(pubkey, listId);
  const memberPubkeys = listQuery.data?.memberPubkeys ?? [];
  const videosQuery = usePeopleListVideos(memberPubkeys);
  const videos = videosQuery.data?.pages.flatMap((page) => page.videos) ?? [];

  if (listQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (listQuery.isError || (listQuery.isFetched && !listQuery.data)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <SectionHeader className="text-2xl">That people list could not be found.</SectionHeader>
      </div>
    );
  }

  const list = listQuery.data;
  if (!list) return null;

  return (
    <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
      <Link
        to={`/profile/${nip19.npubEncode(pubkey)}/lists`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to lists
      </Link>

      <header className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-light-green dark:bg-brand-dark-green">
          <UsersThree className="h-7 w-7 text-brand-dark-green dark:text-brand-green" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">People list</p>
          <SectionHeader as="h2" className="text-3xl">{list.name}</SectionHeader>
          {list.description && <p className="mt-2 text-muted-foreground">{list.description}</p>}
        </div>
      </header>

      <PeopleListMembers pubkeys={list.memberPubkeys} />

      <section aria-labelledby="people-list-videos-heading" className="space-y-4">
        <div>
          <SectionHeader id="people-list-videos-heading" className="text-2xl">Videos</SectionHeader>
          <p className="text-sm text-muted-foreground">Recent loops from everyone in this list.</p>
        </div>
        {list.memberPubkeys.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            Add people to this list and their loops will land here.
          </p>
        ) : videosQuery.isLoading ? (
          <VideoGrid videos={[]} loading />
        ) : videos.length > 0 ? (
          <>
            <VideoGrid videos={videos} />
            {videosQuery.hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => videosQuery.fetchNextPage()}
                  disabled={videosQuery.isFetchingNextPage}
                >
                  {videosQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            No loops from these people yet.
          </p>
        )}
      </section>
    </div>
  );
}

export default function PeopleListDetailPage() {
  const { pubkey, listId } = useParams<{ pubkey: string; listId: string }>();
  const isValidPubkey = Boolean(pubkey && /^[0-9a-fA-F]{64}$/.test(pubkey));

  if (!isValidPubkey || !pubkey || !listId) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <SectionHeader className="text-2xl">That people list link is not valid.</SectionHeader>
      </div>
    );
  }

  return <PeopleListContent pubkey={pubkey} listId={listId} />;
}
