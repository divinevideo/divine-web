import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/mobileStoreLinks';
import { MobileAppLink } from './MobileAppLink';

const currentUser = vi.hoisted(() => ({ value: null as { pubkey: string } | null }));

vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: currentUser.value }) }));
// The visible text and the store names are separate strings, so a locale whose
// store phrase does not repeat the visible text would still pass the name check.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => ({
  'pwaInstallPrompt.getDivine': 'Divine holen',
  'pwaInstallPrompt.appStore': 'App Store',
  'pwaInstallPrompt.googlePlay': 'Google Play',
} as Record<string, string>)[key] ?? key }) }));

function setPlatform(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent });
}

describe('MobileAppLink', () => {
  beforeEach(() => {
    currentUser.value = null;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it('links to the iOS store for an anonymous iPhone viewer', () => {
    setPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    render(<MobileAppLink />);
    expect(screen.getByRole('link', { name: 'Divine holen (App Store)' })).toHaveAttribute('href', APP_STORE_URL);
  });

  it('links to Google Play for an anonymous Android viewer', () => {
    setPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    render(<MobileAppLink />);
    expect(screen.getByRole('link', { name: 'Divine holen (Google Play)' })).toHaveAttribute('href', PLAY_STORE_URL);
  });

  it('keeps the visible text inside the accessible name (WCAG 2.5.3 Label in Name)', () => {
    for (const userAgent of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'Mozilla/5.0 (Linux; Android 14; Pixel 8)']) {
      setPlatform(userAgent);
      const { unmount } = render(<MobileAppLink />);
      const link = screen.getByRole('link');
      expect(link.getAttribute('aria-label')).toContain(link.textContent ?? '');
      unmount();
    }
  });

  it('stays hidden for signed-in, desktop, and installed viewers', () => {
    setPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)');
    const { rerender } = render(<MobileAppLink />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    setPlatform('Mozilla/5.0 (iPhone)');
    currentUser.value = { pubkey: 'a'.repeat(64) };
    rerender(<MobileAppLink />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    currentUser.value = null;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    rerender(<MobileAppLink />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
