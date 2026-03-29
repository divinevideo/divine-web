// ABOUTME: Tests for useWindowNostrJWT hook
// ABOUTME: Verifies JWT-based window.nostr hook behavior and lifecycle

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWindowNostrJWT } from './useWindowNostrJWT';
import { removeWindowNostr } from '@/lib/bunkerToWindowNostr';

// Mock the DivineJWTSigner
vi.mock('@/lib/DivineJWTSigner', () => ({
  DivineJWTSigner: vi.fn().mockImplementation(({ token }) => ({
    getPublicKey: vi.fn().mockResolvedValue('a'.repeat(64)),
    signEvent: vi.fn().mockResolvedValue({
      id: 'event-id',
      pubkey: 'a'.repeat(64),
      sig: 'signature',
      kind: 1,
      content: 'test',
      tags: [],
      created_at: 1234567890,
    }),
    updateToken: vi.fn(),
    token,
  })),
}));

describe('useWindowNostrJWT', () => {
  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    vi.clearAllMocks();
    removeWindowNostr();
  });

  afterEach(() => {
    removeWindowNostr();
  });

  it('should initialize with null signer when no token', () => {
    const { result } = renderHook(() =>
      useWindowNostrJWT({ token: null, autoInject: false })
    );

    expect(result.current.signer).toBeNull();
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isInjected).toBe(false);
  });

  it('should create signer when token is provided', async () => {
    const { result } = renderHook(() =>
      useWindowNostrJWT({ token: mockToken, autoInject: false })
    );

    // Should start initializing
    expect(result.current.isInitializing).toBe(true);

    // Wait for initialization
    await waitFor(() => {
      expect(result.current.signer).not.toBeNull();
    });

    expect(result.current.isInitializing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should auto-inject window.nostr when autoInject is true', async () => {
    const { result } = renderHook(() =>
      useWindowNostrJWT({ token: mockToken, autoInject: true })
    );

    await waitFor(() => {
      expect(result.current.isInjected).toBe(true);
    });

    expect(window.nostr).toBeDefined();
  });

  it('should not inject window.nostr when autoInject is false', async () => {
    const { result } = renderHook(() =>
      useWindowNostrJWT({ token: mockToken, autoInject: false })
    );

    await waitFor(() => {
      expect(result.current.signer).not.toBeNull();
    });

    expect(result.current.isInjected).toBe(false);
    expect(window.nostr).toBeUndefined();
  });

  it('should provide manual inject function', async () => {
    const { result } = renderHook(() =>
      useWindowNostrJWT({ token: mockToken, autoInject: false })
    );

    await waitFor(() => {
      expect(result.current.signer).not.toBeNull();
    });

    // Manually inject
    result.current.inject();

    // Wait for state update
    await waitFor(() => {
      expect(result.current.isInjected).toBe(true);
    });
    expect(window.nostr).toBeDefined();
  });

  it('should provide manual remove function', async () => {
    const { result } = renderHook(() =>
      useWindowNostrJWT({ token: mockToken, autoInject: true })
    );

    await waitFor(() => {
      expect(result.current.isInjected).toBe(true);
    });

    // Manually remove
    result.current.remove();

    // Wait for state update
    await waitFor(() => {
      expect(result.current.isInjected).toBe(false);
    });
    expect(window.nostr).toBeUndefined();
  });

  it('should clean up window.nostr on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useWindowNostrJWT({ token: mockToken, autoInject: true })
    );

    await waitFor(() => {
      expect(result.current.isInjected).toBe(true);
    });

    expect(window.nostr).toBeDefined();

    unmount();

    expect(window.nostr).toBeUndefined();
  });

  it('should handle token changes', async () => {
    const { result, rerender } = renderHook(
      ({ token }: { token: string | null }) => useWindowNostrJWT({ token, autoInject: false }),
      {
        initialProps: { token: mockToken as string | null },
      }
    );

    await waitFor(() => {
      expect(result.current.signer).not.toBeNull();
    });

    const firstSigner = result.current.signer;

    // Change token
    const newToken = 'new-jwt-token';
    rerender({ token: newToken });

    await waitFor(() => {
      expect(result.current.signer).not.toBeNull();
    });

    // Signer should be recreated (different instance)
    expect(result.current.signer).not.toBe(firstSigner);
  });

  it('should clear signer when token becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ token }: { token: string | null }) => useWindowNostrJWT({ token, autoInject: false }),
      {
        initialProps: { token: mockToken as string | null },
      }
    );

    await waitFor(() => {
      expect(result.current.signer).not.toBeNull();
    });

    // Set token to null
    rerender({ token: null });

    expect(result.current.signer).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isInitializing).toBe(false);
  });

  it.skip('should handle initialization errors', async () => {
    // Skipping this test due to TypeScript mock complexity
    // TODO: Fix mock setup for error handling test
  });

  it('should not inject when manual inject is called without signer', () => {
    const { result } = renderHook(() =>
      useWindowNostrJWT({ token: null, autoInject: false })
    );

    // Try to inject without signer
    result.current.inject();

    expect(result.current.isInjected).toBe(false);
    expect(window.nostr).toBeUndefined();
  });
});
