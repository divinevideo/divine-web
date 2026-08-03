import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotifications, useUnreadNotificationCount, useMarkNotificationsRead } from './useNotifications';

const { mockFetchNotifications, mockFetchUnreadCount } = vi.hoisted(() => ({
  mockFetchNotifications: vi.fn(),
  mockFetchUnreadCount: vi.fn(),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: 'a'.repeat(64) },
    signer: { signEvent: vi.fn(), getPublicKey: vi.fn() },
  }),
}));

vi.mock('@/config/api', () => ({
  getFunnelcakeBaseUrl: () => 'https://api.divine.video',
  getNotificationsBaseUrl: () => 'https://relay.divine.video',
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchNotifications: mockFetchNotifications,
  fetchUnreadCount: mockFetchUnreadCount,
  markNotificationsRead: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      hasMore: false,
    });
    mockFetchUnreadCount.mockResolvedValue(0);
  });

  it('maps the likes category to the backend reaction filter on the notifications relay', async () => {
    renderHook(() => useNotifications({ category: 'likes' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetchNotifications).toHaveBeenCalledWith(
        'https://relay.divine.video',
        'a'.repeat(64),
        expect.any(Object),
        expect.objectContaining({
          limit: 30,
          before: undefined,
          types: ['reaction'],
          unreadOnly: false,
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  it('requests both backend comment types for the comments category', async () => {
    renderHook(() => useNotifications({ category: 'comments' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetchNotifications).toHaveBeenCalledWith(
        'https://relay.divine.video',
        'a'.repeat(64),
        expect.any(Object),
        expect.objectContaining({
          limit: 30,
          before: undefined,
          // Funnelcake emits `comment` for top-level comments and `reply`
          // for threaded replies; asking for only one hides the other.
          types: ['reply', 'comment'],
          unreadOnly: false,
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  it('uses the notifications relay base URL for unread count polling', async () => {
    mockFetchUnreadCount.mockResolvedValue(7);

    const { result } = renderHook(() => useUnreadNotificationCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBe(7);
    });

    expect(mockFetchUnreadCount).toHaveBeenCalledWith(
      'https://relay.divine.video',
      'a'.repeat(64),
      expect.any(Object),
      expect.any(AbortSignal),
    );
  });

  it('applies the optimistic read flag to the category-keyed list cache', async () => {
    // The list is cached under ['notifications', pubkey, category]. An exact-key
    // write to ['notifications', pubkey] matches nothing, leaving every row
    // unread in cache and re-triggering mark-all-read on the next mount.
    const pubkey = 'a'.repeat(64);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    queryClient.setQueryData(['notifications', pubkey, 'all'], {
      pages: [{ notifications: [{ id: 'n1', isRead: false }], unreadCount: 1, hasMore: false }],
      pageParams: [undefined],
    });

    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper });

    result.current.mutate(undefined);

    await waitFor(() => {
      const cached = queryClient.getQueryData(['notifications', pubkey, 'all']) as {
        pages: { notifications: { isRead: boolean }[] }[];
      };
      expect(cached.pages[0].notifications[0].isRead).toBe(true);
    });
  });
});
