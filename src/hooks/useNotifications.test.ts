import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotifications, useUnreadNotificationCount } from './useNotifications';

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

  it('uses the notifications relay base URL for the list query and category filters', async () => {
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
          types: ['like'],
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
});
