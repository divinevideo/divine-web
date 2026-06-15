import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';
import {
  buildAddressableEventPath,
  buildListPath,
  buildResolvedEventRoute,
  buildVideoPath,
  isListEventKind,
  isNoteEventKind,
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

    expect(buildResolvedEventRoute(event)).toBe(buildListPath(event.pubkey, 'favorites'));
  });

  it('keeps generic addressable events on the generic event route', () => {
    expect(buildAddressableEventPath(30023, 'b'.repeat(64), 'post-123')).toBe(
      '/event/a/30023/' + 'b'.repeat(64) + '/post-123'
    );
  });

  it('classifies note and list kinds for rendering', () => {
    expect(isNoteEventKind(1)).toBe(true);
    expect(isNoteEventKind(1111)).toBe(true);
    expect(isListEventKind(30001)).toBe(true);
    expect(isListEventKind(22)).toBe(false);
  });
});
