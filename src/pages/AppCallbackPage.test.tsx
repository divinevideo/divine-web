import { BrowserRouter, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('keeps the sign-in code flags for the whole document, across an in-app route change', async () => {
    window.history.replaceState(null, '', `/app/callback?signin=abc#oauth_confirm=${'C'.repeat(43)}`);
    vi.resetModules();
    await import('@/lib/stripSignInCode');
    function GoToDiscovery() {
      const navigate = useNavigate();
      return <button onClick={() => navigate('/discovery')}>Go</button>;
    }
    try {
      render(
        <BrowserRouter>
          <GoToDiscovery />
          <Routes>
            <Route path="/app/callback" element={<AppCallbackPage />} />
            <Route path="/discovery" element={<p>Discovery</p>} />
          </Routes>
        </BrowserRouter>,
      );
      expect(screen.getByText(WARNING)).toBeInTheDocument();

      fireEvent.click(screen.getByText('Go'));

      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/discovery');
      expect(window.__DIVINE_SIGNIN_CODE_STRIPPED__).toBe(true);
      expect(window.__DIVINE_ANALYTICS_DISABLED__).toBe(true);
    } finally {
      delete window.__DIVINE_ANALYTICS_DISABLED__;
      window.history.replaceState(null, '', '/');
    }
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
