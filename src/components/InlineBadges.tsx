// ABOUTME: Tiny inline badge icons (16px) shown next to username in video feed
// ABOUTME: Shows up to 3 badges, official badges get gold border

import { useState } from 'react';
import { getBadgeImageUrl, type ValidatedBadge } from '@/lib/badges';
import { BadgeDetailModal } from '@/components/BadgeDetailModal';

const MAX_INLINE_BADGES = 3;

interface InlineBadgesProps {
  badges: ValidatedBadge[];
  className?: string;
}

export function InlineBadges({ badges, className }: InlineBadgesProps) {
  const [selectedBadge, setSelectedBadge] = useState<ValidatedBadge | null>(null);

  if (!badges.length) return null;

  const displayBadges = badges.slice(0, MAX_INLINE_BADGES);

  return (
    <>
      <span className={`inline-flex items-center gap-0.5 ${className || ''}`} data-testid="inline-badges">
        {displayBadges.map((badge) => {
          const thumbUrl = getBadgeImageUrl(badge.definition, 16);
          if (!thumbUrl) return null;

          return (
            <button
              key={badge.definition.naddr}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedBadge(badge);
              }}
              className={`rounded-full overflow-hidden flex-shrink-0 ${
                badge.definition.isOfficial
                  ? 'ring-1 ring-yellow-400'
                  : ''
              }`}
            >
              <img
                src={thumbUrl}
                alt={badge.definition.name}
                className="w-4 h-4 object-cover"
                loading="lazy"
              />
            </button>
          );
        })}
      </span>

      <BadgeDetailModal
        badge={selectedBadge}
        open={!!selectedBadge}
        onOpenChange={(open) => !open && setSelectedBadge(null)}
      />
    </>
  );
}
