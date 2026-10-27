import { act, renderHook } from '@testing-library/react';
import type { NostrSigner } from '@nostrify/nostrify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useShortLinkShare } from '@/hooks/useShortLinkShare';

const { share, authorize } = vi.hoisted(() => ({ share: vi.fn().mockResolvedValue(undefined), authorize: vi.fn().mockResolvedValue('Nostr synthetic') }));
vi.mock('@/hooks/useShare', () => ({ useShare: () => ({ share }) }));
vi.mock('@/lib/nip98Auth', () => ({ createNip98AuthHeader: authorize }));
const signer = { signEvent: vi.fn() } as unknown as NostrSigner;
const target = 'https://divine.video/video/synthetic';

describe('useShortLinkShare', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_SHORT_LINKS_ENABLED', 'true'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('renders without work, shares synchronously, and uses a completed mapping on the next click', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'Abc12345', short_url: 'https://divine.video/l/Abc12345', url: target }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useShortLinkShare(signer));
    expect(fetcher).not.toHaveBeenCalled(); expect(authorize).not.toHaveBeenCalled();
    const shared = result.current.share({ url: target });
    expect(share).toHaveBeenLastCalledWith({ url: target });
    await shared;
    await act(async () => { await result.current.prepare(target); });
    const next = result.current.share({ url: target });
    expect(share).toHaveBeenLastCalledWith({ url: 'https://divine.video/l/Abc12345' });
    await next;
    expect(authorize).toHaveBeenCalledWith(signer, 'https://gateway.divine.video/api/links', 'POST', JSON.stringify({ url: target }));
  });

  it('keeps the full URL and makes no request for signed-out or disabled sharing', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const { result, rerender } = renderHook(({ current }) => useShortLinkShare(current), { initialProps: { current: undefined as NostrSigner | undefined } });
    await result.current.prepare(target);
    vi.stubEnv('VITE_SHORT_LINKS_ENABLED', 'false'); rerender({ current: signer });
    await result.current.prepare(target); await result.current.share({ url: target });
    expect(fetcher).not.toHaveBeenCalled(); expect(authorize).not.toHaveBeenCalled();
    expect(share).toHaveBeenLastCalledWith({ url: target });
  });
});
