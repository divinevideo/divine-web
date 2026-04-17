import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotifications, useUnreadNotificationCount } from './useNotifications';
import {
  fetchNotifications,
  fetchUnreadCount,
} from '@/lib/funnelcakeClient';

vi.mock('@/config/api', () => ({
  getFunnelcakeBaseUrl: vi.fn(() => 'https://api.divine.video'),
  getNotificationsBaseUrl: vi.fn(() => 'https://relay.divine.video'),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    user: { pubkey: 'a'.repeat(64) },
    signer: { signEvent: vi.fn() },
  })),
}));

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
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

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the notifications relay base URL for the list query', async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      hasMore: false,
    });

    renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(fetchNotifications).toHaveBeenCalledWith(
        'https://relay.divine.video',
        'a'.repeat(64),
        expect.any(Object),
        expect.objectContaining({ limit: 30 }),
      );
    });
  });

  it('uses the notifications relay base URL for unread count polling', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(7);

    const { result } = renderHook(() => useUnreadNotificationCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBe(7);
    });

    expect(fetchUnreadCount).toHaveBeenCalledWith(
      'https://relay.divine.video',
      'a'.repeat(64),
      expect.any(Object),
      expect.any(AbortSignal),
    );
  });
});
