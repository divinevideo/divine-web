import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { toNip56ReportType, toNip32ReportLabel, useReportContent } from './useModeration';
import { ContentFilterReason } from '@/types/moderation';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

const mockPublishEvent = vi.fn();
const mockUserPubkey = 'aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344';
const mockReportedPubkey = '11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd';
const mockEventId = 'event1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd';

vi.mock('@/lib/reportApi', () => ({
  submitReportToZendesk: vi.fn().mockResolvedValue(undefined),
  buildContentUrl: vi.fn().mockReturnValue('https://divine.video/v/test'),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: { query: vi.fn() },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: mockUserPubkey },
  }),
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublishEvent,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('toNip56ReportType', () => {
  it('maps every ContentFilterReason to a valid NIP-56 type', () => {
    const validTypes = ['nudity', 'malware', 'profanity', 'illegal', 'spam', 'impersonation', 'other'];
    for (const reason of Object.values(ContentFilterReason)) {
      const result = toNip56ReportType(reason);
      expect(validTypes).toContain(result);
    }
  });

  it('aligns with mobile mappings', () => {
    expect(toNip56ReportType(ContentFilterReason.SPAM)).toBe('spam');
    expect(toNip56ReportType(ContentFilterReason.HARASSMENT)).toBe('profanity');
    expect(toNip56ReportType(ContentFilterReason.VIOLENCE)).toBe('illegal');
    expect(toNip56ReportType(ContentFilterReason.SEXUAL_CONTENT)).toBe('nudity');
    expect(toNip56ReportType(ContentFilterReason.COPYRIGHT)).toBe('illegal');
    expect(toNip56ReportType(ContentFilterReason.FALSE_INFO)).toBe('other');
    expect(toNip56ReportType(ContentFilterReason.CHILD_SAFETY)).toBe('other');
    expect(toNip56ReportType(ContentFilterReason.CSAM)).toBe('illegal');
    expect(toNip56ReportType(ContentFilterReason.UNDERAGE_USER)).toBe('other');
    expect(toNip56ReportType(ContentFilterReason.AI_GENERATED)).toBe('other');
    expect(toNip56ReportType(ContentFilterReason.IMPERSONATION)).toBe('impersonation');
    expect(toNip56ReportType(ContentFilterReason.ILLEGAL)).toBe('illegal');
    expect(toNip56ReportType(ContentFilterReason.OTHER)).toBe('other');
  });
});

describe('toNip32ReportLabel', () => {
  it('maps every ContentFilterReason to an NS-prefixed label', () => {
    for (const reason of Object.values(ContentFilterReason)) {
      const result = toNip32ReportLabel(reason);
      expect(result).toMatch(/^NS-/);
    }
  });

  it('uses camelCase values aligned with mobile', () => {
    expect(toNip32ReportLabel(ContentFilterReason.SEXUAL_CONTENT)).toBe('NS-sexualContent');
    expect(toNip32ReportLabel(ContentFilterReason.FALSE_INFO)).toBe('NS-falseInformation');
    expect(toNip32ReportLabel(ContentFilterReason.CHILD_SAFETY)).toBe('NS-childSafety');
    expect(toNip32ReportLabel(ContentFilterReason.CSAM)).toBe('NS-csam');
    expect(toNip32ReportLabel(ContentFilterReason.UNDERAGE_USER)).toBe('NS-underageUser');
    expect(toNip32ReportLabel(ContentFilterReason.AI_GENERATED)).toBe('NS-aiGenerated');
  });

  it('does not leak raw enum values like kebab-case', () => {
    expect(toNip32ReportLabel(ContentFilterReason.SEXUAL_CONTENT)).not.toContain('sexual-content');
    expect(toNip32ReportLabel(ContentFilterReason.FALSE_INFO)).not.toContain('false-info');
    expect(toNip32ReportLabel(ContentFilterReason.CHILD_SAFETY)).not.toContain('child-safety');
    expect(toNip32ReportLabel(ContentFilterReason.UNDERAGE_USER)).not.toContain('underage-user');
    expect(toNip32ReportLabel(ContentFilterReason.AI_GENERATED)).not.toContain('ai-generated');
  });
});

describe('useReportContent', () => {
  beforeEach(() => {
    mockPublishEvent.mockReset();
    localStorage.clear();
  });

  it('emits both e and p tags when reporting a comment', async () => {
    mockPublishEvent.mockResolvedValue({ id: 'test' });

    const { result } = renderHook(() => useReportContent(), { wrapper: createWrapper() });

    await act(() =>
      result.current.mutateAsync({
        eventId: mockEventId,
        pubkey: mockReportedPubkey,
        reason: ContentFilterReason.SPAM,
        contentType: 'comment',
      })
    );

    expect(mockPublishEvent).toHaveBeenCalledOnce();
    const call = mockPublishEvent.mock.calls[0][0];

    expect(call.kind).toBe(1984);

    const pTag = call.tags.find((t: string[]) => t[0] === 'p');
    const eTag = call.tags.find((t: string[]) => t[0] === 'e');

    expect(pTag).toEqual(['p', mockReportedPubkey, 'spam']);
    expect(eTag).toEqual(['e', mockEventId, 'spam']);
  });

  it('emits only p tag when reporting a user', async () => {
    mockPublishEvent.mockResolvedValue({ id: 'test' });

    const { result } = renderHook(() => useReportContent(), { wrapper: createWrapper() });

    await act(() =>
      result.current.mutateAsync({
        pubkey: mockReportedPubkey,
        reason: ContentFilterReason.IMPERSONATION,
        contentType: 'user',
      })
    );

    expect(mockPublishEvent).toHaveBeenCalledOnce();
    const call = mockPublishEvent.mock.calls[0][0];

    const pTag = call.tags.find((t: string[]) => t[0] === 'p');
    const eTag = call.tags.find((t: string[]) => t[0] === 'e');

    expect(pTag).toEqual(['p', mockReportedPubkey, 'impersonation']);
    expect(eTag).toBeUndefined();
  });

  it('propagates publish failures', async () => {
    mockPublishEvent.mockRejectedValue(new Error('relay timeout'));

    const { result } = renderHook(() => useReportContent(), { wrapper: createWrapper() });

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          pubkey: mockReportedPubkey,
          reason: ContentFilterReason.SPAM,
        });
      } catch (e) {
        error = e;
      }
    });

    expect(mockPublishEvent).toHaveBeenCalledOnce();
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('relay timeout');
  });

  it('always includes L and l tags for NIP-32 label namespace', async () => {
    mockPublishEvent.mockResolvedValue({ id: 'test' });

    const { result } = renderHook(() => useReportContent(), { wrapper: createWrapper() });

    await act(() =>
      result.current.mutateAsync({
        pubkey: mockReportedPubkey,
        reason: ContentFilterReason.HARASSMENT,
      })
    );

    const call = mockPublishEvent.mock.calls[0][0];
    expect(call.tags).toContainEqual(['L', 'social.nos.ontology']);
    expect(call.tags).toContainEqual(['l', 'NS-harassment', 'social.nos.ontology']);
  });
});
