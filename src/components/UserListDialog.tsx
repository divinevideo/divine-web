// ABOUTME: Reusable dialog component that displays a list of Nostr users
// ABOUTME: Uses virtual scrolling for performance with large lists (500+ users)

import { memo, useCallback, useRef, useEffect, useMemo, useState } from 'react';
import type { NostrMetadata } from '@nostrify/nostrify';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { useValidatedProfileLinkPath } from '@/hooks/useValidatedProfileLinkPath';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { genUserName } from '@/lib/genUserName';
import { Sentry } from '@/lib/sentry';

const ESTIMATED_ROW_HEIGHT = 56;

interface AuthorData {
  metadata?: NostrMetadata;
}

interface UserListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  pubkeys: string[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

interface UserRowProps {
  pubkey: string;
  metadata?: NostrMetadata;
  onNavigate: (pubkey: string, profilePath: string) => void;
}

const UserRow = memo(function UserRow({ pubkey, metadata, onNavigate }: UserRowProps) {
  const displayName = metadata?.display_name || metadata?.name || genUserName(pubkey);
  const profileImage = getSafeProfileImage(metadata?.picture) || '/user-avatar.png';
  const profilePath = useValidatedProfileLinkPath({
    pubkey,
    nip05: metadata?.nip05,
    fallbackRoute: 'profile',
  });

  return (
    <button
      className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition-colors text-left"
      onClick={() => onNavigate(pubkey, profilePath)}
    >
      <Avatar size="md" className="shrink-0">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback className="text-xs">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{displayName}</div>
        {metadata?.name && metadata.name !== displayName && (
          <div className="text-xs text-muted-foreground truncate">@{metadata.name}</div>
        )}
      </div>
    </button>
  );
});

function LoadingSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2">
      <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function UserListDialog({
  open,
  onOpenChange,
  title,
  pubkeys,
  isLoading = false,
  hasMore = false,
  onLoadMore,
}: UserListDialogProps) {
  const { t } = useTranslation();
  const navigate = useSubdomainNavigate();
  const parentRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<ReturnType<typeof Sentry.startInactiveSpan> | null>(null);

  // Track dialog open → first content rendered via Sentry span
  useEffect(() => {
    if (open && !spanRef.current) {
      spanRef.current = Sentry.startInactiveSpan({
        name: 'user_list_dialog',
        op: 'ui.render',
        attributes: { 'ui.list_type': title.toLowerCase() },
      });
    }
    if (!open && spanRef.current) {
      spanRef.current.end();
      spanRef.current = null;
    }
  }, [open, title]);

  // End the span once profiles have loaded (first content paint)
  useEffect(() => {
    if (spanRef.current && pubkeys.length > 0 && !isLoading) {
      spanRef.current.setAttribute('ui.item_count', pubkeys.length);
      spanRef.current.end();
      spanRef.current = null;
    }
  }, [pubkeys.length, isLoading]);

  // Profiles are fetched a window at a time, so a batch response only ever
  // covers the rows currently on screen. Accumulate them: without this,
  // scrolling away and back leaves the earlier rows with no metadata, and they
  // visibly reset to a generated name and the default avatar.
  const [resolvedAuthors, setResolvedAuthors] = useState<Record<string, AuthorData>>({});

  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const matchesQuery = useCallback(
    (pubkey: string) => {
      const metadata = resolvedAuthors[pubkey]?.metadata;
      const haystack = [
        metadata?.display_name,
        metadata?.name,
        metadata?.nip05,
        metadata?.display_name || metadata?.name || metadata?.nip05
          ? undefined
          : genUserName(pubkey),
      ];
      return haystack.some((value) => value?.toLowerCase().includes(trimmedQuery));
    },
    [resolvedAuthors, trimmedQuery],
  );

  const filteredPubkeys = useMemo(
    () => (isSearching ? pubkeys.filter(matchesQuery) : pubkeys),
    [isSearching, matchesQuery, pubkeys],
  );

  // Skeleton rows stand for pages still arriving, which a query is not waiting on.
  const totalCount = filteredPubkeys.length + (isLoading && !isSearching ? 3 : 0);

  const rowVirtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const virtualizedHeight = rowVirtualizer.getTotalSize();
  const renderedRows = useMemo(() => {
    if (virtualItems.length > 0) {
      return virtualItems;
    }

    const fallbackCount = Math.min(totalCount, 8);
    return Array.from({ length: fallbackCount }, (_, index) => ({
      key: `fallback-${index}`,
      index,
      size: ESTIMATED_ROW_HEIGHT,
      start: index * ESTIMATED_ROW_HEIGHT,
    }));
  }, [totalCount, virtualItems]);

  // Resolve profiles only for the visible range + a buffer
  const visiblePubkeys = useMemo(() => {
    if (renderedRows.length === 0) return [];
    const visibleStart = renderedRows[0].index;
    const visibleEnd = renderedRows[renderedRows.length - 1].index;
    const bufferStart = Math.max(0, visibleStart - 10);
    const bufferEnd = Math.min(filteredPubkeys.length, visibleEnd + 11);
    return filteredPubkeys.slice(bufferStart, bufferEnd);
  }, [renderedRows, filteredPubkeys]);

  // Filtering on a name needs a name for every entry, not just the rows on
  // screen, so a query widens the fetch to the whole list. Bulk lookups chunk
  // themselves, and windowed fetching stays the default while idle.
  const requestedPubkeys = isSearching ? pubkeys : visiblePubkeys;
  const { data: authorsData, isLoading: areAuthorsLoading = false } = useBatchedAuthors(
    open ? requestedPubkeys : [],
  );

  useEffect(() => {
    if (!authorsData) return;
    setResolvedAuthors((previous) => ({ ...previous, ...authorsData }));
  }, [authorsData]);

  const handleNavigate = useCallback(
    (pubkey: string, profilePath: string) => {
      onOpenChange(false);
      navigate(profilePath, { ownerPubkey: pubkey });
    },
    [navigate, onOpenChange],
  );

  // Infinite scroll: trigger load more when near the end.
  //
  // Held off while a query is active. The rendered rows index into the filtered
  // list, so an end-of-list check would compare against a length the query can
  // make arbitrarily short and page in the rest of the list on every render.
  useEffect(() => {
    if (isSearching || virtualItems.length === 0) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem && lastItem.index >= pubkeys.length - 5 && hasMore && onLoadMore && !isLoading) {
      onLoadMore();
    }
  }, [virtualItems, pubkeys.length, hasMore, onLoadMore, isLoading, isSearching]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm h-[min(80vh,36rem)] min-h-80 flex flex-col p-0"
        style={{ overflowY: 'hidden' }}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            List of {title.toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        {pubkeys.length > 0 && (
          <div className="px-6 pb-2">
            <div className="relative">
              <MagnifyingGlass
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('userList.searchPlaceholder')}
                aria-label={t('userList.searchPlaceholder')}
                className="pl-9"
              />
            </div>
          </div>
        )}

        {pubkeys.length === 0 && !isLoading ? (
          <div className="px-4 pb-4">
            <p className="text-center text-muted-foreground py-8 text-sm">
              No {title.toLowerCase()} yet
            </p>
          </div>
        ) : isSearching && filteredPubkeys.length === 0 && areAuthorsLoading ? (
          <div className="px-4 pb-4">
            {Array.from({ length: 3 }, (_, index) => (
              <LoadingSkeleton key={index} />
            ))}
          </div>
        ) : isSearching && filteredPubkeys.length === 0 ? (
          <div className="px-4 pb-4">
            <p className="text-center text-muted-foreground py-8 text-sm">
              {t('userList.noMatches')}
            </p>
          </div>
        ) : (
          <div
            ref={parentRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          >
            <div
              style={{
                height: `${Math.max(virtualizedHeight, renderedRows.length * ESTIMATED_ROW_HEIGHT)}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {renderedRows.map((virtualRow) => {
                const index = virtualRow.index;

                if (index >= filteredPubkeys.length) {
                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <LoadingSkeleton />
                    </div>
                  );
                }

                const pubkey = filteredPubkeys[index];
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <UserRow
                      pubkey={pubkey}
                      metadata={resolvedAuthors[pubkey]?.metadata}
                      onNavigate={handleNavigate}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
