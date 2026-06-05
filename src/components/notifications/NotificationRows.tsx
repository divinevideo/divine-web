// ABOUTME: Grouped notification row components for the new video-grouping notifications UI
// ABOUTME: Renders VideoNotificationRow (like/comment/repost) and ActorNotificationRow (follow)

import { useTranslation } from 'react-i18next';
import { Heart, Repeat, ChatCircle, UserPlus } from '@phosphor-icons/react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { buildProfileLinkPath } from '@/lib/profileLinks';
import { formatRelativeTime } from '@/lib/notificationTransform';
import { cn } from '@/lib/utils';
import type { VideoNotification, ActorNotification, ActorInfo } from '@/types/notification';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Up to 3 overlapping 28×28 avatars + +N overflow circle. */
function NotificationAvatarStack({
  actors,
  totalCount,
  onAvatarClick,
}: {
  actors: ActorInfo[];
  totalCount: number;
  onAvatarClick: (actor: ActorInfo, e: React.MouseEvent | React.KeyboardEvent) => void;
}) {
  const visible = actors.slice(0, 3);
  const overflow = totalCount - actors.length;

  return (
    <div className="flex items-center">
      {visible.map((actor, index) => (
        <button
          key={actor.pubkey}
          type="button"
          aria-label={`${actor.displayName} profile`}
          onClick={(e) => {
            e.stopPropagation();
            onAvatarClick(actor, e);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onAvatarClick(actor, e);
            }
          }}
          className={cn(
            'relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            index > 0 && '-ml-2',
          )}
          style={{ zIndex: visible.length - index }}
        >
          <Avatar size="xs" className="h-7 w-7">
            <AvatarImage src={actor.avatarUrl} alt={actor.displayName} />
            <AvatarFallback>{actor.displayName[0]?.toUpperCase() ?? '?'}</AvatarFallback>
          </Avatar>
        </button>
      ))}
      {overflow > 0 && (
        <span className="-ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold text-muted-foreground">
          +{overflow}
        </span>
      )}
    </div>
  );
}

/** 32×32 colored circle with a Phosphor icon. */
function NotificationTypeIconChip({
  type,
  isRead,
}: {
  type: VideoNotification['type'] | 'follow';
  isRead: boolean;
}) {
  const weight = isRead ? 'bold' : 'fill';

  switch (type) {
    case 'like':
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15">
          <Heart className="h-4 w-4 text-red-500" weight={weight} />
        </span>
      );
    case 'repost':
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/15">
          <Repeat className="h-4 w-4 text-green-500" weight={weight} />
        </span>
      );
    case 'comment':
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
          <ChatCircle className="h-4 w-4 text-blue-500" weight={weight} />
        </span>
      );
    case 'follow':
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
          <UserPlus className="h-4 w-4 text-violet-500" weight={weight} />
        </span>
      );
  }
}

/** 72×72 thumbnail with placeholder when thumbnailUrl is missing. */
function NotificationVideoThumbnail({
  thumbnailUrl,
  title,
  onClick,
}: {
  thumbnailUrl?: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[14px] border-2 border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-label="Video thumbnail unavailable"
          className="flex h-full w-full items-center justify-center bg-muted"
        >
          <BrandLogo className="text-[10px] text-muted-foreground dark:text-muted-foreground" />
        </span>
      )}
    </button>
  );
}

type TFunction = ReturnType<typeof useTranslation>['t'];

/** Format the grouped message text. Returns separate parts for bold/plain rendering. */
function getVerbKey(type: VideoNotification['type']): string {
  switch (type) {
    case 'like':
      return 'notificationsPage.message.liked';
    case 'comment':
      return 'notificationsPage.message.commented';
    case 'repost':
      return 'notificationsPage.message.reposted';
  }
}

interface MessageParts {
  firstName: string;
  othersText: string | null;
  verbText: string;
  titleText: string;
}

function formatGroupedMessage(notification: VideoNotification, t: TFunction): MessageParts {
  const firstName = notification.actors[0]?.displayName ?? '';
  const othersCount = notification.totalCount - 1;
  const othersText =
    othersCount > 0
      ? t('notificationsPage.message.andOthers', { count: othersCount })
      : null;
  const verbText = t(getVerbKey(notification.type));
  const titleText = notification.videoTitle ?? t('notificationsPage.video.untitled');

  return { firstName, othersText, verbText, titleText };
}

// ---------------------------------------------------------------------------
// Public row components
// ---------------------------------------------------------------------------

export function VideoNotificationRow({
  notification,
}: {
  notification: VideoNotification;
}): JSX.Element {
  const { t } = useTranslation('common');
  const navigate = useSubdomainNavigate();

  const { firstName, othersText, verbText, titleText } = formatGroupedMessage(notification, t);

  const handleRowActivate = () => {
    navigate(`/video/${notification.videoEventId}`);
  };

  const handleAvatarClick = (actor: ActorInfo) => {
    navigate(
      buildProfileLinkPath({ pubkey: actor.pubkey, nip05: actor.nip05, fallbackRoute: 'profile' }),
    );
  };

  const handleThumbnailClick = () => {
    navigate(`/video/${notification.videoEventId}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowActivate();
        }
      }}
      className={cn(
        'flex w-full cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted/50',
        !notification.isRead && 'bg-muted/30',
      )}
    >
      {/* Leading type icon chip */}
      <NotificationTypeIconChip type={notification.type} isRead={notification.isRead} />

      {/* Middle: avatar stack + message */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <NotificationAvatarStack
          actors={notification.actors}
          totalCount={notification.totalCount}
          onAvatarClick={(actor, e) => {
            e.stopPropagation();
            handleAvatarClick(actor);
          }}
        />

        {/* Message text — timestamp inlined at end (omitted for comment rows; see quote box below) */}
        <p className="text-sm leading-snug">
          <span className="font-semibold">{firstName}</span>
          {othersText && (
            <>
              {' '}
              <span className="text-muted-foreground">{othersText}</span>
            </>
          )}
          {' '}
          <span className="text-muted-foreground">{verbText}</span>
          {' '}
          <span className="font-semibold">{titleText}</span>
          {notification.type !== 'comment' && (
            <>
              {' · '}
              <span
                data-testid="notification-timestamp"
                className="text-xs text-muted-foreground"
              >
                {formatRelativeTime(notification.timestamp)}
              </span>
            </>
          )}
        </p>

        {/* Comment quote — timestamp lives inside the quote box for comment rows */}
        {notification.type === 'comment' && notification.commentText && (
          <p className="mt-0.5 line-clamp-2 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
            {notification.commentText}
            {' · '}
            <span data-testid="notification-timestamp">
              {formatRelativeTime(notification.timestamp)}
            </span>
          </p>
        )}
      </div>

      {/* Right: thumbnail */}
      <NotificationVideoThumbnail
        thumbnailUrl={notification.videoThumbnailUrl}
        title={titleText}
        onClick={handleThumbnailClick}
      />
    </div>
  );
}

export function ActorNotificationRow({
  notification,
}: {
  notification: ActorNotification;
}): JSX.Element {
  const { t } = useTranslation('common');
  const navigate = useSubdomainNavigate();

  const { actor } = notification;
  const verbText = t('notificationsPage.message.followed');
  const timeText = formatRelativeTime(notification.timestamp);

  const handleRowActivate = () => {
    navigate(
      buildProfileLinkPath({ pubkey: actor.pubkey, nip05: actor.nip05, fallbackRoute: 'profile' }),
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowActivate();
        }
      }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50',
        !notification.isRead && 'bg-muted/30',
      )}
    >
      {/* Leading type icon chip */}
      <NotificationTypeIconChip type="follow" isRead={notification.isRead} />

      {/* Single avatar */}
      <button
        type="button"
        aria-label={`${actor.displayName} profile`}
        onClick={(e) => {
          e.stopPropagation();
          handleRowActivate();
        }}
        className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Avatar size="xs" className="h-7 w-7">
          <AvatarImage src={actor.avatarUrl} alt={actor.displayName} />
          <AvatarFallback>{actor.displayName[0]?.toUpperCase() ?? '?'}</AvatarFallback>
        </Avatar>
      </button>

      {/* Message text */}
      <p className="flex-1 text-sm leading-snug">
        <span className="font-semibold">{actor.displayName}</span>{' '}
        <span className="text-muted-foreground">{verbText}</span>
        {' · '}
        <span className="text-xs text-muted-foreground">{timeText}</span>
      </p>
    </div>
  );
}
