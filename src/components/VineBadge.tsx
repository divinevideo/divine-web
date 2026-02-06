// ABOUTME: Badge component for displaying original Vine video indicator
// ABOUTME: Shows the classic Vine logo for videos migrated from original Vine platform

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface VineBadgeProps {
  className?: string;
}

export function VineBadge({ className }: VineBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 text-xs',
        'border-brand-green bg-brand-light-green text-brand-dark-green',
        className
      )}
      title="Archived - Video preserved from Internet Archive (2013-2017 era)"
      style={{ fontFamily: 'Pacifico, cursive' }}
    >
      <VineIcon className="h-3 w-3" />
      <span>Archived</span>
    </Badge>
  );
}

// Classic Vine logo icon (V in Pacifico font)
function VineIcon({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ fontFamily: 'Pacifico, cursive', fontSize: '1em', lineHeight: 1 }}
    >
      V
    </span>
  );
}
