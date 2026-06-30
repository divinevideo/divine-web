import { describe, it, expect } from 'vitest';
import {
  coordOf,
  getATagValues,
  parsePTagCollaborator,
  dedupeAndSubtract,
} from './collabsParser';
import type { NostrEvent } from '@nostrify/nostrify';

const ME = 'a'.repeat(64);
const CREATOR = 'b'.repeat(64);
const OTHER_CREATOR = 'c'.repeat(64);

function video(d: string, opts: Partial<NostrEvent> & { pubkey?: string } = {}): NostrEvent {
  return {
    id: 'id-' + d + '-' + (opts.created_at ?? 0),
    pubkey: opts.pubkey ?? CREATOR,
    created_at: opts.created_at ?? 1700000000,
    kind: 34236,
    content: '',
    tags: [['d', d], ['p', ME], ...(opts.tags ?? [])],
    sig: '',
  };
}

describe('coordOf', () => {
  it('builds the canonical 34236 coordinate', () => {
    const e = video('vid1');
    expect(coordOf(e)).toBe(`34236:${CREATOR}:vid1`);
  });

  it('throws if the event has no d tag', () => {
    const e: NostrEvent = { ...video('vid1'), tags: [['p', ME]] };
    expect(() => coordOf(e)).toThrow(/missing d tag/i);
  });
});

describe('getATagValues', () => {
  it('returns every a-tag value', () => {
    const e: NostrEvent = {
      id: 'x', pubkey: ME, created_at: 0, kind: 34238, content: '', sig: '',
      tags: [['a', 'coord-1'], ['d', 'r1'], ['a', 'coord-2']],
    };
    expect(getATagValues(e)).toEqual(['coord-1', 'coord-2']);
  });
});

describe('parsePTagCollaborator', () => {
  it('parses a p-tag without a role', () => {
    expect(parsePTagCollaborator(['p', ME])).toEqual({ pubkey: ME });
  });
  it('parses a p-tag with a role', () => {
    expect(parsePTagCollaborator(['p', ME, 'actor'])).toEqual({ pubkey: ME, role: 'actor' });
  });
  it('returns null for non-p tags', () => {
    expect(parsePTagCollaborator(['e', 'whatever'])).toBeNull();
  });
});

describe('dedupeAndSubtract', () => {
  it('returns empty when nothing tagged', () => {
    expect(dedupeAndSubtract([], new Set(), ME)).toEqual([]);
  });

  it('keeps the latest version per addressable coord', () => {
    const older = video('vid1', { created_at: 1000 });
    const newer = video('vid1', { created_at: 2000 });
    const out = dedupeAndSubtract([older, newer], new Set(), ME);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(newer.id);
  });

  it('drops coords already in the accepted set', () => {
    const v = video('vid1');
    const out = dedupeAndSubtract([v], new Set([coordOf(v)]), ME);
    expect(out).toEqual([]);
  });

  it('drops self-tags (logged-in user is the creator)', () => {
    const v = video('vid1', { pubkey: ME });
    expect(dedupeAndSubtract([v], new Set(), ME)).toEqual([]);
  });

  it('keeps videos from different creators independently', () => {
    const a = video('vid1', { pubkey: CREATOR });
    const b = video('vid1', { pubkey: OTHER_CREATOR });
    const out = dedupeAndSubtract([a, b], new Set(), ME);
    expect(out).toHaveLength(2);
  });
});
