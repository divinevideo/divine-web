import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

async function resolveLatestAppStoreLookup(result: unknown) {
  let script: HTMLScriptElement | null = null;
  await waitFor(() => {
    script = document.head.querySelector<HTMLScriptElement>('script[src*="itunes.apple.com/lookup"]');
    expect(script).not.toBeNull();
  });

  const callback = new URL(script!.src).searchParams.get('callback');
  expect(callback).toBeTruthy();

  await act(async () => {
    (window as unknown as Record<string, (value: unknown) => void>)[callback!](result);
    await Promise.resolve();
  });
}

describe('PWAInstallPrompt', () => {
  beforeEach(() => {
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

    setViewport(390);
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    document.head.querySelectorAll('script[src*="itunes.apple.com/lookup"]').forEach((script) => script.remove());
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

  it('shows an App Store action only when Apple lookup finds the regional listing', async () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      languages: ['en-NZ'],
    });

    renderPrompt();

    await resolveLatestAppStoreLookup({
      resultCount: 1,
      results: [{ trackViewUrl: 'https://apps.apple.com/nz/app/divine-video/id6747959501?uo=4' }],
    });

    expect(await screen.findByRole('heading', { name: 'Get Divine' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Download Divine on the App Store' })).toHaveAttribute(
      'href',
      'https://apps.apple.com/nz/app/divine-video/id6747959501?uo=4',
    );
  });
});
