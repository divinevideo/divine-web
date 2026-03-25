import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuthCallbackPage from './AuthCallbackPage';

const {
  mockClearInviteHandoff,
  mockExchangeDivineLoginCallback,
} = vi.hoisted(() => ({
  mockClearInviteHandoff: vi.fn(),
  mockExchangeDivineLoginCallback: vi.fn(),
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

function renderAuthCallback() {
  return render(
    <MemoryRouter initialEntries={['/auth/callback?code=test-code&state=test-state']}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/home" element={<div>Home Route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthCallbackPage integration', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      clear: () => {
        data.clear();
      },
    };

    vi.stubGlobal('localStorage', storage);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('still redirects after a rerender while the callback exchange is pending', async () => {
    let resolveExchange: ((value: { bunkerUri: string; returnPath: string; token: string }) => void) | undefined;

    mockExchangeDivineLoginCallback.mockReturnValue(new Promise((resolve) => {
      resolveExchange = resolve;
    }));

    const view = renderAuthCallback();

    view.rerender(
      <MemoryRouter initialEntries={['/auth/callback?code=test-code&state=test-state']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/home" element={<div>Home Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    resolveExchange?.({
      bunkerUri: 'bunker://ignored',
      returnPath: '/home',
      token: 'jwt-token',
    });

    expect(await screen.findByText('Home Route')).toBeInTheDocument();
    expect(mockClearInviteHandoff).toHaveBeenCalled();
    expect(localStorage.getItem('keycast_jwt_token')).toBe(JSON.stringify('jwt-token'));
  });
});
