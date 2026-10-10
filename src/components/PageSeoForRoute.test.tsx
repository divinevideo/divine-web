// ABOUTME: Tests the router-level head component that sets tab titles and preview tags from PAGE_SEO
// ABOUTME: Covers trailing slashes, navigation to pages without a row, and page-level titles winning

import { act, render, waitFor } from '@testing-library/react';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { useHead, useSeoMeta } from '@unhead/react';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { changeLanguage, initializeI18n } from '@/lib/i18n';
import { BRAND_DEFAULT_TITLE } from '@/seo/pageSeo';

import { PageSeoForRoute } from './PageSeoForRoute';

let navigate: NavigateFunction;

function CaptureNavigate() {
  const nav = useNavigate();
  useEffect(() => {
    navigate = nav;
  }, [nav]);
  return null;
}

function VideoStub() {
  useSeoMeta({ title: 'A video on Divine' });
  return null;
}

function HashtagStub() {
  useHead({ title: 'A hashtag on Divine' });
  return null;
}

// PageSeoForRoute is mounted AFTER the routes here, the worst case: unhead breaks
// equal-priority ties in favour of the later entry, so only tagPriority 'low'
// lets a page's own title win from this position.
function renderAt(path: string) {
  const head = createHead({ plugins: [InferSeoMetaPlugin()] });
  return render(
    <UnheadProvider head={head}>
      <MemoryRouter initialEntries={[path]}>
        <CaptureNavigate />
        <Routes>
          <Route path="/video/:id" element={<VideoStub />} />
          <Route path="/some-hashtag-page" element={<HashtagStub />} />
          <Route path="*" element={null} />
        </Routes>
        <PageSeoForRoute />
      </MemoryRouter>
    </UnheadProvider>,
  );
}

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');
const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

beforeAll(async () => {
  await initializeI18n({ languages: ['en'] });
});

afterEach(async () => {
  await changeLanguage('en');
});

describe('PageSeoForRoute', () => {
  it('sets the tab title, preview tags and canonical for a table page', async () => {
    renderAt('/kids');
    await waitFor(() => expect(document.title).toBe('Kids on Divine — How accounts work for under-16s'));
    expect(meta('meta[property="og:url"]')).toBe('https://divine.video/kids');
    expect(meta('meta[property="og:image:alt"]')).toBe('Divine — how accounts work for kids and families');
    expect(canonical()).toBe('https://divine.video/kids');
  });

  it('matches a trailing-slash URL and keeps the canonical without the slash', async () => {
    renderAt('/trending/');
    await waitFor(() => expect(document.title).toBe('Trending - Divine'));
    expect(canonical()).toBe('https://divine.video/trending');
  });

  it('shows the brand default after navigating to a page with no row', async () => {
    document.title = 'Kids on Divine — How accounts work for under-16s'; // as a prebuilt page loads
    renderAt('/kids');
    await waitFor(() => expect(document.title).toBe('Kids on Divine — How accounts work for under-16s'));
    act(() => navigate('/discovery'));
    await waitFor(() => expect(document.title).toBe(BRAND_DEFAULT_TITLE));
  });

  it('lets a page that sets its own title win over the brand default', async () => {
    renderAt('/video/abc');
    await waitFor(() => expect(document.title).toBe('A video on Divine'));
    // The brand default sets no og:* tags, so the inferred preview title follows the page title
    await waitFor(() => expect(meta('meta[property="og:title"]')).toBe('A video on Divine'));
  });

  it('follows the active language', async () => {
    renderAt('/leaderboard');
    await waitFor(() => expect(document.title).toBe('Leaderboard - Divine'));
    await act(async () => {
      await changeLanguage('de');
    });
    // German leaderboardPage.seoTitle is "Bestenliste - Divine", distinct from English,
    // so this proves the title actually follows the active language (not just a suffix rule)
    await waitFor(() => expect(document.title).toBe('Bestenliste - Divine'));
  });

  it('lets a page-level useHead title win over the brand default', async () => {
    renderAt('/some-hashtag-page');
    await waitFor(() => expect(document.title).toBe('A hashtag on Divine'));
  });
});
