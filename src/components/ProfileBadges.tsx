// ABOUTME: Badge display row for user profiles - shows up to 5 badge thumbnails at 32px
// ABOUTME: Clicking a badge opens the BadgeDetailModal with full details

import { useState } from 'react';
import { getBadgeImageUrl, type ValidatedBadge } from '@/lib/badges';
import { BadgeDetailModal } from '@/components/BadgeDetailModal';
import { BadgeImage } from '@/components/BadgeImage';
import { cn } from '@/lib/utils';
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
}

export function ProfileBadges({ badges, className }: ProfileBadgesProps) {
  const [selectedBadge, setSelectedBadge] = useState<ValidatedBadge | null>(null);

  if (!badges.length) {
    return null;
  }

  const displayBadges = badges.slice(0, MAX_PROFILE_BADGES);
  const remaining = badges.length - MAX_PROFILE_BADGES;

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-2', className)} data-testid="profile-badges">
        <div className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-muted/35 px-2.5 py-1.5 shadow-sm">
          <span className="pl-0.5 text-[11px] font-semibold text-muted-foreground/80">
            Badges
          </span>
          <TooltipProvider delayDuration={300}>
            {displayBadges.map((badge) => {
              const thumbUrl = getBadgeImageUrl(badge.definition, 32);

              return (
                <Tooltip key={badge.definition.naddr}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSelectedBadge(badge)}
                      className={cn(
                        'rounded-full border border-background/80 bg-background shadow-sm transition-transform hover:-translate-y-0.5 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary',
                        badge.definition.isOfficial
                          ? 'ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.28)]'
                          : 'ring-1 ring-border/60',
                      )}
                      data-testid={`badge-${badge.definition.dTag}`}
                    >
                      <BadgeImage
                        src={thumbUrl}
                        alt={badge.definition.name}
                        className="h-9 w-9 rounded-full object-cover"
                        fallbackInnerClassName="scale-[0.88]"
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
            <span className="rounded-full bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
              +{remaining}
            </span>
          )}
        </div>
      </div>

      <BadgeDetailModal
        badge={selectedBadge}
        open={!!selectedBadge}
        onOpenChange={(open) => !open && setSelectedBadge(null)}
      />
    </>
  );
}
