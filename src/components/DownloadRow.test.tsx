// ABOUTME: Tests for the homepage download row
// ABOUTME: Every distribution channel must be present and attributed

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DownloadRow } from './DownloadRow';

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

function hrefFor(label: string): string {
  return screen.getByLabelText(label).getAttribute('href') ?? '';
}

describe('DownloadRow', () => {
  it('links to the three distribution channels', () => {
    render(<DownloadRow />);

    expect(hrefFor('Download Divine on the App Store')).toContain('apps.apple.com');
    expect(hrefFor('Get Divine on Google Play')).toContain('play.google.com');
    expect(hrefFor('Get Divine on Zapstore')).toContain('zapstore');
  });

  it('no longer surfaces a GitHub link', () => {
    render(<DownloadRow />);
    expect(screen.queryByLabelText(/github/i)).toBeNull();
  });

  it('carries the iOS app id and Android package', () => {
    render(<DownloadRow />);

    expect(hrefFor('Download Divine on the App Store')).toContain('id6747959501');
    expect(hrefFor('Get Divine on Google Play')).toContain('co.openvine.app');
  });

  // Pinned exactly: Zapstore's path is /apps/ (plural) and a typo here produces
  // a link that looks plausible but 404s.
  it('points at the exact Zapstore listing', () => {
    render(<DownloadRow />);

    expect(hrefFor('Get Divine on Zapstore')).toBe(
      'https://zapstore.dev/apps/co.openvine.app',
    );
  });

  it('tags store links with the given campaign and medium', () => {
    render(<DownloadRow campaign="launch" medium="homepage" />);

    const appStore = hrefFor('Download Divine on the App Store');
    expect(appStore).toContain('utm_source=divine_site');
    expect(appStore).toContain('utm_medium=homepage');
    expect(appStore).toContain('utm_campaign=launch');
  });

  it('defaults to homepage attribution', () => {
    render(<DownloadRow />);
    expect(hrefFor('Download Divine on the App Store')).toContain('utm_medium=homepage');
  });

  it('opens external destinations safely', () => {
    render(<DownloadRow />);

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });
});
