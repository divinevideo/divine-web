// ABOUTME: Sub-route page for viewing videos from all members of a NIP-51 people list
// ABOUTME: Shows list name and PeopleListVideosGrid aggregating videos from all members

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { PeopleListVideosGrid } from '@/components/PeopleListVideosGrid';
import { usePeopleList } from '@/hooks/usePeopleList';
import { decodeListIdParam } from '@/lib/eventRouting';

export default function ListVideosPage() {
  const { pubkey = '', listId: rawListId = '' } = useParams<{ pubkey: string; listId: string }>();
  const navigate = useNavigate();

  const dTag = decodeListIdParam(rawListId);
  const { data: list, isLoading } = usePeopleList(pubkey, dTag);

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <p className="text-muted-foreground text-center py-12">List not found.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Top app bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-dark-green hover:bg-brand-light-green transition-colors"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft weight="bold" className="h-5 w-5" />
        </button>

        <SectionHeader as="h1" className="text-2xl truncate">
          {list.name}
        </SectionHeader>
      </div>

      {/* Videos grid */}
      <PeopleListVideosGrid pubkey={pubkey} dTag={dTag} />
    </div>
  );
}
