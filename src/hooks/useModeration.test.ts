import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  toNip56ReportType,
  toNip32ReportLabel,
  useReportContent,
  useMuteList,
  useMuteItem,
  useUnmuteItem,
  MUTE_LIST_KIND
} from './useModeration';
import { ContentFilterReason, MuteType } from '@/types/moderation';

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
const mockMuteQuery = vi.fn();
const mockUserPubkey = 'aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344';
const mockReportedPubkey = '11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd';
const mockEventId = 'event1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd';

vi.mock('@/lib/reportApi', () => ({
  submitReportToZendesk: vi.fn().mockResolvedValue(undefined),
  buildContentUrl: vi.fn().mockReturnValue('https://divine.video/v/test'),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: { query: mockMuteQuery },
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

function makeMuteEvent(
  tags: string[][],
  pubkey: string = mockUserPubkey,
  created_at: number = Math.floor(Date.now() / 1000),
  content: string = '',
  id?: string,
): NostrEvent {
  return {
    id: id ?? `mute-${created_at}-${Math.random().toString(36).slice(2, 8)}`,
    pubkey,
    created_at,
    kind: MUTE_LIST_KIND,
    tags,
    content,
    sig: 'sig-placeholder',
  };
}

describe('useMuteList', () => {
  beforeEach(() => {
    mockMuteQuery.mockReset();
  });

  it('queries kind 10000 (NIP-51 mute list)', async () => {
    mockMuteQuery.mockResolvedValue([]);

    const { result } = renderHook(() => useMuteList(mockUserPubkey), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const filter = mockMuteQuery.mock.calls[0][0][0];
    expect(filter.kinds).toEqual([MUTE_LIST_KIND]);
    expect(filter.kinds).not.toEqual([10001]);
    expect(filter.authors).toEqual([mockUserPubkey]);
  });

  it('returns empty array when no mute list exists', async () => {
    mockMuteQuery.mockResolvedValue([]);
    const { result } = renderHook(() => useMuteList(mockUserPubkey), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('parses p/t/word/e tags and ignores foreign tags', async () => {
    const event = makeMuteEvent([
      ['p', 'pubkey-a'],
      ['p', 'pubkey-b', 'reason-b'],
      ['t', 'nsfw'],
      ['word', 'spamword', 'too noisy'],
      ['e', 'event-1'],
      ['a', '34236:pubkey:video-1'],
      ['d', 'something-else'],
    ]);
    mockMuteQuery.mockResolvedValue([event]);

    const { result } = renderHook(() => useMuteList(mockUserPubkey), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { type: MuteType.USER, value: 'pubkey-a', reason: undefined, createdAt: event.created_at },
      { type: MuteType.USER, value: 'pubkey-b', reason: 'reason-b', createdAt: event.created_at },
      { type: MuteType.HASHTAG, value: 'nsfw', reason: undefined, createdAt: event.created_at },
      { type: MuteType.KEYWORD, value: 'spamword', reason: 'too noisy', createdAt: event.created_at },
      { type: MuteType.EVENT, value: 'event-1', reason: undefined, createdAt: event.created_at },
    ]);
  });

  it('selects the most recent event when multiple are returned', async () => {
    const older = makeMuteEvent([['p', 'old']], mockUserPubkey, 1_700_000_000);
    const newer = makeMuteEvent([['p', 'new']], mockUserPubkey, 1_800_000_000);
    mockMuteQuery.mockResolvedValue([older, newer]);

    const { result } = renderHook(() => useMuteList(mockUserPubkey), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].value).toBe('new');
  });

  it('picks lowest id on created_at tie (NIP-01)', async () => {
    const ts = 1_700_000_000;
    const high = makeMuteEvent([['p', 'high-id']], mockUserPubkey, ts, '', 'zzzzzz');
    const low = makeMuteEvent([['p', 'low-id']], mockUserPubkey, ts, '', 'aaaaaa');
    mockMuteQuery.mockResolvedValue([high, low]);

    const { result } = renderHook(() => useMuteList(mockUserPubkey), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].value).toBe('low-id');
  });
});

describe('useMuteItem', () => {
  beforeEach(() => {
    mockMuteQuery.mockReset();
    mockPublishEvent.mockReset();
  });

  it('publishes kind 10000 with the new tag when no mute list exists', async () => {
    mockMuteQuery.mockResolvedValue([]);
    mockPublishEvent.mockResolvedValue({});

    const { result } = renderHook(() => useMuteItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        type: MuteType.USER,
        value: 'target-pubkey',
        reason: 'spam',
      });
    });

    expect(mockPublishEvent).toHaveBeenCalledOnce();
    const call = mockPublishEvent.mock.calls[0][0];
    expect(call.kind).toBe(MUTE_LIST_KIND);
    expect(call.kind).not.toBe(10001);
    expect(call.content).toBe('');
    expect(call.tags).toEqual([['p', 'target-pubkey', 'spam']]);
  });

  it('preserves existing pin and foreign tags when adding a mute (no clobber)', async () => {
    const existing = makeMuteEvent([
      ['a', '34236:somepub:vid-1'],
      ['p', 'existing-pubkey', 'old reason'],
      ['client', 'divine-web'],
    ]);
    mockMuteQuery.mockResolvedValue([existing]);
    mockPublishEvent.mockResolvedValue({});

    const { result } = renderHook(() => useMuteItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        type: MuteType.HASHTAG,
        value: 'nsfw',
      });
    });

    const call = mockPublishEvent.mock.calls[0][0];
    expect(call.kind).toBe(MUTE_LIST_KIND);
    expect(call.tags).toEqual([
      ['a', '34236:somepub:vid-1'],
      ['p', 'existing-pubkey', 'old reason'],
      ['client', 'divine-web'],
      ['t', 'nsfw'],
    ]);
  });

  it('round-trips content (does not wipe NIP-44 encrypted private entries)', async () => {
    const existing = makeMuteEvent(
      [['p', 'already-muted']],
      mockUserPubkey,
      1_700_000_000,
      'nip44-ciphertext-blob',
    );
    mockMuteQuery.mockResolvedValue([existing]);
    mockPublishEvent.mockResolvedValue({});

    const { result } = renderHook(() => useMuteItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ type: MuteType.USER, value: 'new' });
    });

    const call = mockPublishEvent.mock.calls[0][0];
    expect(call.content).toBe('nip44-ciphertext-blob');
  });

  it('rebases on the most recent event when relays return out of order', async () => {
    const stale = makeMuteEvent([['p', 'stale']], mockUserPubkey, 1_600_000_000);
    const latest = makeMuteEvent(
      [['p', 'latest-pre-existing']],
      mockUserPubkey,
      1_700_000_000,
    );
    mockMuteQuery.mockResolvedValue([stale, latest]);
    mockPublishEvent.mockResolvedValue({});

    const { result } = renderHook(() => useMuteItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ type: MuteType.USER, value: 'new' });
    });

    const call = mockPublishEvent.mock.calls[0][0];
    expect(call.tags).toContainEqual(['p', 'latest-pre-existing']);
    expect(call.tags).not.toContainEqual(['p', 'stale']);
    expect(call.tags).toContainEqual(['p', 'new']);
  });

  it('is idempotent: a second mute with same (type,value,reason) is a no-op', async () => {
    const existing = makeMuteEvent([['p', 'dup', 'spam']]);
    mockMuteQuery.mockResolvedValue([existing]);
    mockPublishEvent.mockResolvedValue({});

    const { result } = renderHook(() => useMuteItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        type: MuteType.USER,
        value: 'dup',
        reason: 'spam',
      });
    });

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('useUnmuteItem', () => {
  beforeEach(() => {
    mockMuteQuery.mockReset();
    mockPublishEvent.mockReset();
  });

  it('publishes kind 10000 with the matching tag removed', async () => {
    const existing = makeMuteEvent([
      ['p', 'keep-me'],
      ['p', 'remove-me', 'reason'],
      ['t', 'nsfw'],
    ]);
    mockMuteQuery.mockResolvedValue([existing]);
    mockPublishEvent.mockResolvedValue({});

    const { result } = renderHook(() => useUnmuteItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        type: MuteType.USER,
        value: 'remove-me',
      });
    });

    const call = mockPublishEvent.mock.calls[0][0];
    expect(call.kind).toBe(MUTE_LIST_KIND);
    expect(call.tags).toEqual([
      ['p', 'keep-me'],
      ['t', 'nsfw'],
    ]);
  });

  it('preserves content on unmute', async () => {
    const existing = makeMuteEvent(
      [['p', 'a'], ['p', 'b']],
      mockUserPubkey,
      1_700_000_000,
      'private-encrypted-content',
    );
    mockMuteQuery.mockResolvedValue([existing]);
    mockPublishEvent.mockResolvedValue({});

    const { result } = renderHook(() => useUnmuteItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ type: MuteType.USER, value: 'a' });
    });

    const call = mockPublishEvent.mock.calls[0][0];
    expect(call.content).toBe('private-encrypted-content');
  });

  it('does nothing when no mute list exists', async () => {
    mockMuteQuery.mockResolvedValue([]);
    const { result } = renderHook(() => useUnmuteItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ type: MuteType.USER, value: 'x' });
    });

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('rebases on the most recent event when relays return out of order', async () => {
    const stale = makeMuteEvent([['p', 'stale-remove']], mockUserPubkey, 1_600_000_000);
    const latest = makeMuteEvent(
      [['p', 'latest-remove'], ['p', 'keep']],
      mockUserPubkey,
      1_700_000_000,
    );
    mockMuteQuery.mockResolvedValue([stale, latest]);
    mockPublishEvent.mockResolvedValue({});

    const { result } = renderHook(() => useUnmuteItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ type: MuteType.USER, value: 'latest-remove' });
    });

    const call = mockPublishEvent.mock.calls[0][0];
    expect(call.tags).toContainEqual(['p', 'keep']);
    expect(call.tags).not.toContainEqual(['p', 'latest-remove']);
    expect(call.tags).not.toContainEqual(['p', 'stale-remove']);
  });
});
