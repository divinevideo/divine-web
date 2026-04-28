import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resolveNip05, parseNip05Handle } from './nip05Resolve';

describe('parseNip05Handle', () => {
  it.each([
    ['alice@divine.video',         { name: 'alice', domain: 'divine.video' }],
    ['_@spiderman.divine.video',   { name: '_',     domain: 'spiderman.divine.video' }],
    ['@spiderman.divine.video',    { name: '_',     domain: 'spiderman.divine.video' }],
    ['spiderman.divine.video',     { name: '_',     domain: 'spiderman.divine.video' }],
    ['  alice@divine.video  ',     { name: 'alice', domain: 'divine.video' }],
  ])('parses %s', (input, expected) => {
    expect(parseNip05Handle(input)).toEqual(expected);
  });

  it.each(['', '@', 'no-dot', 'a@', '@a'])('rejects %s', (input) => {
    expect(parseNip05Handle(input)).toBeNull();
  });
});

describe('resolveNip05', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a valid response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({ names: { alice: 'a'.repeat(64) } }),
      { status: 200 },
    ));
    const out = await resolveNip05('alice@divine.video');
    expect(out).toEqual({
      pubkey: 'a'.repeat(64),
      name: 'alice',
      domain: 'divine.video',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://divine.video/.well-known/nostr.json?name=alice',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('handles the @-shorthand for divine subdomain accounts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({ names: { _: 'b'.repeat(64) } }),
      { status: 200 },
    ));
    const out = await resolveNip05('@spiderman.divine.video');
    expect(out).toEqual({
      pubkey: 'b'.repeat(64),
      name: '_',
      domain: 'spiderman.divine.video',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://spiderman.divine.video/.well-known/nostr.json?name=_',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await resolveNip05('nobody@divine.video')).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 200 }));
    expect(await resolveNip05('alice@divine.video')).toBeNull();
  });

  it('returns null when names map omits the requested name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({ names: { bob: 'b'.repeat(64) } }),
      { status: 200 },
    ));
    expect(await resolveNip05('alice@divine.video')).toBeNull();
  });

  it('returns null on a malformed handle', async () => {
    expect(await resolveNip05('garbage')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
