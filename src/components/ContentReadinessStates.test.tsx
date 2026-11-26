import { render, screen } from '@testing-library/react';
import { createHead, UnheadProvider } from '@unhead/react/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';

import { PagePerformanceContext } from '@/contexts/PagePerformanceContext';
import { HashtagExplorer } from './HashtagExplorer';
import Index from '@/pages/Index';

const { query } = vi.hoisted(() => ({ query: { data: [] as unknown[], isLoading: false, error: null as Error | null } }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => query }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { pubkey: 'a'.repeat(64) } }) }));
vi.mock('@/hooks/useFollowList', () => ({ useFollowList: () => ({ data: [], isLoading: false }) }));
vi.mock('@/components/VideoFeed', () => ({ VideoFeed: () => null }));
vi.mock('@/pages/DiscoveryPage', () => ({ default: () => null }));

it('settles a signed-in homepage with no follows as empty', () => {
  const report = vi.fn();
  render(<UnheadProvider head={createHead()}><MemoryRouter><PagePerformanceContext.Provider value={report}><Index /></PagePerformanceContext.Provider></MemoryRouter></UnheadProvider>);
  expect(screen.getByRole('button')).toBeInTheDocument();
  expect(report).toHaveBeenCalledWith('empty');
});

it('settles the hashtags tab with an empty result rather than timing out', () => {
  const report = vi.fn();
  render(<PagePerformanceContext.Provider value={report}><HashtagExplorer /></PagePerformanceContext.Provider>);
  expect(report).toHaveBeenCalledWith('empty');
});

it('reports a failed hashtags tab as an error', () => {
  const report = vi.fn();
  query.error = new Error('synthetic unavailable');
  render(<PagePerformanceContext.Provider value={report}><HashtagExplorer /></PagePerformanceContext.Provider>);
  expect(report).toHaveBeenCalledWith('error');
  query.error = null;
});
