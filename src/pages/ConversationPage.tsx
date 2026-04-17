import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUp, LinkSimple as Link2, X } from '@phosphor-icons/react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import {
  useDmCapability,
  useDmConversation,
  useDmSend,
  useParsedDmShare,
} from '@/hooks/useDirectMessages';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import {
  DIVINE_SUPPORT_PUBKEY,
  decodeConversationId,
  getDmConversationPath,
  type DmMessage,
} from '@/lib/dm';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { getDivineNip05Info } from '@/lib/nip05Utils';
import { formatRelativeTime } from '@/lib/notificationTransform';
import { cn } from '@/lib/utils';

function getDisplayName(pubkey: string, metadata?: { display_name?: string; name?: string }) {
  if (pubkey === DIVINE_SUPPORT_PUBKEY) {
    return metadata?.display_name || metadata?.name || 'Divine Support';
  }

  return metadata?.display_name || metadata?.name || genUserName(pubkey);
}

function getConversationSubtitle(
  pubkey: string,
  metadata?: { name?: string; nip05?: string },
) {
  if (pubkey === DIVINE_SUPPORT_PUBKEY) {
    return 'Private support chat';
  }

  const nip05 = metadata?.nip05?.trim();
  if (nip05) {
    const divineInfo = getDivineNip05Info(nip05);
    if (divineInfo) {
      return divineInfo.displayName;
    }

    return nip05.startsWith('_@') ? `@${nip05.slice(2)}` : `@${nip05}`;
  }

  return `@${metadata?.name || genUserName(pubkey)}`;
}

function MessageBubble({
  message,
  onRetry,
}: {
  message: DmMessage;
  onRetry?: (message: DmMessage) => void;
}) {
  const videoPath = message.share?.vineId || message.share?.videoId
    ? `/video/${message.share.vineId || message.share.videoId}`
    : undefined;

  return (
    <div className={cn('flex', message.isOutgoing ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[min(100%,34rem)] rounded-[26px] px-4 py-3 shadow-sm',
          message.isOutgoing
            ? 'bg-primary text-primary-foreground'
            : 'border border-border/80 bg-card/80 text-foreground',
        )}
      >
        {message.share && (
          <div
            className={cn(
              'mb-3 rounded-[20px] border px-3 py-3',
              message.isOutgoing
                ? 'border-primary-foreground/20 bg-primary-foreground/10'
                : 'border-primary/15 bg-primary/10',
            )}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Link2 className="h-3.5 w-3.5" />
              Vine share
            </div>
            <p className="mt-2 text-sm font-medium">
              {message.share.title || 'Open shared vine'}
            </p>
            <div className="mt-3">
              {videoPath ? (
                <Link
                  to={videoPath}
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    message.isOutgoing
                      ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  Open vine
                </Link>
              ) : (
                <a
                  href={message.share.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    message.isOutgoing
                      ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  Open link
                </a>
              )}
            </div>
          </div>
        )}

        {message.content.trim() && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        )}

        <div
          className={cn(
            'mt-2 flex items-center gap-2 text-[11px]',
            message.isOutgoing
              ? 'text-primary-foreground/70'
              : 'text-muted-foreground',
          )}
        >
          <span>{formatRelativeTime(message.createdAt)}</span>
          {message.deliveryState === 'sending' && <span>Sending...</span>}
          {message.deliveryState === 'failed' && (
            <>
              <span>Failed to send</span>
              {message.clientId && onRetry && (
                <button
                  type="button"
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors',
                    message.isOutgoing
                      ? 'border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10'
                      : 'border-border text-foreground hover:bg-muted',
                  )}
                  onClick={() => onRetry(message)}
                >
                  Retry
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <Skeleton className="h-24 w-72 rounded-[26px]" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-20 w-64 rounded-[26px]" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-28 w-80 rounded-[26px]" />
      </div>
    </div>
  );
}

export function ConversationPage() {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { canUseDirectMessages } = useDmCapability();
  const peerPubkeys = useMemo(() => decodeConversationId(conversationId || ''), [conversationId]);
  const { data: authorMap = {} } = useBatchedAuthors(peerPubkeys);
  const conversationQuery = useDmConversation(conversationId);
  const sendMessage = useDmSend();
  const share = useParsedDmShare(location.search);
  const [draft, setDraft] = useState('');
  const messages = conversationQuery.data;
  const latestMessageAt = conversationQuery.latestMessageAt;
  const lastReadAt = conversationQuery.lastReadAt;
  const markConversationRead = conversationQuery.markConversationRead;

  useEffect(() => {
    if (latestMessageAt > lastReadAt) {
      markConversationRead();
    }
  }, [lastReadAt, latestMessageAt, markConversationRead]);

  const peerNames = peerPubkeys.map((pubkey) => getDisplayName(pubkey, authorMap[pubkey]?.metadata));
  const title = peerNames.length === 1
    ? peerNames[0]
    : `${peerNames.length} people`;
  const subtitle = peerNames.length === 1
    ? getConversationSubtitle(peerPubkeys[0], authorMap[peerPubkeys[0]]?.metadata)
    : peerNames.join(', ');

  const sharelessPath = conversationId ? getDmConversationPath(peerPubkeys) : '/messages';

  const handleSend = async () => {
    const trimmedDraft = draft.trim();
    if (!peerPubkeys.length || (!trimmedDraft && !share)) {
      return;
    }

    try {
      await sendMessage.mutateAsync({
        participantPubkeys: peerPubkeys,
        content: trimmedDraft,
        share: share ?? undefined,
      });

      setDraft('');

      if (share) {
        navigate(sharelessPath, { replace: true });
      }
    } catch {
      // Mutation error state and toast are handled by the hook.
    }
  };

  const handleRetry = (message: DmMessage) => {
    if (!message.clientId) {
      return;
    }

    sendMessage.mutate({
      clientId: message.clientId,
      participantPubkeys: message.peerPubkeys,
      content: message.content,
      share: message.share,
    });
  };

  const handleComposerKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await handleSend();
    }
  };

  if (!conversationId || !peerPubkeys.length) {
    return (
      <div className="min-h-full bg-brand-off-white dark:bg-brand-dark-green">
        <main className="container py-6">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-border/80 bg-card/80 px-6 py-12 text-center shadow-sm backdrop-blur-sm">
            <p className="text-lg font-semibold text-foreground">Conversation not found</p>
            <p className="mt-2 text-sm text-muted-foreground">Go back to your inbox and start a new message.</p>
            <Button className="mt-5 rounded-full" onClick={() => navigate('/messages')}>
              Back to inbox
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!canUseDirectMessages) {
    return (
      <div className="min-h-full bg-brand-off-white dark:bg-brand-dark-green">
        <main className="container py-6">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-border/80 bg-card/80 px-6 py-12 text-center shadow-sm backdrop-blur-sm">
            <p className="text-lg font-semibold text-foreground">Direct messages are unavailable</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This signer can authenticate you, but it does not expose the NIP-44 encryption methods required for private messaging.
            </p>
            <Button className="mt-5 rounded-full" onClick={() => navigate('/messages')}>
              Back to inbox
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-brand-off-white dark:bg-brand-dark-green">
      <main className="container py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <section className="rounded-[32px] border border-border/80 bg-card/80 px-4 py-4 shadow-[0_24px_60px_rgba(39,197,139,0.08)] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => navigate('/messages')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="flex -space-x-3">
                {peerPubkeys.slice(0, 3).map((pubkey) => {
                  const picture = getSafeProfileImage(authorMap[pubkey]?.metadata?.picture) || '/user-avatar.png';
                  const displayName = getDisplayName(pubkey, authorMap[pubkey]?.metadata);

                  return (
                    <Avatar key={pubkey} className="h-12 w-12 border-2 border-background">
                      <AvatarImage src={picture} alt={displayName} />
                      <AvatarFallback className="text-xs">
                        {displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-border/80 bg-card/80 px-4 py-4 shadow-sm backdrop-blur-sm">
            <div className="space-y-4 pb-3">
              {conversationQuery.isLoading && <ThreadSkeleton />}

              {!conversationQuery.isLoading && messages.length === 0 && (
                <div className="rounded-[26px] border border-dashed border-border px-5 py-10 text-center">
                  <p className="text-base font-medium text-foreground">No messages yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send the first message to open this thread.
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <MessageBubble
                  key={message.clientId || message.wrapId}
                  message={message}
                  onRetry={handleRetry}
                />
              ))}
            </div>

            <div className="border-t border-border/80 pt-4">
              {share && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-[24px] border border-primary/20 bg-primary/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">
                      Ready to share
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {share.title || share.url}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => navigate(sharelessPath, { replace: true })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-end gap-3">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={share ? 'Add an optional note...' : 'Write a message...'}
                  rows={2}
                  className="resize-none rounded-[24px] border-border/80 bg-background/80 px-4 py-3 text-sm"
                />
                <Button
                  className="h-12 w-12 rounded-full"
                  onClick={handleSend}
                  disabled={!draft.trim() && !share}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default ConversationPage;
