import { describe, expect, it } from 'vitest';
import { appendRelayHints, parseRelayHints } from './relayHints';

describe('relayHints', () => {
  it('parses comma-separated relay hints from repeated query params', () => {
    expect(parseRelayHints('?relays=wss://one.example,wss://two.example&relays= wss://three.example ')).toEqual([
      'wss://one.example',
      'wss://two.example',
      'wss://three.example',
    ]);
  });

  it('appends relay hints to hint-consuming routes', () => {
    expect(appendRelayHints('/event/a/30000/pubkey/friends', ['wss://relay.example'])).toBe(
      `/event/a/30000/pubkey/friends?relays=${encodeURIComponent('wss://relay.example')}`,
    );
    expect(appendRelayHints('/people-lists/pubkey/friends', ['wss://relay.example'])).toBe(
      `/people-lists/pubkey/friends?relays=${encodeURIComponent('wss://relay.example')}`,
    );
  });

  it('does not append relay hints to routes that do not consume them', () => {
    expect(appendRelayHints('/video/friends', ['wss://relay.example'])).toBe('/video/friends');
    expect(appendRelayHints('/list/pubkey/friends', ['wss://relay.example'])).toBe('/list/pubkey/friends');
  });

  it('leaves paths unchanged when no hints are available', () => {
    expect(appendRelayHints('/people-lists/pubkey/friends')).toBe('/people-lists/pubkey/friends');
    expect(appendRelayHints('/people-lists/pubkey/friends', [])).toBe('/people-lists/pubkey/friends');
  });
});
