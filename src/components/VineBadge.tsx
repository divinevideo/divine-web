// ABOUTME: Badge component for displaying original Vine video indicator
// ABOUTME: Shows the classic Vine logo for videos migrated from original Vine platform

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface VineBadgeProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export function VineBadge({ className, size = 'small' }: VineBadgeProps) {
  const sizeConfig = getSizeConfig(size);

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1',
        'border-brand-green bg-brand-light-green text-brand-dark-green',
        sizeConfig.className,
        className
      )}
      title="Original Vine archive preserved from the Internet Archive"
      style={{ fontFamily: 'Pacifico, cursive' }}
    >
      <VineIcon className={sizeConfig.iconSize} />
      <span>Original</span>
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
