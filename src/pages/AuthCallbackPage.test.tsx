import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuthCallbackPage from './AuthCallbackPage';

const {
  mockBunker,
  mockClearInviteHandoff,
  mockExchangeDivineLoginCallback,
  mockSaveBunkerUrl,
  mockSaveSession,
} = vi.hoisted(() => ({
  mockBunker: vi.fn<(...args: unknown[]) => Promise<void>>(),
  mockClearInviteHandoff: vi.fn(),
  mockExchangeDivineLoginCallback: vi.fn(),
  mockSaveBunkerUrl: vi.fn(),
  mockSaveSession: vi.fn(),
}));

vi.mock('@/hooks/useLoginActions', () => ({
  useLoginActions: () => ({
    bunker: mockBunker,
  }),
}));

vi.mock('@/hooks/useKeycastSession', () => ({
  useKeycastSession: () => ({
    saveBunkerUrl: mockSaveBunkerUrl,
    saveSession: mockSaveSession,
  }),
}));

vi.mock('@/lib/authHandoff', () => ({
  clearInviteHandoff: mockClearInviteHandoff,
}));

vi.mock('@/lib/divineLogin', () => ({
  parseDivineLoginCallback: (url: string) => {
    const parsed = new URL(url);
    return {
      code: parsed.searchParams.get('code') ?? undefined,
      state: parsed.searchParams.get('state') ?? undefined,
    };
  },
  exchangeDivineLoginCallback: mockExchangeDivineLoginCallback,
}));

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    mockBunker.mockResolvedValue();
    mockExchangeDivineLoginCallback.mockResolvedValue({
      bunkerUri: 'bunker://pubkey?relay=wss://relay.example.com&secret=test',
      returnPath: '/home',
      token: 'jwt-token',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates the returned JWT session and redirects without waiting for bunker login', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?code=test-code&state=test-state']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/home" element={<div>Home Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Finishing sign-in/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockExchangeDivineLoginCallback).toHaveBeenCalled();
      expect(mockSaveSession).toHaveBeenCalledWith('jwt-token', null, false);
      expect(mockSaveBunkerUrl).not.toHaveBeenCalled();
      expect(mockBunker).not.toHaveBeenCalled();
      expect(mockClearInviteHandoff).toHaveBeenCalled();
    });

    await screen.findByText('Home Route');
  });

  it('shows a retry-safe error when callback hydration fails', async () => {
    mockExchangeDivineLoginCallback.mockRejectedValue(new Error('exchange failed'));

    render(
      <MemoryRouter initialEntries={['/auth/callback?code=test-code&state=test-state']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/" element={<div>Landing Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText(/exchange failed/i);
    expect(screen.getByRole('link', { name: /Return to sign in/i })).toHaveAttribute('href', '/');
  });
});
