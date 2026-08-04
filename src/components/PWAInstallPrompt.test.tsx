import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_STORE_URL } from '@/lib/mobileStoreLinks';
import { PWAInstallPrompt } from './PWAInstallPrompt';

function renderPrompt() {
  return render(
    <MemoryRouter initialEntries={['/discovery']}>
      <Routes>
        <Route path="/discovery" element={<PWAInstallPrompt delayMs={0} />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
}

function setNavigator(options: { userAgent: string; languages: readonly string[] }) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: options.userAgent,
  });
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: options.languages,
  });
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: options.languages[0],
  });
}

describe('PWAInstallPrompt', () => {
  beforeEach(async () => {
    const { initializeI18n } = await import('@/lib/i18n');
    const storage = new Map<string, string>();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });

    await initializeI18n({ force: true, languages: ['en-US'] });

    setViewport(390);
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the native app prompt instead of the PWA install copy on Android', async () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
      languages: ['en-US'],
    });

    renderPrompt();

    expect(await screen.findByRole('heading', { name: 'Get Divine' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Get Divine on Google Play' })).toBeVisible();
    expect(screen.queryByText('Install Divine Web')).not.toBeInTheDocument();
  });

  it('shows the App Store action on iOS', async () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      languages: ['en-NZ'],
    });

    renderPrompt();

    expect(await screen.findByRole('heading', { name: 'Get Divine' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Download Divine on the App Store' })).toHaveAttribute(
      'href',
      APP_STORE_URL,
    );
    expect(screen.queryByRole('link', { name: 'Get Divine on Google Play' })).not.toBeInTheDocument();
  });

  it('shows the App Store action on iOS with a region-less locale', async () => {
    // A bare language tag used to skip the storefront lookup, leaving an iOS
    // visitor with no store action at all — and so no prompt.
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      languages: ['en'],
    });

    renderPrompt();

    expect(await screen.findByRole('link', { name: 'Download Divine on the App Store' })).toBeVisible();
  });

  it('does not inject a third-party lookup script', async () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      languages: ['en-NZ'],
    });

    const scriptsBefore = document.head.getElementsByTagName('script').length;

    renderPrompt();

    expect(await screen.findByRole('link', { name: 'Download Divine on the App Store' })).toBeVisible();
    expect(document.head.getElementsByTagName('script')).toHaveLength(scriptsBefore);
  });
});
