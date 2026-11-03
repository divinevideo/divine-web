import { render, waitFor } from '@testing-library/react';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { describe, expect, it } from 'vitest';
import { DiscoverySeo } from './DiscoverySeo';

describe('DiscoverySeo', () => {
  it('sets hot discovery metadata after SPA navigation', async () => {
    const head = createHead();
    const { rerender } = render(
      <UnheadProvider head={head}><DiscoverySeo pathname="/discovery/classics" /></UnheadProvider>,
    );

    await waitFor(() => expect(document.title).toBe('Classic Vines - Divine'));

    rerender(<UnheadProvider head={head}><DiscoverySeo pathname="/discovery/hot" /></UnheadProvider>);

    await waitFor(() => expect(document.title).toBe('Trending Videos - Divine'));
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://divine.video/discovery/hot');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Watch classic Vines and new short videos on Divine.');
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'falls back to the generic title for the inherited object key %s',
    async (tab) => {
      const head = createHead();
      render(<UnheadProvider head={head}><DiscoverySeo pathname={`/discovery/${tab}`} /></UnheadProvider>);

      await waitFor(() => expect(document.title).toBe('Discover Videos - Divine'));
    },
  );

  it('treats the tab case-insensitively, as the route does', async () => {
    const head = createHead();
    render(<UnheadProvider head={head}><DiscoverySeo pathname="/discovery/Hot" /></UnheadProvider>);

    await waitFor(() => expect(document.title).toBe('Trending Videos - Divine'));
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://divine.video/discovery/hot');
  });
});
