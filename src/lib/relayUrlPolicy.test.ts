import { describe, expect, it, vi } from 'vitest';

import {
  REMOTE_RELAY_HINT_CAP,
  admitRemoteSuppliedRelays,
  isPrivateOrLinkLocalHost,
  isRelayUrlAllowed,
  isRemoteSuppliedRelayUrlAllowed,
} from '@/lib/relayUrlPolicy';

describe('relayUrlPolicy', () => {
  it('detects private and link-local IPv4 hosts after URL normalization', () => {
    expect(isPrivateOrLinkLocalHost('0x7f.0.0.1')).toBe(true);
    expect(isPrivateOrLinkLocalHost('2130706433')).toBe(true);
    expect(isPrivateOrLinkLocalHost('127.1')).toBe(true);

    for (const host of [
      '0.1.2.3',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '224.0.0.1',
    ]) {
      expect(isPrivateOrLinkLocalHost(host)).toBe(true);
    }
  });

  it('detects private IPv6, IPv4-mapped IPv6, and local hostnames', () => {
    expect(isPrivateOrLinkLocalHost(new URL('wss://[::1]').hostname)).toBe(true);
    expect(isPrivateOrLinkLocalHost(new URL('wss://[::ffff:10.0.0.1]').hostname)).toBe(true);
    expect(isPrivateOrLinkLocalHost(new URL('wss://[fe80::1]').hostname)).toBe(true);
    expect(isPrivateOrLinkLocalHost(new URL('wss://[fc00::1]').hostname)).toBe(true);
    expect(isPrivateOrLinkLocalHost('localhost')).toBe(true);
    expect(isPrivateOrLinkLocalHost('relay.local')).toBe(true);
    expect(isPrivateOrLinkLocalHost('relay.internal')).toBe(true);
    expect(isPrivateOrLinkLocalHost('relay.home.arpa')).toBe(true);
  });

  it('allows self/app wss relays and loopback ws relays only', () => {
    expect(isRelayUrlAllowed('wss://relay.example')).toBe(true);
    expect(isRelayUrlAllowed('ws://localhost:7777')).toBe(true);
    expect(isRelayUrlAllowed('ws://127.0.0.1:7777')).toBe(true);
    expect(isRelayUrlAllowed('ws://relay.example')).toBe(false);
  });

  it('requires remote-supplied relays to use wss and public hosts', () => {
    expect(isRemoteSuppliedRelayUrlAllowed('wss://relay.example')).toBe(true);
    expect(isRemoteSuppliedRelayUrlAllowed('ws://localhost:7777')).toBe(false);
    expect(isRemoteSuppliedRelayUrlAllowed('wss://127.0.0.1')).toBe(false);
    expect(isRemoteSuppliedRelayUrlAllowed('wss://[::ffff:192.168.0.1]')).toBe(false);
    expect(isRemoteSuppliedRelayUrlAllowed('wss://http://evil.example')).toBe(false);
  });

  it('dedupes remote relays by parsed key while preserving first admitted values', () => {
    expect(admitRemoteSuppliedRelays([
      ' wss://relay.example ',
      'wss://relay.example/',
      'wss://second.example',
    ])).toEqual([
      'wss://relay.example',
      'wss://second.example',
    ]);
  });

  it('caps remote relay lists preserving order and reports truncation', () => {
    const onTruncated = vi.fn();
    const relays = Array.from(
      { length: REMOTE_RELAY_HINT_CAP + 2 },
      (_, index) => `wss://relay-${index}.example`,
    );

    expect(admitRemoteSuppliedRelays(relays, {
      cap: REMOTE_RELAY_HINT_CAP,
      onTruncated,
    })).toEqual(relays.slice(0, REMOTE_RELAY_HINT_CAP));
    expect(onTruncated).toHaveBeenCalledWith(2);
  });

  it('reports rejected remote relays', () => {
    const onRejected = vi.fn();

    expect(admitRemoteSuppliedRelays([
      'not a url',
      'wss://192.168.1.10',
      'wss://relay.example',
    ], { onRejected })).toEqual(['wss://relay.example']);
    expect(onRejected).toHaveBeenCalledTimes(2);
  });
});
