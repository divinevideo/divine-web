// ABOUTME: Modal component for displaying comments only (no video replay)
// ABOUTME: Uses CommentsSection for NIP-22 comments

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { cn } from '@/lib/utils';
import type { ParsedVideoData } from '@/types/video';
import type { NostrEvent } from '@nostrify/nostrify';

interface VideoCommentsModalProps {
  video: ParsedVideoData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoadingComments?: boolean;
  className?: string;
}

export function VideoCommentsModal({
  video,
  open,
  onOpenChange,
  isLoadingComments = false,
  className,
}: VideoCommentsModalProps) {
  // CRITICAL: Use the original event if available to preserve all tags
  // Kind 34236 is an addressable event that REQUIRES a 'd' tag (vineId) to properly
  // filter comments. Without the original event's tags, all videos would query for
  // comments using the same addressable identifier (34236:pubkey:), causing all
  // videos to show the same comments.
  const videoEvent: NostrEvent = video.originalEvent || {
    id: video.id,
    pubkey: video.pubkey,
    created_at: video.createdAt,
    kind: video.kind,
    content: video.content,
    tags: [
      ['url', video.videoUrl],
      ...(video.title ? [['title', video.title]] : []),
      ...video.hashtags.map(tag => ['t', tag]),
      ...(video.thumbnailUrl ? [['thumb', video.thumbnailUrl]] : []),
      ...(video.duration ? [['duration', video.duration.toString()]] : []),
      // Include vineId as 'd' tag for addressable events
      ...(video.vineId ? [['d', video.vineId]] : []),
    ],
    sig: '', // Signature would be provided by actual event
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-2xl w-full max-h-[90vh] p-0 gap-0 overflow-hidden',
          className
        )}
        data-testid="video-comments-modal"
        data-video-id={video.id}
      >
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            {video.title || 'Comments'}
          </DialogTitle>
        </DialogHeader>

        {/* Just Comments - No Video */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] px-6 py-6">
          {isLoadingComments ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading comments...</p>
            </div>
          ) : (
            <CommentsSection
              root={videoEvent}
              title="Comments"
              emptyStateMessage="No comments yet"
              emptyStateSubtitle="Be the first to comment on this video!"
              compact={true}
              data-testid="comments-section"
              data-root-kind={video.kind.toString()}
              data-root-id={video.id}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}