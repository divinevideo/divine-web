// ABOUTME: Avatar link for one member of a public people list

import type { NostrMetadata } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveDisplayName } from '@/lib/resolveDisplayName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { buildProfileLinkPath } from '@/lib/profileLinks';

interface PeopleListMemberProps {
  pubkey: string;
  metadata?: NostrMetadata;
}

export function PeopleListMember({ pubkey, metadata }: PeopleListMemberProps) {
  const name = resolveDisplayName(metadata, pubkey);

  return (
    <Link
      to={buildProfileLinkPath({ pubkey })}
      className="flex w-24 shrink-0 flex-col items-center gap-2 rounded-xl p-2 text-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar size="lg">
        <AvatarImage src={getSafeProfileImage(metadata?.picture)} alt="" />
        <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="w-full truncate text-sm font-semibold">{name}</span>
    </Link>
  );
}
