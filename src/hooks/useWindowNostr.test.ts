// ABOUTME: Tests for useWindowNostr hook
// ABOUTME: Verifies it reports window.nostr as injected only while its bunker signer holds it

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { NostrSigner } from '@nostrify/nostrify';

const { mockCreateWindowNostrFromBunker } = vi.hoisted(() => ({
  mockCreateWindowNostrFromBunker: vi.fn<(bunkerUrl: string, timeout?: number) => Promise<NostrSigner>>(),
}));

vi.mock('@/lib/bunkerToWindowNostr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bunkerToWindowNostr')>()),
  createWindowNostrFromBunker: (bunkerUrl: string, timeout?: number) =>
    mockCreateWindowNostrFromBunker(bunkerUrl, timeout),
}));

import { removeWindowNostr } from '@/lib/bunkerToWindowNostr';
import { useWindowNostr } from './useWindowNostr';

const BUNKER_URL = `bunker://${'b'.repeat(64)}?relay=wss://relay.example&secret=${'c'.repeat(64)}`;

function fakeSigner(): NostrSigner {
  return { getPublicKey: vi.fn(), signEvent: vi.fn() };
}

describe('useWindowNostr', () => {
  afterEach(() => {
    removeWindowNostr();
    // removeWindowNostr leaves a browser extension in place.
    delete window.nostr;
    mockCreateWindowNostrFromBunker.mockReset();
  });

  it('reports window.nostr as injected once its bunker signer is installed', async () => {
    const signer = fakeSigner();
    mockCreateWindowNostrFromBunker.mockResolvedValue(signer);

    const { result } = renderHook(() => useWindowNostr({ bunkerUrl: BUNKER_URL }));

    await waitFor(() => {
      expect(result.current.isInjected).toBe(true);
    });
    expect(window.nostr).toBe(signer);
  });

  it('does not report window.nostr as injected while a browser extension holds it', async () => {
    const extension = fakeSigner();
    window.nostr = extension;
    mockCreateWindowNostrFromBunker.mockResolvedValue(fakeSigner());

    const { result } = renderHook(() => useWindowNostr({ bunkerUrl: BUNKER_URL }));

    await waitFor(() => {
      expect(result.current.signer).not.toBeNull();
    });
    expect(result.current.isInjected).toBe(false);
    expect(window.nostr).toBe(extension);
  });
});
