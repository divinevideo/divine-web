// ABOUTME: Badge display row for user profiles - shows up to 5 badge thumbnails at 32px
// ABOUTME: Clicking a badge opens the BadgeDetailModal with full details

import { useState } from 'react';
import { getBadgeImageUrl, type ValidatedBadge } from '@/lib/badges';
import { BadgeDetailModal } from '@/components/BadgeDetailModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const MAX_PROFILE_BADGES = 5;

interface ProfileBadgesProps {
  badges: ValidatedBadge[];
  className?: string;
  isOwnProfile?: boolean;
}

export function ProfileBadges({ badges, className, isOwnProfile }: ProfileBadgesProps) {
  const [selectedBadge, setSelectedBadge] = useState<ValidatedBadge | null>(null);

  if (!badges.length) {
    return null;
  }

  const displayBadges = badges.slice(0, MAX_PROFILE_BADGES);
  const remaining = badges.length - MAX_PROFILE_BADGES;

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className || ''}`} data-testid="profile-badges">
        <TooltipProvider delayDuration={300}>
          {displayBadges.map((badge) => {
            const thumbUrl = getBadgeImageUrl(badge.definition, 32);
            if (!thumbUrl) return null;

            return (
              <Tooltip key={badge.definition.naddr}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSelectedBadge(badge)}
                    className={`rounded-full overflow-hidden flex-shrink-0 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary ${
                      badge.definition.isOfficial
                        ? 'ring-2 ring-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.3)]'
                        : ''
                    }`}
                    data-testid={`badge-${badge.definition.dTag}`}
                  >
                    <img
                      src={thumbUrl}
                      alt={badge.definition.name}
                      className="w-8 h-8 object-cover"
                      loading="lazy"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {badge.definition.name}
                  {badge.definition.isOfficial && ' ✦'}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
        {remaining > 0 && (
          <span className="text-xs text-muted-foreground ml-1">+{remaining}</span>
        )}
      </div>

      {isOwnProfile && (
        <a
          href="https://badges.page"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="manage-badges-link"
        >
          Manage your badges on badges.page →
        </a>
      )}

      <BadgeDetailModal
        badge={selectedBadge}
        open={!!selectedBadge}
        onOpenChange={(open) => !open && setSelectedBadge(null)}
      />
    </>
  );
}
