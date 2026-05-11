import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ContentFilterReason } from '@/types/moderation';

const { mockPublishEvent, mockSubmitReportToZendesk, mockBuildContentUrl } = vi.hoisted(() => ({
  mockPublishEvent: vi.fn().mockResolvedValue({}),
  mockSubmitReportToZendesk: vi.fn().mockResolvedValue({ success: true }),
  mockBuildContentUrl: vi.fn().mockReturnValue('https://divine.video/video/event-1'),
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutate: mockPublishEvent,
    mutateAsync: mockPublishEvent,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: 'reporter-pubkey' },
  }),
}));

vi.mock('@/lib/reportApi', () => ({
  submitReportToZendesk: mockSubmitReportToZendesk,
  buildContentUrl: mockBuildContentUrl,
}));

import { useReportContent, toNip56ReportType } from './useModeration';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('toNip56ReportType', () => {
  it.each([
    [ContentFilterReason.CSAM, 'illegal'],
    [ContentFilterReason.VIOLENCE, 'illegal'],
    [ContentFilterReason.COPYRIGHT, 'illegal'],
    [ContentFilterReason.HARASSMENT, 'profanity'],
    [ContentFilterReason.SEXUAL_CONTENT, 'nudity'],
    [ContentFilterReason.FALSE_INFO, 'other'],
    [ContentFilterReason.AI_GENERATED, 'other'],
    [ContentFilterReason.SPAM, 'spam'],
    [ContentFilterReason.IMPERSONATION, 'impersonation'],
    [ContentFilterReason.ILLEGAL, 'illegal'],
    [ContentFilterReason.OTHER, 'other'],
  ])('maps %s to %s', (reason, expected) => {
    expect(toNip56ReportType(reason)).toBe(expected);
  });
});

describe('useReportContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('publishes NIP-56 compliant e/p tags and preserves NS labels', async () => {
    const { result } = renderHook(() => useReportContent(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        eventId: 'event-1',
        pubkey: 'reported-pubkey',
        reason: ContentFilterReason.CSAM,
        contentType: 'video',
      });
    });

    expect(mockPublishEvent).toHaveBeenCalledTimes(1);

    const publishedPayload = mockPublishEvent.mock.calls[0][0] as {
      kind: number;
      tags: string[][];
    };

    expect(publishedPayload.kind).toBe(1984);
    expect(publishedPayload.tags).toContainEqual(['e', 'event-1', 'illegal']);
    expect(publishedPayload.tags).toContainEqual(['p', 'reported-pubkey', 'illegal']);
    expect(publishedPayload.tags).toContainEqual(['L', 'social.nos.ontology']);
    expect(publishedPayload.tags).toContainEqual(['l', 'NS-csam', 'social.nos.ontology']);
    expect(publishedPayload.tags).toContainEqual(['client', 'divine-web']);
    expect(publishedPayload.tags).not.toContainEqual(['e', 'event-1', 'csam']);
    expect(publishedPayload.tags).not.toContainEqual(['p', 'reported-pubkey', 'csam']);

    expect(mockSubmitReportToZendesk).toHaveBeenCalledWith(expect.objectContaining({
      reason: ContentFilterReason.CSAM,
      eventId: 'event-1',
      pubkey: 'reported-pubkey',
    }));
  });
});
