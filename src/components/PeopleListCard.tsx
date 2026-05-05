// ABOUTME: Discovery card for a NIP-51 people list (Figma #1/#2 design)
// ABOUTME: Shows a mosaic media area with member avatars, member count badge, title and description

import { Link } from 'react-router-dom';
import { UsersThree } from '@phosphor-icons/react';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { buildListPath } from '@/lib/eventRouting';
import type { PeopleList } from '@/types/peopleList';

// ---- helpers -----------------------------------------------------------------

/**
 * Derive a deterministic hue (0–359) from a hex pubkey string so placeholder
 * swatches are visually distinct without fetching any avatar.
 */
function pubkeyToHue(pubkey: string): number {
  let hash = 0;
  for (let i = 0; i < Math.min(pubkey.length, 8); i++) {
    hash = (hash * 31 + pubkey.charCodeAt(i)) & 0xffff;
  }
  return hash % 360;
}

function PlaceholderSwatch({ pubkey, className }: { pubkey: string; className?: string }) {
  const hue = pubkeyToHue(pubkey);
  return (
    <div
      data-testid="avatar-placeholder"
      className={className}
      style={{
        backgroundColor: `hsl(${hue}, 55%, 65%)`,
        borderRadius: 4,
      }}
    />
  );
}

function AvatarTile({
  src,
  pubkey,
  className,
}: {
  src?: string;
  pubkey: string;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={className}
        style={{ objectFit: 'cover', borderRadius: 4 }}
        loading="lazy"
      />
    );
  }
  return <PlaceholderSwatch pubkey={pubkey} className={className} />;
}

// ---- media mosaic ------------------------------------------------------------
// Layout:  [ big tile (66%) | stack of 2 small tiles (34%) ]
// Ratio:   177:120 (≈ 1.475 wide)

const CARD_HEIGHT = 120;
const CARD_WIDTH = 177;
const SMALL_HEIGHT = CARD_HEIGHT / 2;

interface MediaMosaicProps {
  members: Array<{ pubkey: string; metadata?: { picture?: string } }>;
  memberCount: number;
}

function MediaMosaic({ members, memberCount }: MediaMosaicProps) {
  const big = members[0];
  const topSmall = members[1];
  const bottomSmall = members[2];

  return (
    <div
      className="relative overflow-hidden rounded-lg shrink-0"
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
    >
      {/* Big tile — left ~66% */}
      {big ? (
        <AvatarTile
          src={big.metadata?.picture}
          pubkey={big.pubkey}
          className="absolute top-0 left-0"
          style={{
            width: '66%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 0,
          } as React.CSSProperties}
        />
      ) : (
        <PlaceholderSwatch
          pubkey="placeholder-big"
          className="absolute top-0 left-0"
          style={{ width: '66%', height: '100%', borderRadius: 0 } as React.CSSProperties}
        />
      )}

      {/* Right column — two stacked small tiles */}
      <div
        className="absolute top-0 right-0 flex flex-col"
        style={{ width: '34%', height: '100%' }}
      >
        {topSmall ? (
          <AvatarTile
            src={topSmall.metadata?.picture}
            pubkey={topSmall.pubkey}
            className="w-full"
            style={{ height: SMALL_HEIGHT, objectFit: 'cover', borderRadius: 0 } as React.CSSProperties}
          />
        ) : (
          <PlaceholderSwatch
            pubkey="placeholder-top"
            className="w-full"
            style={{ height: SMALL_HEIGHT, borderRadius: 0 } as React.CSSProperties}
          />
        )}
        {bottomSmall ? (
          <AvatarTile
            src={bottomSmall.metadata?.picture}
            pubkey={bottomSmall.pubkey}
            className="w-full"
            style={{ height: SMALL_HEIGHT, objectFit: 'cover', borderRadius: 0 } as React.CSSProperties}
          />
        ) : (
          <PlaceholderSwatch
            pubkey="placeholder-bottom"
            className="w-full"
            style={{ height: SMALL_HEIGHT, borderRadius: 0 } as React.CSSProperties}
          />
        )}
      </div>

      {/* Member count badge — bottom-left scrim */}
      {memberCount > 0 && (
        <div
          data-testid="member-count-badge"
          className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-white text-xs font-semibold"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
        >
          <UsersThree weight="bold" className="h-3.5 w-3.5" />
          {memberCount}
        </div>
      )}
    </div>
  );
}

// ---- public component --------------------------------------------------------

export interface PeopleListCardProps {
  list: PeopleList;
  /** Optional preloaded avatar data for up to 3 members */
  membersPreview?: Array<{ pubkey: string; metadata?: { picture?: string } }>;
}

export function PeopleListCard({ list, membersPreview }: PeopleListCardProps) {
  const href = buildListPath(list.pubkey, list.id);

  // Build the 3-slot member array used by the mosaic.
  // Prefer membersPreview when provided; fall back to pubkey-only stubs from list.members.
  const mosaicMembers: Array<{ pubkey: string; metadata?: { picture?: string } }> =
    membersPreview && membersPreview.length > 0
      ? membersPreview.slice(0, 3)
      : list.members.slice(0, 3).map((pubkey) => ({ pubkey }));

  return (
    <Link
      to={href}
      className="flex flex-col gap-2 rounded-lg overflow-hidden hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark-green"
      aria-label={list.name}
    >
      <MediaMosaic members={mosaicMembers} memberCount={list.members.length} />

      {/* Text area */}
      <div className="px-0.5">
        <SectionHeader as="h3" className="text-[14px] leading-snug line-clamp-1">
          {list.name}
        </SectionHeader>

        {list.description && (
          <p
            className="text-[12px] leading-snug line-clamp-2 mt-0.5"
            style={{
              fontFamily: "'Inter Variable', sans-serif",
              opacity: 0.75,
            }}
          >
            {list.description}
          </p>
        )}
      </div>
    </Link>
  );
}
