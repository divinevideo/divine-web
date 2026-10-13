import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppCallbackPage } from './AppCallbackPage';
import { initializeI18n } from '@/lib/i18n';

const WARNING = "Don't share this page's address. It's unique to your sign-in for linking accounts.";

function renderAt(address: string) {
  return render(
    <MemoryRouter initialEntries={[address]}>
      <Routes>
        <Route path="/app/callback" element={<AppCallbackPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppCallbackPage', () => {
  beforeAll(async () => {
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  afterEach(() => {
    delete window.__DIVINE_SIGNIN_CODE_STRIPPED__;
    vi.restoreAllMocks();
  });

  it('warns not to share the address when a sign-in code was removed from it', () => {
    window.__DIVINE_SIGNIN_CODE_STRIPPED__ = true;
    renderAt('/app/callback?signin=abc');
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('shows the same warning on the mobile page', () => {
    window.__DIVINE_SIGNIN_CODE_STRIPPED__ = true;
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    renderAt('/app/callback?signin=abc');
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('says nothing extra on an ordinary return', () => {
    renderAt('/app/callback?code=keycast-code');
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('still hands Keycast\'s code to the Android app when a sign-in code was removed', () => {
    window.__DIVINE_SIGNIN_CODE_STRIPPED__ = true;
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14)');
    const assigned: string[] = [];
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, set href(url: string) { assigned.push(url); } } });
    try {
      renderAt('/app/callback?code=keycast-code');
      expect(assigned[0]).toContain('intent://divine.video/app/callback?code=keycast-code');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});
