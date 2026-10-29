// ABOUTME: Tests the leaderboard's Classic Vine vs Made on Divine source filter
// ABOUTME: Checks the API params it sends and that the choice survives in the URL hash

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeI18n } from '@/lib/i18n';
import { TestApp } from '@/test/TestApp';

import { LeaderboardPage } from './LeaderboardPage';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function leaderboardVideoRequests(fetchSpy: ReturnType<typeof vi.spyOn>): URL[] {
  return fetchSpy.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname === '/api/leaderboard/videos');
}

function renderPage(hash: string) {
  window.history.replaceState(null, '', `/leaderboard${hash}`);
  return render(
    <TestApp>
      <LeaderboardPage />
    </TestApp>
  );
}

describe('LeaderboardPage source filter', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await initializeI18n({ force: true, languages: ['en-US'] });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse({ period: 'day', entries: [] })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('shows every video when no source is chosen', async () => {
    renderPage('#videos-day');

    await waitFor(() => expect(leaderboardVideoRequests(fetchSpy)).toHaveLength(1));
    const [request] = leaderboardVideoRequests(fetchSpy);
    expect(request.searchParams.get('period')).toBe('day');
    expect(request.searchParams.has('platform')).toBe(false);
    expect(request.searchParams.has('exclude_platform')).toBe(false);
    expect(screen.getByRole('button', { name: 'Everything' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks only for archived Vine videos when Classic Vine is chosen', async () => {
    renderPage('#videos-day');
    await waitFor(() => expect(leaderboardVideoRequests(fetchSpy)).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Classic Vine' }));

    await waitFor(() => expect(leaderboardVideoRequests(fetchSpy)).toHaveLength(2));
    const request = leaderboardVideoRequests(fetchSpy)[1];
    expect(request.searchParams.get('platform')).toBe('vine');
    expect(request.searchParams.has('exclude_platform')).toBe(false);
    expect(window.location.hash).toBe('#videos-day-classic');
  });

  it('leaves out archived Vine videos when Made on Divine is chosen', async () => {
    renderPage('#videos-week-new');

    await waitFor(() => expect(leaderboardVideoRequests(fetchSpy)).toHaveLength(1));
    const [request] = leaderboardVideoRequests(fetchSpy);
    expect(request.searchParams.get('period')).toBe('week');
    expect(request.searchParams.get('exclude_platform')).toBe('vine');
    expect(request.searchParams.has('platform')).toBe(false);
    expect(screen.getByRole('button', { name: 'Made on Divine' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('drops the source from the hash when switching back to Everything', async () => {
    renderPage('#videos-day-classic');
    await waitFor(() => expect(leaderboardVideoRequests(fetchSpy)).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Everything' }));

    await waitFor(() => expect(window.location.hash).toBe('#videos-day'));
  });

  it('follows the source in the hash on back and forward', async () => {
    renderPage('#videos-day');
    await waitFor(() => expect(leaderboardVideoRequests(fetchSpy)).toHaveLength(1));

    act(() => {
      window.history.replaceState(null, '', '/leaderboard#videos-day-classic');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    await waitFor(() => expect(leaderboardVideoRequests(fetchSpy)).toHaveLength(2));
    expect(leaderboardVideoRequests(fetchSpy)[1].searchParams.get('platform')).toBe('vine');
    expect(screen.getByRole('button', { name: 'Classic Vine' })).toHaveAttribute('aria-pressed', 'true');

    act(() => {
      window.history.replaceState(null, '', '/leaderboard#videos-day');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Everything' })).toHaveAttribute('aria-pressed', 'true')
    );
  });

  it('hides the source filter on the creators tab, which the API cannot split yet', async () => {
    renderPage('#creators-day');

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Classic Vine' })).not.toBeInTheDocument();
  });
});
