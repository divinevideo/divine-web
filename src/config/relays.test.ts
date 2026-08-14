import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EVENT_LOOKUP_RELAYS,
  getEventLookupRelayUrls,
  getFunnelcakeUrl,
  hasFunnelcake,
  PRESET_RELAYS,
  PROFILE_RELAYS,
} from './relays';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('hasFunnelcake', () => {
  it('recognizes the production Divine relay', () => {
    expect(hasFunnelcake('wss://relay.divine.video')).toBe(true);
  });

  it('recognizes the staging Divine relay', () => {
    expect(hasFunnelcake('wss://relay.staging.divine.video')).toBe(true);
  });

  it('rejects non-Divine relays', () => {
    expect(hasFunnelcake('wss://relay.damus.io')).toBe(false);
  });
});

describe('getFunnelcakeUrl', () => {
  it('maps the production Divine relay to the production API host', () => {
    expect(getFunnelcakeUrl('wss://relay.divine.video')).toBe('https://api.divine.video');
  });

  it('maps the staging Divine relay to the staging API host', () => {
    expect(getFunnelcakeUrl('wss://relay.staging.divine.video')).toBe('https://api.staging.divine.video');
  });

  it('returns null for non-Divine relays', () => {
    expect(getFunnelcakeUrl('wss://relay.damus.io')).toBeNull();
  });
});

describe('relay.ditto.pub removal (#415)', () => {
  it('is not in PROFILE_RELAYS', () => {
    expect(PROFILE_RELAYS.map((r) => r.url)).not.toContain('wss://relay.ditto.pub');
  });

  it('is not in PRESET_RELAYS', () => {
    expect(PRESET_RELAYS.map((r) => r.url)).not.toContain('wss://relay.ditto.pub');
  });

  it('is not in EVENT_LOOKUP_RELAYS', () => {
    expect(EVENT_LOOKUP_RELAYS.map((r) => r.url)).not.toContain('wss://relay.ditto.pub');
  });
});

describe('PRESET_RELAYS', () => {
  it('does not contain duplicate URLs', () => {
    const urls = PRESET_RELAYS.map((r) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('getEventLookupRelayUrls', () => {
  it('rejects remote relay hints with private hosts or non-wss schemes', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const relays = getEventLookupRelayUrls({
      configuredRelayUrls: ['wss://configured.example'],
      relayHints: [
        'ws://relay.example',
        'wss://192.168.1.10',
        'wss://hint.example',
      ],
    });

    expect(relays).toContain('wss://configured.example');
    expect(relays).toContain('wss://hint.example');
    expect(relays).not.toContain('ws://relay.example');
    expect(relays).not.toContain('wss://192.168.1.10');
  });

  it('caps remote relay hints before adding configured and default lookup relays', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const relayHints = Array.from(
      { length: 12 },
      (_, index) => `wss://hint-${index}.example`,
    );

    const relays = getEventLookupRelayUrls({
      configuredRelayUrls: ['wss://configured.example'],
      relayHints,
    });

    expect(relays.filter((relay) => relay.startsWith('wss://hint-'))).toEqual(relayHints.slice(0, 8));
    expect(relays).toContain('wss://configured.example');
    expect(relays).toContain(EVENT_LOOKUP_RELAYS[0].url);
  });
});
