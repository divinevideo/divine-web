import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useBugReport } from '@/hooks/useBugReport';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useBugReport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts reportType bug with required fields', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, ticketId: 42 }), { status: 201 }),
    );

    const { result } = renderHook(() => useBugReport(), { wrapper });

    await result.current.mutateAsync({
      subject: 'Broken feed',
      description: 'Videos do not load.',
      reporterPubkey: 'a'.repeat(64),
      reporterName: 'Tester',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body.reportType).toBe('bug');
    expect(body.subject).toBe('Broken feed');
    expect(body.description).toBe('Videos do not load.');
    expect(body.reporterPubkey).toBe('a'.repeat(64));
    expect(body.timestamp).toEqual(expect.any(Number));
    expect(body.pageUrl).toBeTruthy();
    expect(body.userAgent).toBeTruthy();
  });

  it('requires email when not signed in', async () => {
    const { result } = renderHook(() => useBugReport(), { wrapper });

    await expect(
      result.current.mutateAsync({
        subject: 'x',
        description: 'y',
      }),
    ).rejects.toThrow(/email/i);
  });

  it('resolves success payload', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, ticketId: 7 }), { status: 201 }),
    );

    const { result } = renderHook(() => useBugReport(), { wrapper });

    const out = await result.current.mutateAsync({
      subject: 's',
      description: 'd',
      reporterEmail: 'a@b.co',
    });
    expect(out.ticketId).toBe(7);
  });

  it('surfaces a clear error when the report API route is missing in local dev', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', { status: 404 }),
    );

    const { result } = renderHook(() => useBugReport(), { wrapper });

    await expect(
      result.current.mutateAsync({
        subject: 's',
        description: 'd',
        reporterEmail: 'a@b.co',
      }),
    ).rejects.toThrow(/endpoint was not found/i);
  });
});
