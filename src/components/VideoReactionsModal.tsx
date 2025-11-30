import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Repeat2, Loader2 } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import { enhanceAuthorData } from '@/lib/generateProfile';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { cn } from '@/lib/utils';
import type { VideoReactions } from '@/hooks/useVideoReactions';

interface VideoReactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reactions: VideoReactions | undefined;
  isLoading?: boolean;
  type: 'likes' | 'reposts';
}

function ReactionUserItem({ pubkey, timestamp }: { pubkey: string; timestamp: number }) {
  const authorData = useAuthor(pubkey);
  const author = enhanceAuthorData(authorData.data, pubkey);
  const metadata = author.metadata;

  const npub = nip19.npubEncode(pubkey);
  const displayName = authorData.isLoading
    ? "Loading..."
    : (metadata?.display_name || metadata?.name || `${npub.slice(0, 12)}...`);
  const profileImage = getSafeProfileImage(metadata?.picture);
  const profileUrl = `/${npub}`;

  const date = new Date(timestamp * 1000);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });

  return (
    <Link
      to={profileUrl}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
      onClick={(e) => {
        // Close modal when clicking on a user
        e.stopPropagation();
      }}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </Link>
  );
}

export function VideoReactionsModal({
  open,
  onOpenChange,
  reactions,
  isLoading = false,
  type,
}: VideoReactionsModalProps) {
  // Prefetch all author data
  const pubkeys = reactions
    ? [...reactions.likes.map(r => r.pubkey), ...reactions.reposts.map(r => r.pubkey)]
    : [];
  useBatchedAuthors(pubkeys);

  const items = type === 'likes' ? reactions?.likes : reactions?.reposts;
  const count = items?.length ?? 0;
  const title = type === 'likes' ? 'Likes' : 'Reposts';
  const Icon = type === 'likes' ? Heart : Repeat2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-md w-full max-h-[80vh] p-0 gap-0 overflow-hidden'
        )}
        data-testid="video-reactions-modal"
      >
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Icon className={cn('h-5 w-5', type === 'likes' && 'fill-red-500 text-red-500')} />
            {title} ({count})
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading {title.toLowerCase()}...</p>
              </div>
            </div>
          ) : !items || items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <Icon className={cn('h-12 w-12 text-muted-foreground/50 mb-4', type === 'likes' && 'fill-muted-foreground/50')} />
              <p className="text-muted-foreground">No {title.toLowerCase()} yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Be the first to {type === 'likes' ? 'like' : 'repost'} this video!
              </p>
            </div>
          ) : (
            <div className="px-2 py-2">
              {items.map((reaction) => (
                <ReactionUserItem
                  key={reaction.eventId}
                  pubkey={reaction.pubkey}
                  timestamp={reaction.timestamp}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

