// ABOUTME: Header component for the people-list detail page (Figma #4 / #7 mobile design)
// ABOUTME: Shows title, stats, avatar strip, and owner/follow action buttons

import { Link } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { usePeopleListMembers } from '@/hooks/usePeopleListMembers';
import { buildListMembersPath } from '@/lib/eventRouting';
import type { PeopleList } from '@/types/peopleList';

export interface PeopleListDetailHeaderProps {
  pubkey: string;
  dTag: string;
  list: PeopleList;
  stats?: { members: number; videos: number | null; loops: number | null };
  isOwner: boolean;
  isFollowing: boolean;
  onFollowToggle?: () => void;
  onEdit?: () => void;
  onBack?: () => void;
}

const AVATAR_STRIP_MAX = 5;
const AVATAR_OVERLAP_PX = 10;

function fmtStat(value: number | null | undefined): string {
  if (value == null) return '—';
  return String(value);
}

export function PeopleListDetailHeader({
  pubkey,
  dTag,
  list,
  stats,
  isOwner,
  isFollowing,
  onFollowToggle,
  onEdit,
  onBack,
}: PeopleListDetailHeaderProps) {
  const { members } = usePeopleListMembers(pubkey, dTag);
  const avatarMembers = members.slice(0, AVATAR_STRIP_MAX);
  const membersPath = buildListMembersPath(pubkey, dTag);

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Top row: back arrow + action button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-brand-dark-green hover:bg-brand-light-green transition-colors"
        >
          <ArrowLeft weight="bold" className="h-5 w-5" />
        </button>

        {isOwner ? (
          <Button
            variant="sticker"
            size="sm"
            onClick={onEdit}
          >
            Edit list
          </Button>
        ) : (
          <Button
            variant="sticker"
            size="sm"
            onClick={onFollowToggle}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        )}
      </div>

      {/* List title */}
      <SectionHeader as="h1" className="text-2xl">
        {list.name}
      </SectionHeader>

      {/* Stats row */}
      <p
        data-testid="people-list-stats"
        className="text-sm text-muted-foreground"
      >
        {fmtStat(stats?.members)} members
        {' · '}
        {fmtStat(stats?.videos)} videos
        {' · '}
        {fmtStat(stats?.loops)} loops
      </p>

      {/* Description */}
      {list.description && (
        <p className="text-sm text-foreground line-clamp-3 overflow-hidden">
          {list.description}
        </p>
      )}

      {/* Avatar strip */}
      {avatarMembers.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {avatarMembers.map((member, index) => (
              <div
                key={member.pubkey}
                className="relative"
                style={{ marginLeft: index === 0 ? 0 : -AVATAR_OVERLAP_PX }}
              >
                <Avatar size="xs">
                  {member.metadata?.picture && (
                    <AvatarImage
                      src={member.metadata.picture}
                      alt={member.metadata?.name ?? 'Member'}
                    />
                  )}
                  <AvatarFallback>
                    {(member.metadata?.name ?? '?').slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              </div>
            ))}
          </div>

          <Link
            to={membersPath}
            className="text-sm font-medium text-brand-dark-green hover:underline"
          >
            View all &gt;
          </Link>
        </div>
      )}
    </div>
  );
}
