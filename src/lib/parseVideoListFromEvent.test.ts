// ABOUTME: Unit tests for kind 30005 video list event parsing

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';
import { deduplicateVideoLists, parseVideoListFromEvent } from './parseVideoListFromEvent';

const OWNER = 'b'.repeat(64);
const COORD = `${SHORT_VIDEO_KIND}:${OWNER}:my-video`;
const LEGACY_COORD = `34235:${OWNER}:legacy-video`;
const EVENT_ID = '1'.repeat(64);

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
      members: [],
      memberCount: 0,
      videoCoordinates: [],
      public: true,
      tags: [],
      isCollaborative: false,
      allowedCollaborators: [],
      thumbnailEventId: undefined,
      playOrder: 'chronological',
      sourceTags: [['d', 'list-d']],
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

  it('parses e tags as ordered members and counts them', () => {
    const ev = baseEvent({
      tags: [
        ['d', 'l1'],
        ['e', EVENT_ID],
        ['e', 'not-an-event-id'],
      ],
    });
    const list = parseVideoListFromEvent(ev);
    expect(list?.members).toEqual([{ type: 'e', value: EVENT_ID }]);
    expect(list?.memberCount).toBe(1);
    expect(list?.videoCoordinates).toEqual([]);
  });

  it('preserves mixed e and a membership order', () => {
    const secondEventId = '2'.repeat(64);
    const ev = baseEvent({
      tags: [
        ['d', 'l1'],
        ['e', EVENT_ID],
        ['a', COORD],
        ['e', secondEventId],
        ['a', LEGACY_COORD],
      ],
    });

    expect(parseVideoListFromEvent(ev)?.members).toEqual([
      { type: 'e', value: EVENT_ID },
      { type: 'a', value: COORD },
      { type: 'e', value: secondEventId },
      { type: 'a', value: LEGACY_COORD },
    ]);
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

  it.each([
    ['thumbnail-event', 'note1abc'],
    ['thumbnail', EVENT_ID],
  ])('parses %s', (tagName, expected) => {
    const ev = baseEvent({
      tags: [['d', 'l1'], [tagName, expected]],
    });
    expect(parseVideoListFromEvent(ev)?.thumbnailEventId).toBe(expected);
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

  it('parses mobile playorder tag', () => {
    const ev = baseEvent({ tags: [['d', 'l1'], ['playorder', 'manual']] });
    expect(parseVideoListFromEvent(ev)?.playOrder).toBe('manual');
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

describe('deduplicateVideoLists', () => {
  it('keeps the newest version of a full owner and d-tag address', () => {
    const older = baseEvent({ created_at: 10, tags: [['d', 'same'], ['title', 'Old']] });
    const newer = baseEvent({ created_at: 30, tags: [['d', 'same'], ['title', 'New']] });
    const other = baseEvent({ created_at: 20, tags: [['d', 'other']] });

    expect(deduplicateVideoLists([older, other, newer]).map((list) => list.name)).toEqual([
      'New',
      'other',
    ]);
  });
});
