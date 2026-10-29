import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useShortLinkShare } from '@/hooks/useShortLinkShare';

const { share, authorize } = vi.hoisted(() => ({ share: vi.fn().mockResolvedValue(undefined), authorize: vi.fn().mockResolvedValue('Nostr synthetic') }));
vi.mock('@/hooks/useShare', () => ({ useShare: () => ({ share }) }));
vi.mock('@/lib/nip98Auth', () => ({ createNip98AuthHeader: authorize }));
const target = 'https://divine.video/video/synthetic';

describe('useShortLinkShare', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_SHORT_LINKS_ENABLED', 'true'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('renders without work, shares synchronously, and uses a completed mapping on the next click', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'Abc12345', short_url: 'https://divine.video/l/Abc12345', url: target }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useShortLinkShare());
    expect(fetcher).not.toHaveBeenCalled(); expect(authorize).not.toHaveBeenCalled();
    const shared = result.current.share({ url: target });
    expect(share).toHaveBeenLastCalledWith({ url: target });
    await shared;
    await act(async () => { await result.current.prepare(target); });
    const next = result.current.share({ url: target });
    expect(share).toHaveBeenLastCalledWith({ url: 'https://divine.video/l/Abc12345' });
    await next;
    expect(authorize).not.toHaveBeenCalled();
  });

  it('prepares and shares a short URL without login or signing', async () => {
    vi.stubEnv('VITE_SHORT_LINKS_ENABLED', undefined);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'Abc12345', short_url: 'https://divine.video/l/Abc12345', url: target }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useShortLinkShare());
    await act(async () => { await result.current.prepare(target); });
    await result.current.share({ url: target });
    expect(share).toHaveBeenLastCalledWith({ url: 'https://divine.video/l/Abc12345' });
    expect(fetcher).toHaveBeenCalledWith('https://gateway.divine.video/api/links', expect.objectContaining({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
    }));
    expect(authorize).not.toHaveBeenCalled();
  });

  it('keeps the full URL and makes no request for disabled sharing', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_SHORT_LINKS_ENABLED', 'false');
    const { result } = renderHook(() => useShortLinkShare());
    await result.current.prepare(target); await result.current.share({ url: target });
    expect(fetcher).not.toHaveBeenCalled(); expect(authorize).not.toHaveBeenCalled();
    expect(share).toHaveBeenLastCalledWith({ url: target });
  });
});
