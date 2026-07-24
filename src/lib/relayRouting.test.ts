import { describe, expect, it, vi } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { buildEventRouter, buildReqRouter, type RoutingContext } from './relayRouting';
import { BADGE_RELAYS, PROFILE_RELAYS, getRelayUrls } from '@/config/relays';
import { MUTE_LIST_KIND } from '@/hooks/useModeration';

const PRESET_ONLY_URL = 'wss://test-preset-only.example.com';
const CUSTOM_URL = 'wss://custom.example.com';
const DISABLED_URL = 'wss://disabled.example.com';

const ctx: RoutingContext = {
  relayUrl: 'wss://relay.divine.video',
  relayUrls: ['wss://relay.divine.video'],
  presetRelays: [{ url: PRESET_ONLY_URL }],
};

function makeEvent(kind: number, opts: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: `evt-${kind}-${Math.random().toString(36).slice(2, 8)}`,
    pubkey: 'a'.repeat(64),
    created_at: 1_700_000_000,
    kind,
    tags: [],
    content: '',
    sig: 'sig',
    ...opts,
  };
}

describe('buildEventRouter — mute list carve-out', () => {
  it('routes MUTE_LIST_KIND (10000) only to the primary relay', () => {
    const targets = buildEventRouter({
      ...ctx,
      customRelayUrls: [CUSTOM_URL],
      presetRelays: [{ url: PRESET_ONLY_URL }, { url: DISABLED_URL }],
      disabledPresetUrls: [DISABLED_URL],
    })(makeEvent(MUTE_LIST_KIND));
    expect(targets).toContain('wss://relay.divine.video');
    expect(targets).not.toContain(PRESET_ONLY_URL);
    expect(targets).not.toContain(CUSTOM_URL);
    expect(targets).not.toContain(DISABLED_URL);
    expect(targets).toEqual([ctx.relayUrl]);
  });

  it('kind 0 fans out to profile relays, not unrelated preset relays', () => {
    const targets = buildEventRouter(ctx)(makeEvent(0));
    expect(targets).not.toContain(PRESET_ONLY_URL);
    for (const url of getRelayUrls(PROFILE_RELAYS)) {
      expect(targets).toContain(url);
    }
  });

  it('LIST_KINDS (30000) fan out to profile relays, not unrelated preset relays', () => {
    const targets = buildEventRouter(ctx)(makeEvent(30000));
    expect(targets).not.toContain(PRESET_ONLY_URL);
    for (const url of getRelayUrls(PROFILE_RELAYS)) {
      expect(targets).toContain(url);
    }
  });

  it('routes non-profile publishes through ranked preset and custom candidates', () => {
    const pickTopN = vi.fn((urls: string[]) => urls);
    const targets = buildEventRouter({
      ...ctx,
      customRelayUrls: [CUSTOM_URL],
      presetRelays: [{ url: PRESET_ONLY_URL }, { url: DISABLED_URL }],
      disabledPresetUrls: [DISABLED_URL],
      pickTopN,
    })(makeEvent(1));

    expect(pickTopN).toHaveBeenCalledWith(
      [ctx.relayUrl, CUSTOM_URL, PRESET_ONLY_URL],
      5,
      undefined,
    );
    expect(targets).toEqual([ctx.relayUrl, CUSTOM_URL, PRESET_ONLY_URL]);
  });
});

describe('buildReqRouter — kind-based routing', () => {
  it('routes kind 0 to PROFILE_RELAYS', () => {
    const result = buildReqRouter(ctx)([{ kinds: [0] }]);
    const profileUrls = new Set(getRelayUrls(PROFILE_RELAYS));
    for (const url of result.keys()) {
      expect(profileUrls.has(url) || url === ctx.relayUrl).toBe(true);
    }
    expect(result.size).toBeGreaterThan(0);
  });

  it('routes BADGE_KINDS to BADGE_RELAYS', () => {
    const filter: NostrFilter = { kinds: [30009] };
    const result = buildReqRouter(ctx)([filter]);
    for (const url of result.keys()) {
      expect(BADGE_RELAYS.some((r) => r.url === url)).toBe(true);
    }
  });

  it('routes video filters through health-ranked relays and marks sticky', () => {
    const pickTopN = vi.fn((_urls: string[]) => [CUSTOM_URL, ctx.relayUrl]);
    const refreshSticky = vi.fn();
    const result = buildReqRouter({
      ...ctx,
      customRelayUrls: [CUSTOM_URL],
      pickTopN,
      refreshSticky,
    })([{ kinds: [34236] }]);

    expect(pickTopN).toHaveBeenCalledWith(
      expect.arrayContaining([ctx.relayUrl, CUSTOM_URL, ...getRelayUrls(PROFILE_RELAYS)]),
      2,
      34236,
    );
    expect([...result.keys()]).toEqual([CUSTOM_URL, ctx.relayUrl]);
    expect(refreshSticky).toHaveBeenCalledWith(CUSTOM_URL, 34236);
    expect(refreshSticky).toHaveBeenCalledWith(ctx.relayUrl, 34236);
  });

  it('excludes disabled preset URLs from adaptive read candidates', () => {
    const pickTopN = vi.fn((urls: string[]) => urls);
    buildReqRouter({
      ...ctx,
      relayUrls: [ctx.relayUrl, DISABLED_URL],
      customRelayUrls: [CUSTOM_URL],
      disabledPresetUrls: [DISABLED_URL],
      pickTopN,
    })([{ kinds: [1] }]);

    expect(pickTopN).toHaveBeenCalledWith([ctx.relayUrl, CUSTOM_URL], 2, undefined);
  });
});
