// ABOUTME: Tests for grouped notification row components
// ABOUTME: Covers VideoNotificationRow and ActorNotificationRow rendering and navigation

import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18n } from '@/lib/i18n';
import { VideoNotificationRow, ActorNotificationRow } from './NotificationRows';
import type { VideoNotification, ActorNotification } from '@/types/notification';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

// buildProfileLinkPath is a pure function — let it run for real

function buildVideoNotification(
  overrides: Partial<VideoNotification> = {},
): VideoNotification {
  return {
    id: 'notif-1',
    rawIds: ['raw-1'],
    timestamp: 1_700_000_000,
    isRead: true,
    kind: 'video',
    type: 'like',
    videoEventId: 'event-abc123',
    videoTitle: 'My Cool Loop',
    videoThumbnailUrl: 'https://example.com/thumb.jpg',
    actors: [
      {
        pubkey: 'a'.repeat(64),
        displayName: 'Alice',
        avatarUrl: 'https://example.com/alice.jpg',
        nip05: 'alice@example.com',
      },
    ],
    totalCount: 1,
    ...overrides,
  };
}

function buildActorNotification(
  overrides: Partial<ActorNotification> = {},
): ActorNotification {
  return {
    id: 'notif-follow-1',
    rawIds: ['raw-f1'],
    timestamp: 1_700_000_000,
    isRead: true,
    kind: 'actor',
    type: 'follow',
    actor: {
      pubkey: 'b'.repeat(64),
      displayName: 'Bob',
      avatarUrl: 'https://example.com/bob.jpg',
      nip05: 'bob@example.com',
    },
    ...overrides,
  };
}

describe('VideoNotificationRow', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('single-actor like row shows one avatar, the actor name, liked your video, title, and thumbnail', () => {
    const notification = buildVideoNotification();
    render(<VideoNotificationRow notification={notification} />);

    // Actor name visible
    expect(screen.getByText('Alice')).toBeInTheDocument();

    // Message verb
    expect(screen.getByText('liked your video')).toBeInTheDocument();

    // Video title
    expect(screen.getByText('My Cool Loop')).toBeInTheDocument();

    // Thumbnail image rendered
    const img = screen.getByRole('img', { name: /My Cool Loop/ });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');

    // No overflow text (totalCount === 1)
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/others/)).not.toBeInTheDocument();
  });

  it('does not repeat "your video" as both verb copy and fallback title for untitled videos', () => {
    const notification = buildVideoNotification({
      videoTitle: undefined,
    });
    render(<VideoNotificationRow notification={notification} />);

    const timestampEl = screen.getByTestId('notification-timestamp');
    const messageText = timestampEl.closest('button')?.textContent ?? '';

    expect(messageText).toContain('Alice liked your video');
    expect(messageText).not.toContain('liked your video your video');
  });

  it('totalCount 14 with 3 actors shows +11 overflow and "and 13 others"', () => {
    const notification = buildVideoNotification({
      actors: [
        { pubkey: 'a'.repeat(64), displayName: 'Alice', avatarUrl: undefined },
        { pubkey: 'b'.repeat(64), displayName: 'Bob', avatarUrl: undefined },
        { pubkey: 'c'.repeat(64), displayName: 'Carol', avatarUrl: undefined },
      ],
      totalCount: 14,
    });
    render(<VideoNotificationRow notification={notification} />);

    // Overflow circle
    expect(screen.getByText('+11')).toBeInTheDocument();

    // "and 13 others" in message (full conjunction phrase, not bare "13 others")
    expect(screen.getByText('and 13 others')).toBeInTheDocument();
  });

  it('renders "and N others" phrase as a single i18n string (no bare English "and" literal)', () => {
    // Regression guard: ensures the "and" comes from i18n, not a hardcoded JSX literal
    const notification = buildVideoNotification({
      actors: [
        { pubkey: 'a'.repeat(64), displayName: 'Samm', avatarUrl: undefined },
      ],
      totalCount: 14,
    });
    render(<VideoNotificationRow notification={notification} />);

    // The full conjunction phrase must be present as a rendered text node
    expect(screen.getByText('and 13 others')).toBeInTheDocument();
    // There must be no standalone "and" text node
    expect(screen.queryByText(/^and$/)).not.toBeInTheDocument();
  });

  it('comment row with commentText shows muted quote and timestamp inside quote box', () => {
    const notification = buildVideoNotification({
      type: 'comment',
      commentText: 'Great video!',
    });
    render(<VideoNotificationRow notification={notification} />);

    expect(screen.getByText('commented on your video')).toBeInTheDocument();

    // Timestamp is inside the comment quote box (not at end of message paragraph)
    const timestampEl = screen.getByTestId('notification-timestamp');
    expect(timestampEl.textContent).not.toBe('');

    // The quote box paragraph contains both the comment text and the timestamp
    const quoteBox = timestampEl.closest('p');
    expect(quoteBox).toBeInTheDocument();
    expect(quoteBox?.textContent).toContain('Great video!');
  });

  it('comment row without commentText still shows a timestamp', () => {
    const notification = buildVideoNotification({
      type: 'comment',
      commentText: '',
    });
    render(<VideoNotificationRow notification={notification} />);

    const timestampEl = screen.getByTestId('notification-timestamp');
    expect(timestampEl.textContent).not.toBe('');
  });

  it('missing thumbnail renders a placeholder with accessible text and BrandLogo', () => {
    const notification = buildVideoNotification({
      videoThumbnailUrl: undefined,
    });
    render(<VideoNotificationRow notification={notification} />);

    const placeholder = screen.getByLabelText('Video thumbnail unavailable');
    expect(placeholder).toBeInTheDocument();

    // BrandLogo (renders "Divine" text) is inside the placeholder
    expect(placeholder.textContent).toContain('Divine');
  });

  it('empty-string thumbnail also renders BrandLogo placeholder (falsy check)', () => {
    const notification = buildVideoNotification({
      videoThumbnailUrl: '',
    });
    render(<VideoNotificationRow notification={notification} />);

    const placeholder = screen.getByLabelText('Video thumbnail unavailable');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder.textContent).toContain('Divine');
  });

  it('like row timestamp is inlined inside the message paragraph', () => {
    const notification = buildVideoNotification({ type: 'like' });
    render(<VideoNotificationRow notification={notification} />);

    const timestampEl = screen.getByTestId('notification-timestamp');
    expect(timestampEl.textContent).not.toBe('');

    const messageButton = timestampEl.closest('button');
    expect(messageButton).toBeInTheDocument();
    expect(messageButton?.textContent).toContain('Alice');
    expect(messageButton?.textContent).toContain('liked your video');
  });

  it('thumbnail click navigates to /video/:videoEventId and does not double-fire row navigation', () => {
    const notification = buildVideoNotification();
    render(<VideoNotificationRow notification={notification} />);

    const thumbBtn = screen.getByRole('button', { name: /Open My Cool Loop/i });
    fireEvent.click(thumbBtn);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/video/event-abc123');
  });

  it('message click navigates to /video/:videoEventId', () => {
    const notification = buildVideoNotification();
    render(<VideoNotificationRow notification={notification} />);

    fireEvent.click(screen.getByRole('button', { name: /Alice liked your video My Cool Loop/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/video/event-abc123');
  });

  it('avatar click navigates to actor profile path and does not trigger row navigation', () => {
    const notification = buildVideoNotification();
    render(<VideoNotificationRow notification={notification} />);

    const avatarBtn = screen.getByRole('button', { name: /Alice profile/i });
    fireEvent.click(avatarBtn);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    // Should navigate to profile, not video (nip05 is URL-encoded)
    expect(mockNavigate.mock.calls[0][0]).toContain('/u/alice');
  });

  it('does not render nested interactive row buttons', () => {
    const notification = buildVideoNotification();
    const { container } = render(<VideoNotificationRow notification={notification} />);

    expect(container.querySelector('[role="button"] button')).not.toBeInTheDocument();
    expect(container.querySelector('button button')).not.toBeInTheDocument();
  });
});

describe('ActorNotificationRow', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('follow row shows one avatar, followed you, and navigates to profile on message click', () => {
    const notification = buildActorNotification();
    render(<ActorNotificationRow notification={notification} />);

    // Actor name
    expect(screen.getByText('Bob')).toBeInTheDocument();

    // Message
    expect(screen.getByText('followed you')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Bob followed you/i }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][0]).toContain('/u/bob');
  });

  it('does not render nested interactive row buttons', () => {
    const notification = buildActorNotification();
    const { container } = render(<ActorNotificationRow notification={notification} />);

    expect(container.querySelector('[role="button"] button')).not.toBeInTheDocument();
    expect(container.querySelector('button button')).not.toBeInTheDocument();
  });
});
