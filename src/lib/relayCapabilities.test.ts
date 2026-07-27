import { describe, expect, it } from 'vitest';
import { getOptimisticRelayCapabilities } from './relayCapabilities';

describe('getOptimisticRelayCapabilities (after #415 ditto.pub removal)', () => {
  it('returns the default (unrecognized-host) shape for relay.ditto.pub', () => {
    const caps = getOptimisticRelayCapabilities('wss://relay.ditto.pub');
    expect(caps.url).toBe('wss://relay.ditto.pub');
    expect(caps.supportsNIP50).toBe(false);
    expect(caps.supportsVideoSorts).toBe(false);
    expect(caps.supportsSearch).toBe(false);
    expect(caps.supportsCategoryFeed).toBe(false);
    expect(caps.supportedSortModes).toEqual([]);
    expect(caps.source).toBe('optimistic');
  });
});
