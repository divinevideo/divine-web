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
  // Verbatim invariant test from main: mute lists must never fan out to
  // relays we don't read from. Kept alongside the stricter branch test below.
  it('routes MUTE_LIST_KIND (10000) only to {primary} ∪ PROFILE_RELAYS, never to presetRelays', () => {
    const targets = buildEventRouter(ctx)(makeEvent(MUTE_LIST_KIND));
    expect(targets).toContain('wss://relay.divine.video');
    expect(targets).not.toContain(PRESET_ONLY_URL);
    const allowed = new Set<string>([ctx.relayUrl, ...getRelayUrls(PROFILE_RELAYS)]);
    for (const url of targets) {
      expect(allowed.has(url)).toBe(true);
    }
  });

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

  it.each([30000, 30005])(
    'routes kind 5 deletion requests for list kind %i to the list relay set',
    (deletedKind) => {
      const targets = buildEventRouter(ctx)(makeEvent(5, {
        tags: [
          ['a', `${deletedKind}:${'a'.repeat(64)}:friends`],
          ['k', String(deletedKind)],
        ],
      }));

      expect(targets).not.toContain(PRESET_ONLY_URL);
      for (const url of getRelayUrls(PROFILE_RELAYS)) {
        expect(targets).toContain(url);
      }
    },
  );

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
  it('keeps author-less list discovery on ranked configured relays', () => {
    const filter = { kinds: [30005], limit: 100 };
    const routes = buildReqRouter(ctx)([filter]);

    expect([...routes.keys()]).toEqual([ctx.relayUrl]);
  });

  it('preserves the existing last-resort primary fallback for non-list reads', () => {
    const routes = buildReqRouter({
      ...ctx, disabledPresetUrls: [ctx.relayUrl],
    })([{ kinds: [1] }]);

    expect([...routes.keys()]).toEqual([ctx.relayUrl]);
  });
  it('reads targeted list address and event deletion requests from the list relay set', () => {
    const filters: NostrFilter[] = [
      { kinds: [5], '#a': [`30005:${'a'.repeat(64)}:saved-list`] },
      { kinds: [5], '#e': ['b'.repeat(64)] },
    ];
    const readRoutes = buildReqRouter(ctx)(filters);

    for (const relay of getRelayUrls(PROFILE_RELAYS)) {
      expect(readRoutes.get(relay)).toEqual(filters);
    }
  });

  it.each([30000, 30001, 30005, 5])('excludes a disabled primary from list kind %i publication', (kind) => {
    const destinations = buildEventRouter({ ...ctx, disabledPresetUrls: [ctx.relayUrl] })(makeEvent(kind, {
      id: 'd'.repeat(64), sig: 'e'.repeat(128), tags: [['k', '30005']],
    }));

    expect(destinations).not.toContain(ctx.relayUrl);
    expect(destinations.length).toBeGreaterThan(0);
  });

  it('rejects list publication when every destination is disabled', () => {
    const context = { ...ctx, disabledPresetUrls: getRelayUrls(PROFILE_RELAYS) };

    expect(() => buildEventRouter(context)(makeEvent(30005))).toThrow();
    expect(buildReqRouter(context)([{ kinds: [30005] }]).size).toBe(0);
  });

  it.each([30000, 30001, 30005])('reads list kind %i from every publish destination', (kind) => {
    const context: RoutingContext = {
      ...ctx,
      relayUrls: [CUSTOM_URL],
      customRelayUrls: [CUSTOM_URL],
      pickTopN: (urls, count) => urls.slice(0, count),
    };
    const filter: NostrFilter = { kinds: [kind], authors: ['a'.repeat(64)] };
    const publishRelays = buildEventRouter(context)(makeEvent(kind, {
      id: 'b'.repeat(64),
      sig: 'c'.repeat(128),
    }));
    const readRoutes = buildReqRouter(context)([filter]);

    for (const relay of publishRelays) {
      expect(readRoutes.get(relay) ?? []).toContainEqual(filter);
    }
  });

  it('excludes disabled relays from list reads and preserves mixed query filters', () => {
    const disabledProfileRelay = getRelayUrls(PROFILE_RELAYS).find(url => url !== ctx.relayUrl)!;
    const listFilter: NostrFilter = { kinds: [30005], authors: ['a'.repeat(64)], '#d': ['fresh-list'] };
    const postFilter: NostrFilter = { kinds: [1], authors: ['a'.repeat(64)] };
    const readRoutes = buildReqRouter({
      ...ctx,
      customRelayUrls: [CUSTOM_URL, DISABLED_URL],
      disabledPresetUrls: [DISABLED_URL, disabledProfileRelay],
    })([listFilter, postFilter]);

    expect(readRoutes.has(DISABLED_URL)).toBe(false);
    expect(readRoutes.has(disabledProfileRelay)).toBe(false);
    expect(readRoutes.get(CUSTOM_URL)).toContainEqual(listFilter);
    expect(readRoutes.get(ctx.relayUrl)).toEqual(expect.arrayContaining([listFilter, postFilter]));
    for (const relay of getRelayUrls(PROFILE_RELAYS)) {
      if (relay !== disabledProfileRelay) expect(readRoutes.get(relay) ?? []).toContainEqual(listFilter);
    }
    expect(readRoutes.get(getRelayUrls(PROFILE_RELAYS).find(url => url !== disabledProfileRelay && url !== ctx.relayUrl)!))
      .not.toContainEqual(postFilter);
  });

  it('routes kind 0 to PROFILE_RELAYS', () => {
    const result = buildReqRouter(ctx)([{ kinds: [0] }]);
    const profileUrls = new Set(getRelayUrls(PROFILE_RELAYS));
    for (const url of result.keys()) {
      expect(profileUrls.has(url) || url === ctx.relayUrl).toBe(true);
    }
    expect(result.size).toBeGreaterThan(0);
  });

  it.each([30009, 8, 30008, 10008])('routes badge kind %i to BADGE_RELAYS', (kind) => {
    const pickTopN = vi.fn((urls: string[]) => urls.slice(0, 3));
    const filter: NostrFilter = { kinds: [kind] };
    const result = buildReqRouter({ ...ctx, pickTopN })([filter]);
    for (const url of result.keys()) {
      expect(BADGE_RELAYS.some((r) => r.url === url)).toBe(true);
    }
    expect(pickTopN).toHaveBeenCalledWith(getRelayUrls(BADGE_RELAYS), 3, undefined);
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
