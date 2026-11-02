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
});
