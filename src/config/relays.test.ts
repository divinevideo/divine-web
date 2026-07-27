import { describe, expect, it } from 'vitest';

import { getFunnelcakeUrl, hasFunnelcake, PROFILE_RELAYS, PRESET_RELAYS, EVENT_LOOKUP_RELAYS } from './relays';

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
