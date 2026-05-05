// ABOUTME: Vertical list of member rows for a NIP-51 people list (Figma #6 design)
// ABOUTME: Each row = avatar + display_name + sub-line (NIP-05 or truncated npub), plus per-row action buttons

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { MinusCircle, DotsThree } from '@phosphor-icons/react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { usePeopleListMembers } from '@/hooks/usePeopleListMembers';
import { useRemoveFromPeopleList } from '@/hooks/usePeopleListMutations';
import { AddToPeopleListDialog } from '@/components/AddToPeopleListDialog';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { genUserName } from '@/lib/genUserName';
import type { NostrMetadata } from '@nostrify/nostrify';

// ---- helpers -----------------------------------------------------------------

const NPUB_VISIBLE_CHARS = 8;

/** Return a truncated npub for display: "npub1abc…xyz" */
function truncateNpub(npub: string): string {
  if (npub.length <= NPUB_VISIBLE_CHARS * 2) return npub;
  return `${npub.slice(0, NPUB_VISIBLE_CHARS)}…${npub.slice(-4)}`;
}

function subLine(metadata: NostrMetadata | undefined, npub: string): string {
  if (metadata?.nip05) return metadata.nip05;
  return truncateNpub(npub);
}

// ---- sub-components ----------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

interface MemberRowProps {
  memberPubkey: string;
  metadata: NostrMetadata | undefined;
  dTag: string;
  isOwner: boolean;
  editMode: boolean;
  onRemove: (memberPubkey: string) => void;
}

function MemberRow({ memberPubkey, metadata, dTag, isOwner, editMode, onRemove }: MemberRowProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  const npub = nip19.npubEncode(memberPubkey);
  const displayName = metadata?.display_name ?? metadata?.name ?? genUserName(memberPubkey);
  const profileImage = getSafeProfileImage(metadata?.picture) ?? '/user-avatar.png';
  const sub = subLine(metadata, npub);
  const showRemoveButton = editMode && isOwner;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors">
        {/* Avatar + name area — links to profile */}
        <Link
          to={`/profile/${npub}`}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <Avatar size="md" className="shrink-0">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback>{displayName.slice(0, 2)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            {/* display_name: Bricolage ExtraBold 14px */}
            <p
              className="font-extrabold text-[14px] leading-snug truncate"
              style={{ fontFamily: "'Bricolage Grotesque Variable', sans-serif" }}
            >
              {displayName}
            </p>
            {/* sub-line: Inter Regular 12px @ 75% opacity */}
            <p
              className="text-[12px] leading-snug truncate"
              style={{
                fontFamily: "'Inter Variable', sans-serif",
                opacity: 0.75,
              }}
            >
              {sub}
            </p>
          </div>
        </Link>

        {/* Trailing action button */}
        {showRemoveButton ? (
          <button
            type="button"
            aria-label="Remove member"
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={() => onRemove(memberPubkey)}
          >
            <MinusCircle weight="bold" className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="More options"
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => setOverflowOpen(true)}
          >
            <DotsThree weight="bold" className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Overflow: AddToPeopleListDialog (non-edit mode) */}
      {!showRemoveButton && (
        <AddToPeopleListDialog
          open={overflowOpen}
          onOpenChange={setOverflowOpen}
          memberPubkey={memberPubkey}
        />
      )}

      {/* Silence unused dTag warning — it's passed in for symmetry with parent props */}
      {dTag && null}
    </>
  );
}

// ---- public component --------------------------------------------------------

export interface PeopleListMembersGridProps {
  pubkey: string;
  dTag: string;
  isOwner?: boolean;
  editMode?: boolean;
}

export function PeopleListMembersGrid({
  pubkey,
  dTag,
  isOwner = false,
  editMode = false,
}: PeopleListMembersGridProps) {
  const { members, isLoading } = usePeopleListMembers(pubkey, dTag);
  const { mutateAsync: removeMember } = useRemoveFromPeopleList();

  const handleRemove = (memberPubkey: string) => {
    removeMember({ listId: dTag, memberPubkey });
  };

  if (isLoading) {
    return (
      <div>
        <LoadingSkeleton />
        <LoadingSkeleton />
        <LoadingSkeleton />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">
        Nobody on this list yet.
      </p>
    );
  }

  return (
    <div>
      {members.map((member) => (
        <MemberRow
          key={member.pubkey}
          memberPubkey={member.pubkey}
          metadata={member.metadata}
          dTag={dTag}
          isOwner={isOwner}
          editMode={editMode}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}
