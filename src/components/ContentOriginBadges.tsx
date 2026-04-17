// ABOUTME: Badge variants for unverified, external content, and AI warning states
// ABOUTME: Mirrors the mobile app's fallback badge labels when no proof-backed badge applies

import { Question as CircleHelp, CloudSlash as CloudOff, Warning as TriangleAlert } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ContentOriginBadgeProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export function UnverifiedBadge({ className, size = 'small' }: ContentOriginBadgeProps) {
  const sizeConfig = getSizeConfig(size);

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 border-slate-500 bg-slate-900/70 text-slate-200',
        sizeConfig.className,
        className,
      )}
      title="Unverified"
    >
      <CircleHelp className={sizeConfig.iconSize} />
      <span>Unverified</span>
    </Badge>
  );
}

export function NotDivineBadge({ className, size = 'small' }: ContentOriginBadgeProps) {
  const sizeConfig = getSizeConfig(size);

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 border-slate-600 bg-slate-900/70 text-slate-300',
        sizeConfig.className,
        className,
      )}
      title="Not Divine Hosted"
    >
      <CloudOff className={sizeConfig.iconSize} />
      <span>Not Divine Hosted</span>
    </Badge>
  );
}

export function PossiblyAIBadge({ className, size = 'small' }: ContentOriginBadgeProps) {
  const sizeConfig = getSizeConfig(size);

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 border-amber-500 bg-[#2E1F00] text-amber-400',
        sizeConfig.className,
        className,
      )}
      title="Possibly AI-Generated"
    >
      <TriangleAlert className={sizeConfig.iconSize} />
      <span>Possibly AI-Generated</span>
    </Badge>
  );
}

function getSizeConfig(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'small':
      return {
        className: 'text-[10px] px-1.5 py-0.5',
        iconSize: 'h-3 w-3',
      };
    case 'medium':
      return {
        className: 'text-[11px] px-2 py-1',
        iconSize: 'h-3.5 w-3.5',
      };
    case 'large':
      return {
        className: 'text-xs px-2.5 py-1.5',
        iconSize: 'h-4 w-4',
      };
  }
}
