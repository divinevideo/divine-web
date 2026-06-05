// ABOUTME: Unit tests for kind 30005 video list event parsing

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';
import { parseVideoListFromEvent } from './parseVideoListFromEvent';

const OWNER = 'b'.repeat(64);
const COORD = `${SHORT_VIDEO_KIND}:${OWNER}:my-video`;

function baseEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: OWNER,
    kind: 30005,
    created_at: 1700,
    tags: [['d', 'list-d']],
    content: '',
    sig: 's'.repeat(128),
    ...overrides,
  };
}

describe('parseVideoListFromEvent', () => {
  it('returns null when d tag is missing', () => {
    const ev = baseEvent({ tags: [['title', 'Only title']] });
    expect(parseVideoListFromEvent(ev)).toBeNull();
  });

  it('parses minimal list with title fallback to d tag', () => {
    const ev = baseEvent();
    const list = parseVideoListFromEvent(ev);
    expect(list).toEqual({
      id: 'list-d',
      name: 'list-d',
      description: undefined,
      image: undefined,
      pubkey: OWNER,
      createdAt: 1700,
      videoCoordinates: [],
      public: true,
      tags: [],
      isCollaborative: false,
      allowedCollaborators: [],
      thumbnailEventId: undefined,
      playOrder: 'chronological',
    });
  });

  it('uses title tag when present', () => {
    const ev = baseEvent({ tags: [['d', 'x'], ['title', 'Named']] });
    expect(parseVideoListFromEvent(ev)?.name).toBe('Named');
  });

  it('includes only a tags for supported video kinds', () => {
    const ev = baseEvent({
      tags: [
        ['d', 'l1'],
        ['title', 'T'],
        ['a', COORD],
        ['a', '99999:pubkey:ignored'],
        ['a', 'not-a-coordinate'],
      ],
    });
    expect(parseVideoListFromEvent(ev)?.videoCoordinates).toEqual([COORD]);
  });

  it('collects t tags in order', () => {
    const ev = baseEvent({
      tags: [
        ['d', 'l1'],
        ['t', 'cats'],
        ['t', 'funny'],
      ],
    });
    expect(parseVideoListFromEvent(ev)?.tags).toEqual(['cats', 'funny']);
  });

  it('parses collaborative and collaborator tags', () => {
    const c1 = 'c'.repeat(64);
    const c2 = 'd'.repeat(64);
    const ev = baseEvent({
      tags: [
        ['d', 'l1'],
        ['collaborative', 'true'],
        ['collaborator', c1],
        ['collaborator', c2],
      ],
    });
    const list = parseVideoListFromEvent(ev);
    expect(list?.isCollaborative).toBe(true);
    expect(list?.allowedCollaborators).toEqual([c1, c2]);
  });

  it('sets isCollaborative to false when tag is absent or not "true"', () => {
    const ev = baseEvent({
      tags: [['d', 'l1'], ['collaborative', 'false']],
    });
    expect(parseVideoListFromEvent(ev)?.isCollaborative).toBe(false);
  });

  it('parses thumbnail-event', () => {
    const ev = baseEvent({
      tags: [['d', 'l1'], ['thumbnail-event', 'note1abc']],
    });
    expect(parseVideoListFromEvent(ev)?.thumbnailEventId).toBe('note1abc');
  });

  it.each([
    ['reverse', 'reverse'],
    ['manual', 'manual'],
    ['shuffle', 'shuffle'],
    ['bogus', 'chronological'],
  ] as const)('play-order %s → %s', (tagValue, expected) => {
    const ev = baseEvent({ tags: [['d', 'l1'], ['play-order', tagValue]] });
    expect(parseVideoListFromEvent(ev)?.playOrder).toBe(expected);
  });

  it('defaults play-order to chronological when tag absent', () => {
    const ev = baseEvent({ tags: [['d', 'l1']] });
    expect(parseVideoListFromEvent(ev)?.playOrder).toBe('chronological');
  });

  it('with non-empty content keeps stub privateCoordinates empty (coordinates unchanged)', () => {
    const ev = baseEvent({
      tags: [['d', 'l1'], ['a', COORD]],
      content: 'cipher-payload',
    });
    const list = parseVideoListFromEvent(ev);
    expect(list?.videoCoordinates).toEqual([COORD]);
  });

  it('includes description and image', () => {
    const ev = baseEvent({
      tags: [
        ['d', 'l1'],
        ['description', 'About'],
        ['image', 'https://example.com/cover.jpg'],
      ],
    });
    const list = parseVideoListFromEvent(ev);
    expect(list?.description).toBe('About');
    expect(list?.image).toBe('https://example.com/cover.jpg');
  });
});
