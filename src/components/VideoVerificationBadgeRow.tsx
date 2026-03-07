// ABOUTME: Shared badge row for video authenticity/origin status
// ABOUTME: Renders exactly one primary badge per video using the mobile decision order

import { useState } from 'react';
import { NotDivineBadge, PossiblyAIBadge, UnverifiedBadge } from '@/components/ContentOriginBadges';
import { ProofModeBadge } from '@/components/ProofModeBadge';
import { VideoVerificationDetailsDialog } from '@/components/VideoVerificationDetailsDialog';
import { VineBadge } from '@/components/VineBadge';
import { useVideoVerification } from '@/hooks/useVideoVerification';
import { cn } from '@/lib/utils';
import type { ParsedVideoData } from '@/types/video';

interface VideoVerificationBadgeRowProps {
  video: ParsedVideoData;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

export function VideoVerificationBadgeRow({
  video,
  className,
  size = 'small',
  showDetails = true,
}: VideoVerificationBadgeRowProps) {
  const { badge } = useVideoVerification(video);
  const [open, setOpen] = useState(false);

  const badgeElement = (
    <span className={cn('inline-flex', className)}>
      {badge.kind === 'original_vine' && <VineBadge size={size} />}
      {badge.kind === 'human_made' && (
        <ProofModeBadge level={badge.tier} proofData={video.proofMode} size={size} />
      )}
      {badge.kind === 'unverified' && <UnverifiedBadge size={size} />}
      {badge.kind === 'not_divine_hosted' && <NotDivineBadge size={size} />}
      {badge.kind === 'possibly_ai_generated' && <PossiblyAIBadge size={size} />}
    </span>
  );

  if (!showDetails) {
    return badgeElement;
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex rounded-sm"
        aria-label="View video verification details"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {badgeElement}
      </button>

      <VideoVerificationDetailsDialog
        video={video}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
