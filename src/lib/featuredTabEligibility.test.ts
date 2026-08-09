import { describe, expect, it } from 'vitest';

import { isFeaturedTabEligible, selectFeaturedTab } from './featuredTabEligibility';
import type { FeaturedTabConfigRaw } from '@/types/featuredTabs';

function makeConfig(overrides: Partial<FeaturedTabConfigRaw> = {}): FeaturedTabConfigRaw {
  return {
    id: 'ft_1234abcd',
    slug: 'seasonal-theme',
    label: { default: 'Seasonal' },
    position: { web: { after: 'hot' } },
    starts_at: '2026-08-01T00:00:00Z',
    ends_at: '2026-09-01T00:00:00Z',
    enabled: true,
    visible_to_minors: true,
    disclosure_label: null,
    has_content: true,
    ...overrides,
  };
}

describe('featured tab eligibility', () => {
  const now = new Date('2026-08-08T12:00:00Z');

  it('rejects disabled, out-of-window, and empty configurations', () => {
    expect(isFeaturedTabEligible(makeConfig({ enabled: false }), now, 'not_protected')).toBe(false);
    expect(isFeaturedTabEligible(makeConfig({ has_content: false }), now, 'not_protected')).toBe(false);
    expect(isFeaturedTabEligible(makeConfig({ starts_at: '2026-08-09T00:00:00Z' }), now, 'not_protected')).toBe(false);
    expect(isFeaturedTabEligible(makeConfig({ ends_at: '2026-08-07T00:00:00Z' }), now, 'not_protected')).toBe(false);
  });

  it('fails closed for known or unknown protected minor states', () => {
    const config = makeConfig({ visible_to_minors: false });

    expect(isFeaturedTabEligible(config, now, 'not_protected')).toBe(true);
    expect(isFeaturedTabEligible(config, now, 'protected')).toBe(false);
    expect(isFeaturedTabEligible(config, now, 'unknown')).toBe(false);
  });

  it('selects the first eligible tab and resolves display fields', () => {
    const selected = selectFeaturedTab([
      makeConfig({ id: 'ft_disabled', enabled: false }),
      makeConfig({
        id: 'ft_eligible',
        label: { default: 'Default', es: 'Especial' },
        disclosure_label: 'Featured',
      }),
    ], {
      now,
      minorState: 'not_protected',
      locale: 'es-MX',
    });

    expect(selected).toEqual({
      id: 'ft_eligible',
      slug: 'seasonal-theme',
      label: 'Especial',
      position: { after: 'hot' },
      disclosureLabel: 'Featured',
    });
  });

  it('skips configurations whose slug is not a usable discovery route', () => {
    const options = { now, minorState: 'not_protected' as const, locale: 'en' };

    // Discovery lowercases the route segment before matching, so a mixed-case
    // slug renders a tab that a reload cannot resolve.
    expect(selectFeaturedTab([makeConfig({ slug: 'Seasonal-Theme' })], options)).toBeNull();
    expect(selectFeaturedTab([makeConfig({ slug: 'seasonal theme' })], options)).toBeNull();
    expect(selectFeaturedTab([makeConfig({ slug: '../admin' })], options)).toBeNull();
    // Reserved values would shadow a built-in tab and hide the featured panel.
    expect(selectFeaturedTab([makeConfig({ slug: 'hot' })], options)).toBeNull();
    expect(selectFeaturedTab([makeConfig({ slug: 'top' })], options)).toBeNull();
  });

  it('falls through to the next eligible configuration when a slug is unusable', () => {
    const selected = selectFeaturedTab([
      makeConfig({ id: 'ft_bad_slug', slug: 'hashtags' }),
      makeConfig({ id: 'ft_eligible', label: { default: 'Default', es: 'Especial' }, disclosure_label: 'Featured' }),
    ], {
      now,
      minorState: 'not_protected',
      locale: 'es-MX',
    });

    expect(selected).toEqual({
      id: 'ft_eligible',
      slug: 'seasonal-theme',
      label: 'Especial',
      position: { after: 'hot' },
      disclosureLabel: 'Featured',
    });
  });
});
