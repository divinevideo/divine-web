// ABOUTME: Tests for the family/marketing SEO route table
// ABOUTME: Guards unique per-route meta, self-canonicals, brand voice (no exclamation marks)

import { describe, expect, it } from 'vitest';

import { FAMILY_SEO, getFamilySeo, SITE_ORIGIN } from './marketingSeo';

describe('FAMILY_SEO', () => {
  const paths = [
    '/family',
    '/family/talking-to-your-teen',
    '/family/media-plan',
    '/family/when-something-goes-wrong',
    '/family/safety-tools',
  ];

  it('covers the five family routes', () => {
    expect(FAMILY_SEO.map((r) => r.path)).toEqual(paths);
  });

  it('has unique titles, descriptions, and og images', () => {
    for (const key of ['title', 'description', 'ogImage'] as const) {
      const values = FAMILY_SEO.map((r) => r[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('builds self-referencing canonicals', () => {
    for (const route of FAMILY_SEO) {
      expect(route.canonical).toBe(`${SITE_ORIGIN}${route.path}`);
    }
  });

  it('uses the exact hub meta from the spec', () => {
    const hub = getFamilySeo('/family');
    expect(hub?.title).toBe(
      'For Families on Divine — Talking With Teens About Social Media'
    );
    expect(hub?.description).toBe(
      "An honest guide for parents and teens: what Divine's safety tools do, what no app can promise, and how to build a family media plan that actually holds."
    );
    expect(hub?.ogTitle).toBe('For Families on Divine');
    expect(hub?.ogDescription).toBe(
      "Conversation over surveillance. What our safety tools do, what they can't, and how to talk with your teen about it."
    );
    expect(hub?.ogImage).toBe(`${SITE_ORIGIN}/og-family.png`);
  });

  it('keeps brand voice: no exclamation marks anywhere', () => {
    for (const route of FAMILY_SEO) {
      expect(route.title).not.toContain('!');
      expect(route.description).not.toContain('!');
      expect(route.ogTitle).not.toContain('!');
      expect(route.ogDescription).not.toContain('!');
    }
  });

  it('keeps titles and descriptions within SERP-friendly lengths', () => {
    for (const route of FAMILY_SEO) {
      expect(route.title.length).toBeLessThanOrEqual(75);
      expect(route.description.length).toBeGreaterThanOrEqual(70);
      expect(route.description.length).toBeLessThanOrEqual(165);
    }
  });

  it('derives utm campaign slugs from route slugs', () => {
    expect(getFamilySeo('/family')?.campaign).toBe('family');
    expect(getFamilySeo('/family/media-plan')?.campaign).toBe('media-plan');
    expect(getFamilySeo('/family/talking-to-your-teen')?.campaign).toBe(
      'talking-to-your-teen'
    );
    expect(getFamilySeo('/family/when-something-goes-wrong')?.campaign).toBe(
      'when-something-goes-wrong'
    );
    expect(getFamilySeo('/family/safety-tools')?.campaign).toBe('safety-tools');
  });

  it('marks the hub as website and children as article for og:type', () => {
    expect(getFamilySeo('/family')?.ogType).toBe('website');
    for (const route of FAMILY_SEO.filter((r) => r.path !== '/family')) {
      expect(route.ogType).toBe('article');
    }
  });

  it('gives every child route a breadcrumb label', () => {
    for (const route of FAMILY_SEO.filter((r) => r.path !== '/family')) {
      expect(route.breadcrumb.length).toBeGreaterThan(0);
    }
  });

  it('returns undefined for unknown paths', () => {
    expect(getFamilySeo('/nope')).toBeUndefined();
  });
});
