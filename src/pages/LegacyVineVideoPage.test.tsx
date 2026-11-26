import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PagePerformanceContext } from '@/contexts/PagePerformanceContext';
import { LegacyVineVideoPage } from './LegacyVineVideoPage';

const { mockUseVideoByIdFunnelcake } = vi.hoisted(() => ({
  mockUseVideoByIdFunnelcake: vi.fn(),
}));

vi.mock('@unhead/react', () => ({
  useSeoMeta: vi.fn(),
  useHead: vi.fn(),
}));

vi.mock('@/hooks/useVideoByIdFunnelcake', () => ({
  useVideoByIdFunnelcake: (options: { videoId: string; enabled?: boolean }) =>
    mockUseVideoByIdFunnelcake(options),
}));

function renderWithRoute(initialPath: string, report = vi.fn()) {
  return render(
    <PagePerformanceContext.Provider value={report}><MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/v/:legacyVineId" element={<LegacyVineVideoPage />} />
        <Route path="/video/:id" element={<div data-testid="redirected" />} />
        <Route path="*" element={<div data-testid="not-routed" />} />
      </Routes>
    </MemoryRouter></PagePerformanceContext.Provider>,
  );
}

function setLookupResult(result: { video: unknown; isLoading: boolean }) {
  mockUseVideoByIdFunnelcake.mockReturnValue({
    videos: null,
    windowOffset: 0,
    error: null,
    ...result,
  });
}

describe('LegacyVineVideoPage', () => {
  it('renders NotFound when the video lookup completes with no result', async () => {
    setLookupResult({ video: null, isLoading: false });

    renderWithRoute('/v/5B1TZKezL6r');

    await waitFor(() => {
      expect(screen.getByText('404')).toBeInTheDocument();
    });
  });

  it('renders a loading state while the lookup is in flight', () => {
    setLookupResult({ video: null, isLoading: true });

    renderWithRoute('/v/5B1TZKezL6r');

    expect(screen.getByText('Finding this Vine...')).toBeInTheDocument();
  });

  it('redirects to the canonical /video/:id when the video is found', async () => {
    setLookupResult({
      video: { id: 'event-abc', pubkey: 'a'.repeat(64) },
      isLoading: false,
    });

    renderWithRoute('/v/5B1TZKezL6r');

    await waitFor(() => {
      expect(screen.getByTestId('redirected')).toBeInTheDocument();
    });
  });

  it('passes the legacyVineId into the hook and enables it', () => {
    setLookupResult({ video: null, isLoading: true });

    renderWithRoute('/v/5B1TZKezL6r');

    expect(mockUseVideoByIdFunnelcake).toHaveBeenCalledWith({
      videoId: '5B1TZKezL6r',
      enabled: true,
    });
  });
});


it('reports a completed missing legacy lookup as an error rather than a stalled load', () => {
  setLookupResult({ video: null, isLoading: false });
  const report = vi.fn();
  renderWithRoute('/v/synthetic00', report);
  expect(screen.getByText('404')).toBeInTheDocument();
  expect(report).toHaveBeenCalledWith('error');
});
