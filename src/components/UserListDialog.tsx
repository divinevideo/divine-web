// ABOUTME: Reusable dialog component that displays a list of Nostr users
// ABOUTME: Uses virtual scrolling for performance with large lists (500+ users)

import { memo, useCallback, useRef, useEffect, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
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
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { Sentry } from '@/lib/sentry';

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
  onNavigate: (pubkey: string) => void;
}

const UserRow = memo(function UserRow({ pubkey, metadata, onNavigate }: UserRowProps) {
  const npub = nip19.npubEncode(pubkey);
  const shortNpub = `${npub.slice(0, 12)}...${npub.slice(-4)}`;

  const displayName = metadata?.display_name || metadata?.name || shortNpub;
  const profileImage = getSafeProfileImage(metadata?.picture) || '/user-avatar.png';

  return (
    <button
      className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition-colors text-left"
      onClick={() => onNavigate(pubkey)}
    >
      <Avatar className="h-10 w-10 shrink-0">
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
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
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

  const totalCount = pubkeys.length + (isLoading ? 3 : 0);

  const rowVirtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Resolve profiles only for the visible range + a buffer
  const visiblePubkeys = useMemo(() => {
    if (virtualItems.length === 0) return [];
    const visibleStart = virtualItems[0].index;
    const visibleEnd = virtualItems[virtualItems.length - 1].index;
    const bufferStart = Math.max(0, visibleStart - 10);
    const bufferEnd = Math.min(pubkeys.length, visibleEnd + 10);
    return pubkeys.slice(bufferStart, bufferEnd);
  }, [virtualItems, pubkeys]);

  const { data: authorsData } = useBatchedAuthors(open ? visiblePubkeys : []);

  const handleNavigate = useCallback(
    (pubkey: string) => {
      const npub = nip19.npubEncode(pubkey);
      onOpenChange(false);
      navigate(`/profile/${npub}`, { ownerPubkey: pubkey });
    },
    [navigate, onOpenChange],
  );

  // Infinite scroll: trigger load more when near the end
  useEffect(() => {
    if (virtualItems.length === 0) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem && lastItem.index >= pubkeys.length - 5 && hasMore && onLoadMore && !isLoading) {
      onLoadMore();
    }
  }, [virtualItems, pubkeys.length, hasMore, onLoadMore, isLoading]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            List of {title.toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        {pubkeys.length === 0 && !isLoading ? (
          <div className="px-4 pb-4">
            <p className="text-center text-muted-foreground py-8 text-sm">
              No {title.toLowerCase()} yet
            </p>
          </div>
        ) : (
          <div
            ref={parentRef}
            className="overflow-y-auto flex-1 px-4 pb-4"
            style={{ contain: 'strict' }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map((virtualRow) => {
                const index = virtualRow.index;

                if (index >= pubkeys.length) {
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

                const pubkey = pubkeys[index];
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
                      metadata={authorsData?.[pubkey]?.metadata}
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
