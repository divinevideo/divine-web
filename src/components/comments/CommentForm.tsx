import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePostComment } from '@/hooks/usePostComment';
import { LoginArea } from '@/components/auth/LoginArea';
import { NostrEvent } from '@nostrify/nostrify';
import { Chat as MessageSquare, PaperPlaneTilt as Send } from '@phosphor-icons/react';

interface CommentFormProps {
  root: NostrEvent | URL;
  reply?: NostrEvent | URL;
  onSuccess?: () => void;
  placeholder?: string;
  compact?: boolean;
}

export function CommentForm({
  root,
  reply,
  onSuccess,
  placeholder,
  compact = false
}: CommentFormProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const { user } = useCurrentUser();
  const { mutate: postComment, isPending } = usePostComment();
  const effectivePlaceholder = placeholder ?? t('comments.writeAComment');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || !user) return;

    postComment(
      { content: content.trim(), root, reply },
      {
        onSuccess: () => {
          setContent('');
          onSuccess?.();
        },
      }
    );
  };

  const loginContent = (
    <div className="text-center space-y-4">
      <div className="flex items-center justify-center space-x-2 text-muted-foreground">
        <MessageSquare className="h-5 w-5" />
        <span>{reply ? t('comments.signInToReply') : t('comments.signInToComment')}</span>
      </div>
      <LoginArea />
    </div>
  );

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={effectivePlaceholder}
        className={compact ? "min-h-[80px]" : "min-h-[100px]"}
        disabled={isPending}
      />
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {reply ? t('comments.replyingToComment') : t('comments.addingToDiscussion')}
        </span>
        <Button
          type="submit"
          disabled={!content.trim() || isPending}
          size={compact ? "sm" : "default"}
        >
          <Send className="h-4 w-4 mr-2" />
          {isPending ? t('comments.posting') : (reply ? t('comments.reply') : t('comments.comment'))}
        </Button>
      </div>
    </form>
  );

  if (compact) {
    // In compact mode (modal), don't wrap in Card to avoid nested padding
    return (
      <div className="border border-dashed rounded-lg p-4">
        {!user ? loginContent : formContent}
      </div>
    );
  }

  // Default mode with Card wrapper
  return (
    <Card>
      <CardContent className="p-6">
        {!user ? loginContent : formContent}
      </CardContent>
    </Card>
  );
}
