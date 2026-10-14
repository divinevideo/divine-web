// ABOUTME: Tests for the five family routes: verbatim safety copy, cross-links, badges, JSON-LD
// ABOUTME: Guards the hard constraints: CSAM wording, "can't promise" honesty, kids-policy links

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TestApp } from '@/test/TestApp';

import { FamilyHubPage } from './FamilyHubPage';
import { MediaPlanPage } from './MediaPlanPage';
import { SafetyToolsPage } from './SafetyToolsPage';
import { TalkingToYourTeenPage } from './TalkingToYourTeenPage';
import { WhenSomethingGoesWrongPage } from './WhenSomethingGoesWrongPage';

const CSAM_SENTENCE =
  'Use the in-app report flow or Divine support so Divine can review and, where required, report apparent child sexual exploitation to the appropriate reporting channel or authority.';

function getJsonLd(container: HTMLElement): Record<string, unknown>[] {
  return Array.from(
    container.querySelectorAll('script[type="application/ld+json"]')
  ).map((s) => JSON.parse(s.textContent ?? '{}'));
}

function typesOf(container: HTMLElement): string[] {
  return getJsonLd(container).map((d) => String(d['@type']));
}

describe('family pages', () => {
  it('hub keeps the honest can/can’t copy and links all four guides plus /kids', () => {
    const { container } = render(
      <TestApp>
        <FamilyHubPage />
      </TestApp>
    );

    expect(screen.getByText(/What Divine can't promise/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /No app—including Divine—can guarantee a teen will never see adult, upsetting, or harmful content./
      )
    ).toBeInTheDocument();

    for (const href of [
      '/family/talking-to-your-teen',
      '/family/media-plan',
      '/family/when-something-goes-wrong',
      '/family/safety-tools',
      '/kids',
    ]) {
      expect(
        container.querySelector(`a[href="${href}"]`),
        `missing link to ${href}`
      ).toBeTruthy();
    }

    expect(typesOf(container)).toContain('Article');
  });

  it('talking page has starters, FAQ + breadcrumb JSON-LD, and STIR citation', () => {
    const { container } = render(
      <TestApp>
        <TalkingToYourTeenPage />
      </TestApp>
    );

    expect(
      screen.getByText(/Co-navigate, don't surveil/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/One good question per car ride is plenty./)
    ).toBeInTheDocument();

    const types = typesOf(container);
    expect(types).toContain('Article');
    expect(types).toContain('FAQPage');
    expect(types).toContain('BreadcrumbList');

    const article = getJsonLd(container).find((d) => d['@type'] === 'Article');
    expect(JSON.stringify(article)).toContain('Pamela Wisniewski');
    expect(JSON.stringify(article)).toContain('STIR');
  });

  it('media plan page keeps plan columns and feed habits verbatim', () => {
    const { container } = render(
      <TestApp>
        <MediaPlanPage />
      </TestApp>
    );

    expect(
      screen.getByText(/Building a plan for how your family uses media—not just Divine/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Feed habits and healthy stopping points/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A short, monthly check-in beats a once-a-year blow-up./)
    ).toBeInTheDocument();
    // AAP template resources repeated on this page
    expect(screen.getByText('AAP Family Media Plan')).toBeInTheDocument();
    expect(typesOf(container)).toContain('BreadcrumbList');
  });

  it('when-something-goes-wrong keeps the CSAM escalation guidance verbatim', () => {
    const { container } = render(
      <TestApp>
        <WhenSomethingGoesWrongPage />
      </TestApp>
    );

    expect(container.textContent).toContain(CSAM_SENTENCE);
    expect(container.textContent).toContain(
      'download, save, repost, forward, or share suspected child sexual abuse material (CSAM)'
    );

    const types = typesOf(container);
    expect(types).toContain('FAQPage');
    expect(types).toContain('BreadcrumbList');

    const faq = getJsonLd(container).find((d) => d['@type'] === 'FAQPage');
    expect(JSON.stringify(faq)).toContain(
      'report apparent child sexual exploitation'
    );
  });

  it('safety tools page keeps settings rows and the can/can’t section', () => {
    const { container } = render(
      <TestApp>
        <SafetyToolsPage />
      </TestApp>
    );

    expect(screen.getByText('Adult content gating')).toBeInTheDocument();
    expect(screen.getByText(/A note on settings:/)).toBeInTheDocument();
    expect(screen.getByText(/What Divine can't promise/)).toBeInTheDocument();
    expect(typesOf(container)).toContain('BreadcrumbList');
  });

  it.each([
    [FamilyHubPage, 'family'],
    [TalkingToYourTeenPage, 'talking-to-your-teen'],
    [MediaPlanPage, 'media-plan'],
    [WhenSomethingGoesWrongPage, 'when-something-goes-wrong'],
    [SafetyToolsPage, 'safety-tools'],
  ])('renders UTM-tagged store badges (campaign %s)', (Page, campaign) => {
    const { container } = render(
      <TestApp>
        <Page />
      </TestApp>
    );

    const appStore = container.querySelector(
      'a[href*="apps.apple.com"][href*="id6747959501"]'
    ) as HTMLAnchorElement | null;
    const playStore = container.querySelector(
      'a[href*="play.google.com"][href*="co.openvine.app"]'
    ) as HTMLAnchorElement | null;

    expect(appStore, 'App Store badge missing').toBeTruthy();
    expect(playStore, 'Play badge missing').toBeTruthy();
    for (const link of [appStore, playStore]) {
      expect(link?.href).toContain('utm_source=divine_site');
      expect(link?.href).toContain('utm_medium=family_page');
      expect(link?.href).toContain(`utm_campaign=${campaign}`);
    }
  });

  it.each([
    [TalkingToYourTeenPage],
    [MediaPlanPage],
    [WhenSomethingGoesWrongPage],
    [SafetyToolsPage],
  ])('child pages link the hub and /kids', (Page) => {
    const { container } = render(
      <TestApp>
        <Page />
      </TestApp>
    );

    expect(container.querySelector('a[href="/family"]')).toBeTruthy();
    expect(container.querySelector('a[href="/kids"]')).toBeTruthy();
  });
});
