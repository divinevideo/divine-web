// ABOUTME: Pins the commit-time beforeCommit guard on useLoginActions'
// ABOUTME: extension/bunker logins (#182, dcadenas review on #476).

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLoginActions } from './useLoginActions';

const {
  mockAddLogin,
  mockFromBunker,
  mockFromExtension,
  mockSetLoginCookie,
} = vi.hoisted(() => ({
  mockAddLogin: vi.fn(),
  mockFromBunker: vi.fn(),
  mockFromExtension: vi.fn(),
  mockSetLoginCookie: vi.fn(),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: vi.fn() } }),
}));

vi.mock('@nostrify/react/login', () => ({
  NLogin: {
    fromBunker: mockFromBunker,
    fromExtension: mockFromExtension,
  },
  useNostrLogin: () => ({
    logins: [],
    addLogin: mockAddLogin,
    removeLogin: vi.fn(),
  }),
}));

vi.mock('@/lib/crossSubdomainAuth', () => ({
  clearLoginCookie: vi.fn(),
  setLoginCookie: mockSetLoginCookie,
}));

const EXTENSION_LOGIN = {
  type: 'extension',
  pubkey: 'a'.repeat(64),
};

const BUNKER_LOGIN = {
  type: 'bunker',
  pubkey: 'b'.repeat(64),
  data: { bunkerPubkey: 'c'.repeat(64) },
};

const BUNKER_URI = 'bunker://remote-signer.example?relay=wss%3A%2F%2Frelay.example';

describe('useLoginActions commit-time guard (#182)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extension()', () => {
    it('runs the guard only after the extension handshake resolves, then commits', async () => {
      let resolveHandshake!: (login: typeof EXTENSION_LOGIN) => void;
      mockFromExtension.mockImplementation(
        () => new Promise((resolve) => { resolveHandshake = resolve; }),
      );
      const beforeCommit = vi.fn(() => true);
      const { result } = renderHook(() => useLoginActions());

      const pending = result.current.extension({ beforeCommit });
      // Commit-time, not pre-handshake: the guard must not run while the
      // extension prompt is still open.
      expect(beforeCommit).not.toHaveBeenCalled();

      resolveHandshake(EXTENSION_LOGIN);
      await expect(pending).resolves.toBe(true);

      expect(beforeCommit).toHaveBeenCalledTimes(1);
      expect(mockAddLogin).toHaveBeenCalledWith(EXTENSION_LOGIN);
      expect(mockSetLoginCookie).toHaveBeenCalledWith({
        type: 'extension',
        pubkey: EXTENSION_LOGIN.pubkey,
      });
    });

    it('aborts without committing anything when the guard refuses at the boundary', async () => {
      mockFromExtension.mockResolvedValue(EXTENSION_LOGIN);
      const { result } = renderHook(() => useLoginActions());

      await expect(result.current.extension({ beforeCommit: () => false })).resolves.toBe(false);

      expect(mockAddLogin).not.toHaveBeenCalled();
      expect(mockSetLoginCookie).not.toHaveBeenCalled();
    });

    it('commits when called without options (positive control)', async () => {
      mockFromExtension.mockResolvedValue(EXTENSION_LOGIN);
      const { result } = renderHook(() => useLoginActions());

      await expect(result.current.extension()).resolves.toBe(true);

      expect(mockAddLogin).toHaveBeenCalledWith(EXTENSION_LOGIN);
      expect(mockSetLoginCookie).toHaveBeenCalledWith({
        type: 'extension',
        pubkey: EXTENSION_LOGIN.pubkey,
      });
    });
  });

  describe('bunker()', () => {
    it('runs the guard only after the bunker connect resolves, then commits', async () => {
      let resolveConnect!: (login: typeof BUNKER_LOGIN) => void;
      mockFromBunker.mockImplementation(
        () => new Promise((resolve) => { resolveConnect = resolve; }),
      );
      const beforeCommit = vi.fn(() => true);
      const { result } = renderHook(() => useLoginActions());

      const pending = result.current.bunker(BUNKER_URI, { beforeCommit });
      expect(mockFromBunker).toHaveBeenCalledWith(BUNKER_URI, expect.anything());
      expect(beforeCommit).not.toHaveBeenCalled();

      resolveConnect(BUNKER_LOGIN);
      await expect(pending).resolves.toBe(true);

      expect(beforeCommit).toHaveBeenCalledTimes(1);
      expect(mockAddLogin).toHaveBeenCalledWith(BUNKER_LOGIN);
      expect(mockSetLoginCookie).toHaveBeenCalledWith({
        type: 'bunker',
        pubkey: BUNKER_LOGIN.pubkey,
        bunkerData: BUNKER_LOGIN.data,
      });
    });

    it('aborts without committing anything when the guard refuses at the boundary', async () => {
      mockFromBunker.mockResolvedValue(BUNKER_LOGIN);
      const { result } = renderHook(() => useLoginActions());

      await expect(result.current.bunker(BUNKER_URI, { beforeCommit: () => false })).resolves.toBe(false);

      expect(mockAddLogin).not.toHaveBeenCalled();
      expect(mockSetLoginCookie).not.toHaveBeenCalled();
    });

    it('commits when called without options (positive control)', async () => {
      mockFromBunker.mockResolvedValue(BUNKER_LOGIN);
      const { result } = renderHook(() => useLoginActions());

      await expect(result.current.bunker(BUNKER_URI)).resolves.toBe(true);

      expect(mockAddLogin).toHaveBeenCalledWith(BUNKER_LOGIN);
    });
  });
});
