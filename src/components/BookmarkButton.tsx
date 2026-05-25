import { BookmarkSimple, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useBookmarkVideo, useBookmarkedVideoIds } from '@/hooks/useBookmarks';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface BookmarkButtonProps {
  videoId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function BookmarkButton({
  videoId,
  size = 'md',
  showLabel = false,
  className,
}: BookmarkButtonProps) {
  const { user } = useCurrentUser();
  const { openLoginDialog } = useLoginDialog();
  const { data: bookmarkedIds = [] } = useBookmarkedVideoIds();
  const { mutate: toggleBookmark, isPending } = useBookmarkVideo();

  const isBookmarked = bookmarkedIds.includes(videoId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      openLoginDialog();
      return;
    }

    toggleBookmark({ videoId });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        'flex items-center gap-1 transition-colors disabled:opacity-50',
        showLabel && 'px-2 py-1 rounded-md',
        className
      )}
    >
      {isPending ? (
        <Loader2 className={cn(SIZE_CLASSES[size], 'animate-spin')} />
      ) : (
        <BookmarkSimple
          className={cn(
            SIZE_CLASSES[size],
            isBookmarked ? 'text-brand-green' : 'text-muted-foreground',
            !isBookmarked && 'opacity-70 hover:opacity-100'
          )}
          weight={isBookmarked ? 'fill' : 'regular'}
        />
      )}
      {showLabel && (
        <span
          className={cn(
            'text-xs',
            isBookmarked ? 'text-brand-green' : 'text-muted-foreground'
          )}
        >
          {isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </span>
      )}
    </button>
  );
}
