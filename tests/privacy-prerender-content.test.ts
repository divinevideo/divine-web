import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PrivacyPage } from '@/pages/PrivacyPage';

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/ZendeskWidget', () => ({
  ZendeskWidget: () => null,
}));

const REPO_ROOT = resolve(__dirname, '..');

function readPrerenderedPrivacy(): string {
  return readFileSync(resolve(REPO_ROOT, 'scripts/prerender-content/privacy-content.html'), 'utf8')
    .replace(/\s+/g, ' ');
}

/**
 * Renders the React privacy page and returns its visible text. Searching the
 * .tsx source instead stays green when a paragraph stops rendering, such as
 * one wrapped in `{false && (...)}`. Curly apostrophes are folded to straight
 * ones so switching the copy to &rsquo; does not break the wording checks.
 */
function renderPrivacyPageText(): string {
  const { container, unmount } = render(createElement(MemoryRouter, null, createElement(PrivacyPage)));
  const text = (container.textContent ?? '').replace(/’/g, "'").replace(/\s+/g, ' ');
  unmount();
  return text;
}

describe('prerendered privacy policy', () => {
  it('keeps the Shorebird update-telemetry disclosure in the prerendered copy', () => {
    const source = readPrerenderedPrivacy();

    expect(source).toContain('Divine uses Shorebird to check for and deliver app updates.');
    expect(source).toContain(
      'The installation identifier is not an advertising identifier and is not used for advertising or cross-app tracking.',
    );
  });

  it('keeps the prerendered Shorebird disclosure aligned with the React privacy page', () => {
    const prerendered = readPrerenderedPrivacy();
    const page = renderPrivacyPageText();

    const disclosureSentences = [
      'Divine uses Shorebird to check for and deliver app updates.',
      'Shorebird receives a random identifier unique to that app installation, the app, release, and patch versions, update channel, platform, device architecture, and patch download or installation status.',
      'This information is used to deliver updates, diagnose update failures, and produce aggregated update and active-install analytics.',
      'The installation identifier is not an advertising identifier and is not used for advertising or cross-app tracking.',
    ];

    for (const sentence of disclosureSentences) {
      expect(prerendered, `prerendered copy must contain: ${sentence}`).toContain(sentence);
      expect(page, `PrivacyPage copy must contain: ${sentence}`).toContain(sentence);
    }
  });

  it('keeps the notification activity disclosure aligned with the React privacy page', () => {
    const prerendered = readPrerenderedPrivacy();
    const page = renderPrivacyPageText();

    const disclosureSentences = [
      "When you're signed in, the app tells Divine when you open and close it, and checks in once a minute while it's open.",
      'We use this only to time notifications.',
      'Whether the app is open right now is kept for three minutes.',
      "Each app session's latest check-in, including when it happened, its last reported open or closed state, and visit and sequence numbers, is kept for seven days.",
      'Visit-related notification state for your account is kept until 90 days after its last accepted check-in.',
      "It isn't shown to anyone.",
    ];

    for (const sentence of disclosureSentences) {
      expect(prerendered, `prerendered copy must contain: ${sentence}`).toContain(sentence);
      expect(page, `PrivacyPage copy must contain: ${sentence}`).toContain(sentence);
    }
  });

  it('keeps the notification activity effective date on the React privacy page', () => {
    expect(renderPrivacyPageText()).toContain(
      'The notification activity disclosure in Section 4 is effective November 5, 2026.',
    );
  });
});
