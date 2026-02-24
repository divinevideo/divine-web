// ABOUTME: Single notification row showing actor, action, and timestamp
// ABOUTME: Displays avatar with type icon overlay, message text, and relative time

import { Heart, MessageCircle, UserPlus, Repeat2, Zap } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { generateNotificationMessage, formatRelativeTime } from '@/lib/notificationTransform';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types/notification';

/** Icon + color config for each notification type */
const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  like:    { icon: Heart,         color: 'text-red-500' },
  comment: { icon: MessageCircle, color: 'text-blue-500' },
  follow:  { icon: UserPlus,      color: 'text-purple-500' },
  repost:  { icon: Repeat2,       color: 'text-green-500' },
  zap:     { icon: Zap,           color: 'text-amber-500' },
};

interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const navigate = useSubdomainNavigate();
  const author = useAuthor(notification.actorPubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.display_name || metadata?.name || genUserName(notification.actorPubkey);
  const avatarUrl = getSafeProfileImage(metadata?.picture);
  const avatarFallback = displayName[0]?.toUpperCase() || '?';

  const { icon: TypeIcon, color: iconColor } = TYPE_CONFIG[notification.type];
  const message = generateNotificationMessage(notification.type, displayName);
  const timeAgo = formatRelativeTime(notification.timestamp);

  const handleClick = () => {
    if (notification.type === 'follow') {
      const npub = nip19.npubEncode(notification.actorPubkey);
      navigate(`/profile/${npub}`);
    } else if (notification.targetEventId) {
      navigate(`/video/${notification.targetEventId}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50',
        !notification.isRead && 'bg-muted/30',
      )}
    >
      {/* Avatar with type icon overlay */}
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback>{avatarFallback}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-background',
            iconColor,
          )}
        >
          <TypeIcon className="h-3 w-3" />
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-semibold">{displayName}</span>{' '}
          <span className="text-muted-foreground">
            {message.replace(displayName, '').trim()}
          </span>
        </p>

        {/* Comment preview */}
        {notification.type === 'comment' && notification.commentText && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 rounded bg-muted/50 px-2 py-1">
            {notification.commentText}
          </p>
        )}

        {/* Timestamp */}
        <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </button>
  );
}
