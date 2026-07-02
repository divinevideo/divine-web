import { describe, expect, it } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { buildEventRouter, buildReqRouter, type RoutingContext } from './relayRouting';
import { BADGE_RELAYS, PROFILE_RELAYS, getRelayUrls } from '@/config/relays';
import { MUTE_LIST_KIND } from '@/hooks/useModeration';

const PRESET_ONLY_URL = 'wss://test-preset-only.example.com';

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
  it('routes MUTE_LIST_KIND (10000) only to {primary} ∪ PROFILE_RELAYS, never to presetRelays', () => {
    const targets = buildEventRouter(ctx)(makeEvent(MUTE_LIST_KIND));
    expect(targets).toContain('wss://relay.divine.video');
    expect(targets).not.toContain(PRESET_ONLY_URL);
    const allowed = new Set<string>([ctx.relayUrl, ...getRelayUrls(PROFILE_RELAYS)]);
    for (const url of targets) {
      expect(allowed.has(url)).toBe(true);
    }
  });

  it('kind 0 still fans out to presetRelays (regression)', () => {
    const targets = buildEventRouter(ctx)(makeEvent(0));
    expect(targets).toContain(PRESET_ONLY_URL);
  });

  it('LIST_KINDS (30000) still fans out to presetRelays (regression)', () => {
    const targets = buildEventRouter(ctx)(makeEvent(30000));
    expect(targets).toContain(PRESET_ONLY_URL);
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
});
