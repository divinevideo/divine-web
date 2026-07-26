// ABOUTME: Public gallery for all people and video lists published by one profile

import { ArrowLeft, ListBullets } from '@phosphor-icons/react';
import { nip19 } from 'nostr-tools';
import { Link, useParams } from 'react-router-dom';
import { ProfileListCard } from '@/components/ProfileListCard';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePeopleLists } from '@/hooks/usePeopleLists';
import { useVideoLists } from '@/hooks/useVideoLists';
import { mergeProfileLists } from '@/lib/profileLists';

function decodeProfilePubkey(identifier: string | undefined): string | null {
  if (!identifier) return null;
  if (/^[0-9a-fA-F]{64}$/.test(identifier)) return identifier;

  try {
    const decoded = nip19.decode(identifier);
    return decoded.type === 'npub' ? decoded.data : null;
  } catch {
    return null;
  }
}

function ListsGallery({ pubkey, profileIdentifier }: { pubkey: string; profileIdentifier: string }) {
  const peopleQuery = usePeopleLists(pubkey);
  const videoQuery = useVideoLists(pubkey);
  const lists = mergeProfileLists(peopleQuery.data ?? [], videoQuery.data ?? []);
  const peopleLists = lists.filter((list) => list.type === 'people');
  const videoLists = lists.filter((list) => list.type === 'videos');
  const isLoading = peopleQuery.isLoading || videoQuery.isLoading;

  const grid = (items: typeof lists) => {
    if (isLoading && items.length === 0) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-[22px]" />
          ))}
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Nothing listed here yet.
        </div>
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((list) => <ProfileListCard key={list.key} list={list} />)}
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Link
        to={`/profile/${profileIdentifier}`}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to profile
      </Link>
      <div className="mb-7 flex items-center gap-3">
        <ListBullets className="h-8 w-8 text-primary" aria-hidden="true" />
        <div>
          <SectionHeader className="text-3xl">Lists</SectionHeader>
          <p className="text-muted-foreground">People to meet and videos worth looping.</p>
        </div>
      </div>
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList aria-label="List type">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{grid(lists)}</TabsContent>
        <TabsContent value="people">{grid(peopleLists)}</TabsContent>
        <TabsContent value="videos">{grid(videoLists)}</TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProfileListsPage() {
  const { npub } = useParams<{ npub: string }>();
  const pubkey = decodeProfilePubkey(npub);

  if (!pubkey || !npub) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <SectionHeader className="text-2xl">That profile link is not valid.</SectionHeader>
      </div>
    );
  }

  return <ListsGallery pubkey={pubkey} profileIdentifier={npub} />;
}
