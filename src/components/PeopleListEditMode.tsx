// ABOUTME: Owner curate screen for a NIP-51 people list (Figma #8)
// ABOUTME: Top bar + existing members grid (edit mode) + user search / add candidates section

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, MagnifyingGlass } from '@phosphor-icons/react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { PeopleListMembersGrid } from '@/components/PeopleListMembersGrid';
import { usePeopleList } from '@/hooks/usePeopleList';
import { useAddToPeopleList } from '@/hooks/usePeopleListMutations';
import { useSearchUsers, type SearchUserResult } from '@/hooks/useSearchUsers';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { genUserName } from '@/lib/genUserName';

// ---- props ------------------------------------------------------------------

export interface PeopleListEditModeProps {
  pubkey: string;
  dTag: string;
}

// ---- sub-components ---------------------------------------------------------

function SearchResultSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-16 rounded-xl" />
    </div>
  );
}

interface SearchResultRowProps {
  result: SearchUserResult;
  isAlreadyMember: boolean;
  dTag: string;
  onAdd: (memberPubkey: string) => void;
}

function SearchResultRow({ result, isAlreadyMember, dTag, onAdd }: SearchResultRowProps) {
  const displayName =
    result.metadata?.display_name ?? result.metadata?.name ?? genUserName(result.pubkey);
  const profileImage = getSafeProfileImage(result.metadata?.picture) ?? '/user-avatar.png';

  // Silence dTag lint warning — passed for context symmetry with parent
  void dTag;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors">
      {/* Avatar */}
      <Avatar size="md" className="shrink-0">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback>{displayName.slice(0, 2)}</AvatarFallback>
      </Avatar>

      {/* Name */}
      <div className="min-w-0 flex-1">
        <p
          className="font-extrabold text-[14px] leading-snug truncate"
          style={{ fontFamily: "'Bricolage Grotesque Variable', sans-serif" }}
        >
          {displayName}
        </p>
        {result.metadata?.nip05 && (
          <p
            className="text-[12px] leading-snug truncate"
            style={{
              fontFamily: "'Inter Variable', sans-serif",
              opacity: 0.75,
            }}
          >
            {result.metadata.nip05}
          </p>
        )}
      </div>

      {/* Add button — hidden if already a member */}
      {!isAlreadyMember && (
        <Button
          variant="sticker"
          size="sm"
          className="shrink-0"
          onClick={() => onAdd(result.pubkey)}
        >
          + Add
        </Button>
      )}
    </div>
  );
}

// ---- main component ---------------------------------------------------------

export function PeopleListEditMode({ pubkey, dTag }: PeopleListEditModeProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch list data (for the list name + current members for membership check)
  const { data: list } = usePeopleList(pubkey, dTag);

  // Add-member mutation
  const { mutateAsync: addMember } = useAddToPeopleList();

  // User search driven by the local search query
  const { data: searchResults = [], isLoading: isSearchLoading } = useSearchUsers({
    query: searchQuery,
    limit: 20,
  });

  const memberSet = new Set(list?.members ?? []);

  const listName = list?.name ?? dTag;

  function handleAdd(memberPubkey: string) {
    addMember({ listId: dTag, memberPubkey });
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* ---- Top bar ---- */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        {/* Back arrow */}
        <button
          type="button"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-brand-dark-green hover:bg-brand-light-green transition-colors"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft weight="bold" className="h-5 w-5" />
        </button>

        {/* List title */}
        <SectionHeader as="h1" className="text-xl flex-1 text-center px-2 truncate">
          {listName}
        </SectionHeader>

        {/* Confirm / done icon button — navigates back */}
        <button
          type="button"
          aria-label="Done editing"
          className="flex h-9 w-9 items-center justify-center rounded-full text-brand-dark-green hover:bg-brand-light-green transition-colors"
          onClick={() => navigate(-1)}
        >
          <Check weight="bold" className="h-5 w-5" />
        </button>
      </div>

      {/* ---- Section 1: current members in edit mode ---- */}
      <div>
        <PeopleListMembersGrid
          pubkey={pubkey}
          dTag={dTag}
          isOwner
          editMode
        />
      </div>

      {/* ---- Section 2: search + add candidates ---- */}
      <div className="flex flex-col gap-3 px-4 pt-4">
        {/* Divider label */}
        <p
          className="text-sm font-semibold text-muted-foreground"
          style={{ fontFamily: "'Inter Variable', sans-serif" }}
        >
          Add people
        </p>

        {/* Search input */}
        <div className="relative">
          <MagnifyingGlass
            weight="bold"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Search for someone to add"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Search results */}
      <div className="flex flex-col mt-2">
        {/* Empty state — before any query */}
        {!searchQuery.trim() && (
          <p className="text-center text-muted-foreground py-6 text-sm px-4">
            Search for someone to add.
          </p>
        )}

        {/* Loading */}
        {searchQuery.trim() && isSearchLoading && (
          <>
            <SearchResultSkeleton />
            <SearchResultSkeleton />
          </>
        )}

        {/* Results */}
        {searchQuery.trim() && !isSearchLoading && searchResults.map((result) => (
          <SearchResultRow
            key={result.pubkey}
            result={result}
            isAlreadyMember={memberSet.has(result.pubkey)}
            dTag={dTag}
            onAdd={handleAdd}
          />
        ))}

        {/* No results state */}
        {searchQuery.trim() && !isSearchLoading && searchResults.length === 0 && (
          <p className="text-center text-muted-foreground py-6 text-sm px-4">
            Nobody found. Try a different name?
          </p>
        )}
      </div>
    </div>
  );
}
