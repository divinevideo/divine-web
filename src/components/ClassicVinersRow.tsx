// ABOUTME: Horizontal scrollable row of classic Vine creators
// ABOUTME: Uses static preloaded data for instant rendering, no API calls needed

import { useEffect } from 'react';
import { SmartLink } from '@/components/SmartLink';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star } from '@phosphor-icons/react';
import { CLASSIC_VINERS, CLASSIC_VINER_AVATARS, type StaticViner } from '@/data/classicViners';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { nip19 } from 'nostr-tools';

/**
 * Single viner avatar item
 */
function VinerItem({ viner }: { viner: StaticViner }) {
  const displayName = viner.name;
  const picture = getSafeProfileImage(viner.picture) || '/user-avatar.png';

  // Use npub for URL
  let profilePath = `/profile/${viner.pubkey}`;
  try {
    const npub = nip19.npubEncode(viner.pubkey);
    profilePath = `/${npub}`;
  } catch {
    // Fall back to hex pubkey
  }

  return (
    <SmartLink
      to={profilePath}
      ownerPubkey={viner.pubkey}
      className="flex flex-col items-center gap-1.5 min-w-[72px] group"
    >
      <Avatar size="xl" className="ring-2 ring-brand-light-green transition-all group-hover:ring-brand-green dark:ring-brand-dark-green dark:group-hover:ring-brand-green">
        <AvatarImage src={picture} alt={displayName} loading="eager" />
        <AvatarFallback className="text-xs">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground truncate max-w-[70px] group-hover:text-foreground transition-colors">
        {displayName}
      </span>
    </SmartLink>
  );
}

/**
 * Preload avatar images for faster rendering
 */
function usePreloadAvatars() {
  useEffect(() => {
    // Preload avatars in the background
    CLASSIC_VINER_AVATARS.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, []);
}

/**
 * ClassicVinersRow - Horizontal scrollable row of popular Vine creators
 *
 * Uses static precomputed data bundled with the app for instant rendering.
 * No API calls needed - data is from CLASSIC_VINERS constant.
 */
export function ClassicVinersRow() {
  // Preload avatar images
  usePreloadAvatars();

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Classic Viners</h3>
      </div>

      {/* Scrollable row */}
      <div className="relative group">
        {/* Scrollable container */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {CLASSIC_VINERS.map((viner) => (
            <VinerItem key={viner.pubkey} viner={viner} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ClassicVinersRow;
