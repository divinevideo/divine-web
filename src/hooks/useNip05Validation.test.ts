// ABOUTME: Tests that useNip05Validation only verifies a NIP-05 whose domain names this exact pubkey
// ABOUTME: Mention and profile labels show a handle only when this hook says it is valid

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useNip05Validation } from './useNip05Validation';

vi.mock('@/lib/debug', () => ({ debugLog: vi.fn() }));

const PUBKEY = 'a'.repeat(64);
const fetchMock = vi.fn();

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

function serve(names: Record<string, string>) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ names }) });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useNip05Validation', () => {
  // Every character NIP-05 allows validates, including the `_` of `_@alice.divine.video`.
  // Mixed-case local parts predate the NIP-05 charset check and keep validating.
  it.each(['alice', 'Alice', '_', 'a.b-c_d'])('validates %s, which the domain maps to this pubkey', async (name) => {
    serve({ [name]: PUBKEY });
    const { result } = renderHook(() => useNip05Validation(`${name}@example.com`, PUBKEY), { wrapper });
    await waitFor(() => expect(result.current.state).toBe('valid'));
    expect(fetchMock).toHaveBeenCalledWith(
      `https://example.com/.well-known/nostr.json?name=${name}`,
      expect.anything(),
    );
  });

  it('rejects a name the domain maps to a different pubkey', async () => {
    serve({ alice: 'b'.repeat(64) });
    const { result } = renderHook(() => useNip05Validation('alice@example.com', PUBKEY), { wrapper });
    await waitFor(() => expect(result.current.state).toBe('invalid'));
  });

  it.each(['alice@divine.video@evil.example', 'Ali ce@example.com', 'alice/x@example.com'])(
    'rejects %s, whose local part breaks NIP-05, without asking the domain',
    async (nip05) => {
      // A server the claimant controls could answer for any local part it is asked about.
      const atIndex = nip05.lastIndexOf('@');
      serve({ [nip05.slice(0, atIndex)]: PUBKEY });
      const { result } = renderHook(() => useNip05Validation(nip05, PUBKEY), { wrapper });
      await waitFor(() => expect(result.current.state).toBe('invalid'));
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
