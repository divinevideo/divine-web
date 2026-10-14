import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrSigner } from '@nostrify/nostrify';
import { API_CONFIG } from '@/config/api';
import { createNip98AuthHeader } from '@/lib/nip98Auth';
import { fetchSupporter, updateSupporterRecognition, fetchPublicSupporter } from './supportersClient';

vi.mock('@/lib/nip98Auth', () => ({ createNip98AuthHeader: vi.fn() }));
const signer = {} as NostrSigner;
const pubkey = 'a'.repeat(64);
const snapshot = {
  status: 'active', entitlement: { isActive: true },
  recognition: { haloVisible: false, discoveryVisible: true, foundingHistoryVisible: false },
};

describe('supporters client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createNip98AuthHeader).mockResolvedValue(`Nostr ${btoa(JSON.stringify({ pubkey }))}`);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot))));
  });
  it('authenticates the private read without allowing redirects or caching', async () => {
    expect(await fetchSupporter(signer, pubkey)).toEqual(snapshot);
    expect(createNip98AuthHeader).toHaveBeenCalledWith(signer, 'https://supporters.divine.video/v1/me', 'GET', undefined);
    expect(fetch).toHaveBeenCalledWith('https://supporters.divine.video/v1/me', expect.objectContaining({ redirect: 'error', cache: 'no-store' }));
  });
  it('signs the exact PATCH body and preserves all recognition choices', async () => {
    await updateSupporterRecognition(signer, pubkey, { ...snapshot.recognition, haloVisible: true });
    const body = JSON.stringify({ halo_visible: true, discovery_visible: true, founding_history_visible: false });
    expect(createNip98AuthHeader).toHaveBeenCalledWith(signer, 'https://supporters.divine.video/v1/me/recognition', 'PATCH', body);
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body }));
  });
  it('does not treat authentication or malformed responses as an inactive subscription', async () => {
    vi.mocked(createNip98AuthHeader).mockResolvedValueOnce(null);
    await expect(fetchSupporter(signer, pubkey)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}'));
    await expect(fetchSupporter(signer, pubkey)).rejects.toThrow();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(fetchSupporter(signer, pubkey)).rejects.toThrow();
  });
  it('rejects a signer that switched to another account before reading or changing recognition', async () => {
    vi.mocked(createNip98AuthHeader).mockResolvedValue(`Nostr ${btoa(JSON.stringify({ pubkey: 'b'.repeat(64) }))}`);
    await expect(fetchSupporter(signer, pubkey)).rejects.toThrow();
    await expect(updateSupporterRecognition(signer, pubkey, snapshot.recognition)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves explicit unknown entitlement state', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ...snapshot, status: 'unknown', entitlement: { isActive: false } })));
    expect((await fetchSupporter(signer, pubkey)).status).toBe('unknown');
  });
  it('bounds the private and public requests so a stalled service cannot hang the UI', async () => {
    await fetchSupporter(signer, pubkey);
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ supporters: [] })));
    await fetchPublicSupporter(pubkey);
    expect(vi.mocked(fetch).mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it('reads the service host from the API configuration', async () => {
    await fetchSupporter(signer, pubkey);
    expect(fetch).toHaveBeenCalledWith(`${API_CONFIG.supportersService.baseUrl}/v1/me`, expect.anything());
  });
  it('shows public recognition only for the requested full pubkey with affirmative visibility', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ supporters: [{ pubkey, haloVisible: true }] })));
    expect(await fetchPublicSupporter(pubkey)).toBe(true);
    expect(createNip98AuthHeader).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ supporters: [{ pubkey: 'b'.repeat(64), haloVisible: true }] })));
    expect(await fetchPublicSupporter(pubkey)).toBe(false);
  });
});
