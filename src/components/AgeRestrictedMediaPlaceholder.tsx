import { Lock } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgeRestrictedMediaPlaceholderProps {
  actionLabel: string;
  onAction: () => void;
  title?: string;
  className?: string;
}

export function AgeRestrictedMediaPlaceholder({
  actionLabel,
  onAction,
  title,
  className,
}: AgeRestrictedMediaPlaceholderProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950 px-4 py-6 text-center text-white',
        className,
      )}
      data-testid="age-restricted-media-placeholder"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10">
        <Lock className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-wide text-white/70">
          Age-restricted
        </p>
        {title ? (
          <p className="line-clamp-2 max-w-[18rem] text-sm text-white/85">
            {title}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="secondary"
        className="bg-white text-black hover:bg-white/90"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAction();
        }}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
