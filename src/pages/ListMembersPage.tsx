// ABOUTME: Sub-route page for viewing members of a NIP-51 people list
// ABOUTME: Shows list name, member count, and PeopleListMembersGrid; owner gets add button

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from '@phosphor-icons/react';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { PeopleListMembersGrid } from '@/components/PeopleListMembersGrid';
import { usePeopleList } from '@/hooks/usePeopleList';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { decodeListIdParam, buildListEditPath } from '@/lib/eventRouting';

export default function ListMembersPage() {
  const { pubkey = '', listId: rawListId = '' } = useParams<{ pubkey: string; listId: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const dTag = decodeListIdParam(rawListId);
  const { data: list, isLoading } = usePeopleList(pubkey, dTag);

  const isOwner = Boolean(user?.pubkey && user.pubkey === pubkey);

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-4 w-24" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <p className="text-muted-foreground text-center py-12">List not found.</p>
      </div>
    );
  }

  const memberCount = list.members.length;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Top app bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
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

        {isOwner && (
          <button
            type="button"
            aria-label="Add member"
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-brand-dark-green text-white hover:opacity-90 transition-opacity brand-sticker"
            onClick={() => navigate(buildListEditPath(pubkey, dTag))}
          >
            <Plus weight="bold" className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Sub-line: member count */}
      <p className="text-sm text-muted-foreground px-1">
        {memberCount} {memberCount === 1 ? 'person' : 'people'}
      </p>

      {/* Members list */}
      <PeopleListMembersGrid
        pubkey={pubkey}
        dTag={dTag}
        isOwner={false}
        editMode={false}
      />
    </div>
  );
}
