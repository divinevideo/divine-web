import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lifebuoy as LifeBuoy, Plus, MagnifyingGlass as Search } from '@phosphor-icons/react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDmCapability, useDmConversations, useParsedDmShare } from '@/hooks/useDirectMessages';
import { useSearchUsers } from '@/hooks/useSearchUsers';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import {
  DIVINE_SUPPORT_PUBKEY,
  buildDmShareQueryString,
  getDmConversationPath,
  getDmMessagePreview,
  type DmConversation,
} from '@/lib/dm';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { formatRelativeTime } from '@/lib/notificationTransform';
import { useLocation } from 'react-router-dom';

function getDisplayName(pubkey: string, metadata?: { display_name?: string; name?: string }) {
  if (pubkey === DIVINE_SUPPORT_PUBKEY) {
    return metadata?.display_name || metadata?.name || 'Divine Support';
  }

  return metadata?.display_name || metadata?.name || genUserName(pubkey);
}

function getConversationPreview(message: DmConversation['lastMessage']): string {
  const preview = getDmMessagePreview(message);

  if (message.deliveryState === 'sending') {
    return `Sending... ${preview}`;
  }

  if (message.deliveryState === 'failed') {
    return `Failed to send: ${preview}`;
  }

  return preview;
}

function ConversationSkeleton() {
  return (
    <div className="rounded-[28px] border border-border/80 bg-card/70 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  );
}

interface ConversationRowProps {
  conversation: DmConversation;
  names: string[];
  pictures: string[];
  onClick: () => void;
}

function ConversationRow({ conversation, names, pictures, onClick }: ConversationRowProps) {
  const title = names.length === 1
    ? names[0]
    : `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ''}`;

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-[28px] border border-border/80 bg-card/70 p-4 text-left shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_36px_rgba(39,197,139,0.12)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex -space-x-3">
          {pictures.slice(0, 3).map((picture, index) => (
            <Avatar
              key={`${picture}-${index}`}
              className="h-12 w-12 border-2 border-background shadow-sm"
            >
              <AvatarImage src={picture} alt={title} />
              <AvatarFallback className="text-xs">
                {names[index]?.slice(0, 2).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
              {conversation.participantPubkeys.length > 1 && (
                <p className="truncate text-xs text-muted-foreground">
                  {names.join(', ')}
                </p>
              )}
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatRelativeTime(conversation.lastMessage.createdAt)}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {getConversationPreview(conversation.lastMessage)}
            </p>
            {conversation.unreadCount > 0 && (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

interface SupportRowProps {
  displayName: string;
  picture: string;
  onClick: () => void;
  supportBadge: string;
  supportSummary: string;
}

function SupportRow({
  displayName,
  picture,
  onClick,
  supportBadge,
  supportSummary,
}: SupportRowProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-[28px] border border-border/80 bg-card/70 p-4 text-left shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_36px_rgba(39,197,139,0.12)]"
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border border-primary/20 bg-primary/10">
          <AvatarImage src={picture} alt={displayName} />
          <AvatarFallback className="text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
              {supportBadge}
            </span>
          </div>
          <p className="mt-2 truncate text-sm text-muted-foreground">
            {supportSummary}
          </p>
        </div>
      </div>
    </button>
  );
}

export function MessagesPage() {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { canUseDirectMessages } = useDmCapability();
  const conversationsQuery = useDmConversations();
  const share = useParsedDmShare(location.search);
  const [searchQuery, setSearchQuery] = useState('');

  const searchUsersQuery = useSearchUsers({
    query: searchQuery,
    limit: 12,
  });

  const authorPubkeys = useMemo(() => [
    ...new Set([
      DIVINE_SUPPORT_PUBKEY,
      ...(conversationsQuery.data || []).flatMap((conversation) => conversation.participantPubkeys),
    ]),
  ], [conversationsQuery.data]);

  const { data: authorMap = {} } = useBatchedAuthors(authorPubkeys);

  const shareQueryString = buildDmShareQueryString(share);

  const openConversation = (pubkeys: string[]) => {
    const path = getDmConversationPath(pubkeys);
    navigate(shareQueryString ? `${path}?${shareQueryString}` : path);
  };

  const supportMetadata = authorMap[DIVINE_SUPPORT_PUBKEY]?.metadata;
  const supportDisplayName = getDisplayName(DIVINE_SUPPORT_PUBKEY, supportMetadata);
  const supportPicture = getSafeProfileImage(supportMetadata?.picture) || '/user-avatar.png';

  const searchResults = (searchUsersQuery.data || []).filter((result) => result.pubkey !== user?.pubkey);

  return (
    <div className="min-h-full bg-brand-off-white dark:bg-brand-dark-green">
      <main className="container py-6">
        <div className="mx-auto max-w-4xl space-y-5">
          <section className="overflow-hidden rounded-[32px] border border-border/70 bg-card/80 px-5 py-6 shadow-[0_24px_60px_rgba(39,197,139,0.08)] backdrop-blur-sm">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                  {t('messages.badge')}
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{t('messages.title')}</h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {t('messages.subtitle')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="dm-search-input"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t('messages.searchPlaceholder')}
                    className="h-12 rounded-full border-border/80 bg-background/80 pl-11 text-sm"
                  />
                </div>
                <Button
                  className="justify-center gap-2 rounded-full sm:px-6"
                  onClick={() => {
                    const searchInput = document.getElementById('dm-search-input');
                    searchInput?.focus();
                  }}
                  disabled={!canUseDirectMessages}
                >
                  <Plus className="h-4 w-4" />
                  {t('messages.newMessage')}
                </Button>
              </div>
            </div>

            {share && (
              <div className="mt-4 rounded-[24px] border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
                <span className="font-medium">{t('messages.readyToShare')}</span>{' '}
                {share.title
                  ? t('messages.shareWithTitle', { title: share.title })
                  : t('messages.shareWithLink')}
              </div>
            )}
          </section>

          {!canUseDirectMessages && (
            <section className="rounded-[32px] border border-border/80 bg-card/80 px-5 py-6 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
              {t('messages.signerUnsupported')}
            </section>
          )}

          {canUseDirectMessages && (
            <section className="space-y-3">
              {searchQuery.trim() ? (
                <>
                  {searchUsersQuery.isLoading && (
                    <>
                      <ConversationSkeleton />
                      <ConversationSkeleton />
                    </>
                  )}

                  {searchResults.map((result) => {
                    const displayName = getDisplayName(result.pubkey, result.metadata);
                    const picture = getSafeProfileImage(result.metadata?.picture) || '/user-avatar.png';

                    return (
                      <button
                        key={result.pubkey}
                        onClick={() => openConversation([result.pubkey])}
                        className="w-full rounded-[28px] border border-border/80 bg-card/70 p-4 text-left shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_36px_rgba(39,197,139,0.12)]"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={picture} alt={displayName} />
                            <AvatarFallback className="text-xs">
                              {displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                            {result.metadata?.name && result.metadata.name !== displayName && (
                              <p className="truncate text-xs text-muted-foreground">@{result.metadata.name}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {!searchUsersQuery.isLoading && searchResults.length === 0 && (
                    <div className="rounded-[28px] border border-dashed border-border bg-card/70 px-5 py-10 text-center text-sm text-muted-foreground">
                      No matching people found.
                    </div>
                  )}
                </>
              ) : (
                <>
                  {conversationsQuery.isLoading && (
                    <>
                      <ConversationSkeleton />
                      <ConversationSkeleton />
                      <ConversationSkeleton />
                    </>
                  )}

                  <SupportRow
                    displayName={supportDisplayName}
                    picture={supportPicture}
                    supportBadge={t('messages.supportBadge')}
                    supportSummary={t('messages.supportSummary')}
                    onClick={() => openConversation([DIVINE_SUPPORT_PUBKEY])}
                  />

                  {(conversationsQuery.data || []).map((conversation) => {
                    const names = conversation.participantPubkeys.map((pubkey) =>
                      getDisplayName(pubkey, authorMap[pubkey]?.metadata),
                    );
                    const pictures = conversation.participantPubkeys.map((pubkey) =>
                      getSafeProfileImage(authorMap[pubkey]?.metadata?.picture) || '/user-avatar.png',
                    );

                    return (
                      <ConversationRow
                        key={conversation.id}
                        conversation={conversation}
                        names={names}
                        pictures={pictures}
                        onClick={() => openConversation(conversation.participantPubkeys)}
                      />
                    );
                  })}

                  {!conversationsQuery.isLoading && (conversationsQuery.data || []).length === 0 && (
                    <div className="rounded-[32px] border border-dashed border-border bg-card/70 px-6 py-12 text-center shadow-sm backdrop-blur-sm">
                      <div className="mx-auto max-w-md space-y-3">
                        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <LifeBuoy className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-xl font-semibold text-foreground">No other messages yet</h2>
                          <p className="text-sm text-muted-foreground">
                            Start a new conversation from the search bar above when you are ready to message someone else.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default MessagesPage;
