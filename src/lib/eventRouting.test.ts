import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';
import {
  PEOPLE_LIST_EVENT_KIND,
  VIDEO_LIST_EVENT_KIND,
  buildAddressableRoute,
  buildAddressableEventPath,
  buildListPath,
  buildResolvedEventRoute,
  buildVideoPath,
  isListDetailEventKind,
  isListEventKind,
  isNoteEventKind,
  parseListKindParam,
} from './eventRouting';

function makeEvent(overrides: Partial<NostrEvent>): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: 'f'.repeat(64),
    created_at: 1,
    kind: 1,
    tags: [],
    content: '',
    sig: '0'.repeat(128),
    ...overrides,
  };
}

describe('eventRouting', () => {
  it('routes video events to the video page using the d tag when present', () => {
    const event = makeEvent({
      kind: SHORT_VIDEO_KIND,
      tags: [['d', 'clip-42']],
    });

    expect(buildResolvedEventRoute(event)).toBe(buildVideoPath('clip-42'));
  });

  it('routes video list events to the public list page', () => {
    const event = makeEvent({
      kind: 30005,
      pubkey: 'a'.repeat(64),
      tags: [['d', 'favorites']],
    });

    expect(buildResolvedEventRoute(event)).toBe(
      buildListPath(event.pubkey, 'favorites', VIDEO_LIST_EVENT_KIND),
    );
  });

  it('routes people list events to the public list page', () => {
    const event = makeEvent({
      kind: 30000,
      pubkey: 'a'.repeat(64),
      tags: [['d', 'friends']],
    });

    expect(buildAddressableRoute(30000, event.pubkey, 'friends')).toBe(
      buildListPath(event.pubkey, 'friends', PEOPLE_LIST_EVENT_KIND),
    );
    expect(buildResolvedEventRoute(event)).toBe(
      buildListPath(event.pubkey, 'friends', PEOPLE_LIST_EVENT_KIND),
    );
  });

  it('pins the list kind so both kinds stay reachable under one d tag', () => {
    const pubkey = 'a'.repeat(64);

    expect(buildListPath(pubkey, 'friends')).toBe(`/list/${pubkey}/friends`);
    expect(buildListPath(pubkey, 'friends', PEOPLE_LIST_EVENT_KIND)).toBe(
      `/list/${pubkey}/friends?kind=30000`,
    );
    expect(buildListPath(pubkey, 'friends', VIDEO_LIST_EVENT_KIND)).toBe(
      `/list/${pubkey}/friends?kind=30005`,
    );
    expect(buildListPath(pubkey, 'friends', PEOPLE_LIST_EVENT_KIND)).not.toBe(
      buildListPath(pubkey, 'friends', VIDEO_LIST_EVENT_KIND),
    );
  });

  it('ignores a kind pin that is not a list detail kind', () => {
    const pubkey = 'a'.repeat(64);

    expect(buildListPath(pubkey, 'friends', 30001)).toBe(`/list/${pubkey}/friends`);
  });

  it('parses only supported list kind pins', () => {
    expect(parseListKindParam('30000')).toBe(PEOPLE_LIST_EVENT_KIND);
    expect(parseListKindParam('30005')).toBe(VIDEO_LIST_EVENT_KIND);
    expect(parseListKindParam('30001')).toBeNull();
    expect(parseListKindParam('nonsense')).toBeNull();
    expect(parseListKindParam(null)).toBeNull();
  });

  it('keeps generic addressable events on the generic event route', () => {
    expect(buildAddressableEventPath(30023, 'b'.repeat(64), 'post-123')).toBe(
      '/event/a/30023/' + 'b'.repeat(64) + '/post-123'
    );
  });

  it('classifies note and list kinds for rendering', () => {
    expect(isNoteEventKind(1)).toBe(true);
    expect(isNoteEventKind(1111)).toBe(true);
    expect(isListDetailEventKind(30000)).toBe(true);
    expect(isListDetailEventKind(30005)).toBe(true);
    expect(isListDetailEventKind(30001)).toBe(false);
    expect(isListEventKind(30001)).toBe(true);
    expect(isListEventKind(22)).toBe(false);
  });
});
