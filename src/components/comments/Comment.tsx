import { useState } from 'react';
import { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { useComments, getDirectReplies } from '@/hooks/useComments';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMuteItem } from '@/hooks/useModeration';
import { useDeleteComment } from '@/hooks/useDeleteComment';
import { CommentForm } from './CommentForm';
import { NoteContent } from '@/components/NoteContent';
import { SmartLink } from '@/components/SmartLink';
import { ReportContentDialog } from '@/components/ReportContentDialog';
import { DeleteCommentDialog } from '@/components/DeleteCommentDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MessageSquare, ChevronDown, ChevronRight, MoreHorizontal, Flag, Volume2, Trash2, CornerDownRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { genUserName } from '@/lib/genUserName';
import { MuteType } from '@/types/moderation';
import { useToast } from '@/hooks/useToast';

interface CommentProps {
  root: NostrEvent | URL;
  comment: NostrEvent;
  depth?: number;
  maxDepth?: number;
  limit?: number;
  parentComment?: NostrEvent; // Parent comment for reply context
}

export function Comment({ root, comment, depth = 0, maxDepth = 3, limit, parentComment }: CommentProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(depth < 2); // Auto-expand first 2 levels
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportType, setReportType] = useState<'comment' | 'user'>('comment');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { user } = useCurrentUser();
  const author = useAuthor(comment.pubkey);
  const { data: commentsData } = useComments(root, limit);
  const { mutate: muteItem } = useMuteItem();
  const { mutate: deleteComment, isPending: isDeleting } = useDeleteComment();
  const { toast } = useToast();

  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(comment.pubkey)
  const timeAgo = formatDistanceToNow(new Date(comment.created_at * 1000), { addSuffix: true });

  // Get direct replies to this comment
  const replies = commentsData ? getDirectReplies(commentsData.allComments, comment.id) : [];
  const hasReplies = replies.length > 0;

  const isOwnComment = user?.pubkey === comment.pubkey;
  
  // Check if this is an optimistic (pending) comment
  const isOptimistic = '_optimistic' in comment && (comment as { _optimistic?: boolean })._optimistic === true;

  // Parent comment data (passed as prop when this is a reply)
  const parentAuthor = useAuthor(parentComment?.pubkey || '');
  const parentMetadata = parentAuthor.data?.metadata;
  const parentDisplayName = parentComment ? (parentMetadata?.name ?? genUserName(parentComment.pubkey)) : '';

  const handleReportComment = () => {
    setReportType('comment');
    setShowReportDialog(true);
  };

  const handleReportUser = () => {
    setReportType('user');
    setShowReportDialog(true);
  };

  const handleMuteUser = () => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'You must be logged in to mute users',
        variant: 'destructive',
      });
      return;
    }

    muteItem({
      type: MuteType.USER,
      value: comment.pubkey,
      reason: 'Muted from comment'
    }, {
      onSuccess: () => {
        toast({
          title: 'User muted',
          description: `${displayName} has been added to your mute list`,
        });
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to mute user. Please try again.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDeleteComment = (reason?: string) => {
    deleteComment({
      comment,
      reason
    }, {
      onSuccess: () => {
        setShowDeleteDialog(false);
      }
    });
  };

  return (
    <div className={`space-y-3 ${depth > 0 ? 'ml-6 border-l-2 border-muted pl-4' : ''}`}>
      <Card className={`transition-all ${isOptimistic ? 'bg-orange-50/80 opacity-60' : 'bg-card/50'}`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Comment Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <SmartLink to={`/${nip19.npubEncode(comment.pubkey)}`} ownerPubkey={comment.pubkey}>
                  <Avatar className="h-8 w-8 hover:ring-2 hover:ring-brand-light-green dark:ring-brand-green transition-all cursor-pointer">
                    <AvatarImage src={metadata?.picture} />
                    <AvatarFallback className="text-xs">
                      {displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </SmartLink>
                <div>
                  <SmartLink
                    to={`/${nip19.npubEncode(comment.pubkey)}`}
                    ownerPubkey={comment.pubkey}
                    className="font-medium text-sm hover:text-primary transition-colors"
                  >
                    {displayName}
                  </SmartLink>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo}
                    {isOptimistic && <span className="ml-1 italic">(sending...)</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Reply Preview - Show what comment this is replying to */}
            {parentComment && (
              <div className="flex items-start gap-2 px-3 py-2 bg-brand-light-green dark:bg-brand-dark-green rounded-md border-l-2 border-brand-light-green dark:border-brand-dark-green">
                <CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Avatar className="h-4 w-4 shrink-0">
                    <AvatarImage src={parentMetadata?.picture} />
                    <AvatarFallback className="text-[8px]">
                      {parentDisplayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-muted-foreground shrink-0">
                    {parentDisplayName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {parentComment.content}
                  </span>
                </div>
              </div>
            )}

            {/* Comment Content */}
            <div className="text-sm">
              <NoteContent event={comment} className="text-sm" />
            </div>

            {/* Comment Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="h-8 px-2 text-xs"
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Reply
                </Button>

                {hasReplies && (
                  <Collapsible open={showReplies} onOpenChange={setShowReplies}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                        {showReplies ? (
                          <ChevronDown className="h-3 w-3 mr-1" />
                        ) : (
                          <ChevronRight className="h-3 w-3 mr-1" />
                        )}
                        {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                      </Button>
                    </CollapsibleTrigger>
                  </Collapsible>
                )}
              </div>

              {/* Comment menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    aria-label="Comment options"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isOwnComment ? (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete comment
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={handleReportComment}>
                        <Flag className="h-4 w-4 mr-2" />
                        Report comment
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleReportUser}>
                        <Flag className="h-4 w-4 mr-2" />
                        Report user
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleMuteUser}>
                        <Volume2 className="h-4 w-4 mr-2" />
                        Mute user
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reply Form */}
      {showReplyForm && (
        <div className="ml-6">
          <CommentForm
            root={root}
            reply={comment}
            onSuccess={() => setShowReplyForm(false)}
            placeholder="Write a reply..."
            compact
          />
        </div>
      )}

      {/* Replies */}
      {hasReplies && (
        <Collapsible open={showReplies} onOpenChange={setShowReplies}>
          <CollapsibleContent className="space-y-3">
            {replies.map((reply) => (
              <Comment
                key={reply.id}
                root={root}
                comment={reply}
                depth={depth + 1}
                maxDepth={maxDepth}
                limit={limit}
                parentComment={comment}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Report Dialog */}
      <ReportContentDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        eventId={reportType === 'comment' ? comment.id : undefined}
        pubkey={reportType === 'user' ? comment.pubkey : undefined}
        contentType={reportType}
      />

      {/* Delete Dialog */}
      <DeleteCommentDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteComment}
        comment={comment}
        isDeleting={isDeleting}
      />
    </div>
  );
}