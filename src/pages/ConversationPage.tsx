import { useEffect, useMemo, useReducer, useState } from 'react';
import { ArrowLeft, ArrowUp, LinkSimple as Link2 } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import { useProtectedMinorStatus } from '@/hooks/useProtectedMinorStatus';
import {
  useDmCapability,
  useDmConversation,
  useDmSend,
} from '@/hooks/useDirectMessages';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import {
  DIVINE_SUPPORT_PUBKEY,
  decodeConversationId,
  encodeConversationId,
  type DmMessage,
} from '@/lib/dm';
import {
  getSupportDmConversationPath,
  isSupportOnlyDmPeerSet,
} from '@/lib/dmAccessPolicy';
import { createDmClientId } from '@/lib/dmOutbox';
import { isThreadAllowedForProtectedMinor } from '@/lib/dmInboundFilter';
import { officialAccountsService } from '@/lib/officialAccounts';
import { isMinorDmRestricted } from '@/lib/protectedMinor';
import { getConversationSubtitle } from '@/lib/conversationDisplay';
import { resolveDisplayName } from '@/lib/resolveDisplayName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { formatRelativeTime } from '@/lib/notificationTransform';
import { cn } from '@/lib/utils';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

const SUPPORT_CONVERSATION_ID = encodeConversationId([DIVINE_SUPPORT_PUBKEY]);

function getDisplayName(pubkey: string, metadata?: { display_name?: string; name?: string }, t?: TFn) {
  if (pubkey === DIVINE_SUPPORT_PUBKEY) {
    return metadata?.display_name || metadata?.name || (t ? t('conversationPage.divineSupport') : 'Divine Support');
  }

  return resolveDisplayName(metadata, pubkey);
}

function MessageBubble({
  message,
  onRetry,
}: {
  message: DmMessage;
  onRetry?: (message: DmMessage) => void;
}) {
  const { t } = useTranslation();
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
              {t('conversationPage.vineShare')}
            </div>
            <p className="mt-2 text-sm font-medium">
              {message.share.title || t('conversationPage.openSharedVine')}
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
                  {t('conversationPage.openVine')}
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
                  {t('conversationPage.openLink')}
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
          {message.deliveryState === 'sending' && <span>{t('conversationPage.sending')}</span>}
          {message.deliveryState === 'failed' && (
            <>
              <span>{t('conversationPage.failedToSend')}</span>
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
                  {t('conversationPage.retry')}
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
  const { t } = useTranslation();
  const navigate = useSubdomainNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { canUseDirectMessages, isCheckingDmCapability } = useDmCapability();
  const { state: minorState } = useProtectedMinorStatus();
  const peerPubkeys = useMemo(() => decodeConversationId(conversationId || ''), [conversationId]);
  const { data: authorMap = {} } = useBatchedAuthors(peerPubkeys);
  const conversationQuery = useDmConversation(conversationId);
  const sendMessage = useDmSend();
  const [draft, setDraft] = useState('');
  const messages = conversationQuery.data;
  const latestMessageAt = conversationQuery.latestMessageAt;
  const lastReadAt = conversationQuery.lastReadAt;
  const markConversationRead = conversationQuery.markConversationRead;
  const [, bumpVerdicts] = useReducer((x: number) => x + 1, 0);

  useEffect(() => officialAccountsService.onVerdictChanged(bumpVerdicts), []);

  useEffect(() => {
    if (!isMinorDmRestricted(minorState)) return;
    for (const pubkey of peerPubkeys) {
      void officialAccountsService.isApprovedMinorDmRecipient(pubkey);
    }
  }, [minorState, peerPubkeys]);

  const threadAllowedForMinor = isThreadAllowedForProtectedMinor(peerPubkeys, {
    state: minorState,
    isApproved: (pubkey) =>
      officialAccountsService.isApprovedMinorDmRecipientSync(pubkey),
  });
  // Both checks are load-bearing. decodeConversationId drops segments that are
  // not valid pubkeys, so a noncanonical id like `<support>,not-a-pubkey`
  // decodes to the support peer set and would pass isSupportOnlyDmPeerSet on
  // its own. The raw compare is what forces those routes to the canonical id.
  const threadBlocked =
    conversationId !== SUPPORT_CONVERSATION_ID ||
    !isSupportOnlyDmPeerSet(peerPubkeys) ||
    !threadAllowedForMinor;

  useEffect(() => {
    if (!threadBlocked && latestMessageAt > lastReadAt) {
      markConversationRead();
    }
  }, [lastReadAt, latestMessageAt, markConversationRead, threadBlocked]);

  useEffect(() => {
    if (threadBlocked) {
      navigate(getSupportDmConversationPath(), { replace: true });
    }
  }, [threadBlocked, navigate]);

  if (threadBlocked) {
    return null;
  }

  const peerNames = peerPubkeys.map((pubkey) => getDisplayName(pubkey, authorMap[pubkey]?.metadata, t));
  const title = peerNames.length === 1
    ? peerNames[0]
    : t('conversationPage.peopleCount', { count: peerNames.length });
  const subtitle = peerNames.length === 1
    ? getConversationSubtitle(peerPubkeys[0], authorMap[peerPubkeys[0]]?.metadata, t)
    : peerNames.join(', ');

  const handleSend = async () => {
    const trimmedDraft = draft.trim();
    if (!peerPubkeys.length || !trimmedDraft) {
      return;
    }

    try {
      await sendMessage.mutateAsync({
        // Minted here rather than inside the mutation so the send has an
        // identity before any wrap is built — that is what lets a retry find
        // the first attempt's rumor and replay it instead of minting a second
        // message the recipient cannot collapse (#578).
        clientId: createDmClientId(peerPubkeys),
        participantPubkeys: peerPubkeys,
        content: trimmedDraft,
      });

      setDraft('');
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
    });
  };

  const handleComposerKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await handleSend();
    }
  };

  // While the bunker NIP-44 healthcheck is in flight, render a neutral
  // skeleton instead of the "unavailable" copy — capability is unknown,
  // not negative, until the probe resolves.
  if (isCheckingDmCapability) {
    return (
      <div className="min-h-full bg-brand-off-white dark:bg-brand-dark-green">
        <main className="container py-6">
          <div className="mx-auto max-w-3xl rounded-[32px] border border-border/80 bg-card/80 px-6 py-12 text-center shadow-sm backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">Checking signer capability…</p>
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
            <p className="text-lg font-semibold text-foreground">{t('conversationPage.dmUnavailableTitle')}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('conversationPage.dmUnavailableDescription')}
            </p>
            <Button className="mt-5 rounded-full" onClick={() => navigate('/support')}>
              {t('conversationPage.backToSupport')}
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
                aria-label={t('conversationPage.backToSupport')}
                onClick={() => navigate('/support')}
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
                  <p className="text-base font-medium text-foreground">{t('conversationPage.noMessages')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('conversationPage.noMessagesHint')}
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
              <div className="flex items-end gap-3">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={t('conversationPage.placeholderMessage')}
                  rows={2}
                  className="resize-none rounded-[24px] border-border/80 bg-background/80 px-4 py-3 text-sm"
                />
                <Button
                  className="h-12 w-12 rounded-full"
                  onClick={handleSend}
                  disabled={!draft.trim()}
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
