// ABOUTME: Unit tests for NIP-22 comment tag builder
// ABOUTME: Unit tests for NIP-22 comment tag builder
import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import { SHORT_VIDEO_KIND } from '@/types/video';

import { buildNip22CommentTags } from './buildNip22CommentTags';

const PK_VIDEO = 'a1' + 'aa'.repeat(31);
const PK_USER = 'b2' + 'bb'.repeat(31);
const VIDEO_ID = '01' + 'cc'.repeat(31);
const COMMENT_ID = '02' + 'dd'.repeat(31);

function baseEvent(
  overrides: Partial<NostrEvent> & Pick<NostrEvent, 'kind' | 'pubkey' | 'tags'>
): NostrEvent {
  return {
    id: overrides.id ?? '00'.repeat(32),
    pubkey: overrides.pubkey,
    kind: overrides.kind,
    tags: overrides.tags,
    content: overrides.content ?? '',
    created_at: overrides.created_at ?? 100,
    sig: overrides.sig ?? '11'.repeat(64),
  };
}

describe('buildNip22CommentTags', () => {
  it('addressable short-video root (kind 34236), top-level comment', () => {
    const root = baseEvent({
      id: VIDEO_ID,
      pubkey: PK_VIDEO,
      kind: SHORT_VIDEO_KIND,
      tags: [['d', 'vine-abc']],
    });

    expect(buildNip22CommentTags(root)).toEqual([
      ['A', `${SHORT_VIDEO_KIND}:${PK_VIDEO}:vine-abc`],
      ['E', VIDEO_ID],
      ['K', String(SHORT_VIDEO_KIND)],
      ['P', PK_VIDEO],
      ['a', `${SHORT_VIDEO_KIND}:${PK_VIDEO}:vine-abc`],
      ['e', VIDEO_ID],
      ['k', String(SHORT_VIDEO_KIND)],
      ['p', PK_VIDEO],
    ]);
  });

  it('regular root (kind 1), top-level comment', () => {
    const root = baseEvent({
      id: VIDEO_ID,
      pubkey: PK_VIDEO,
      kind: 1,
      tags: [],
    });

    expect(buildNip22CommentTags(root)).toEqual([
      ['E', VIDEO_ID],
      ['K', '1'],
      ['P', PK_VIDEO],
      ['e', VIDEO_ID],
      ['k', '1'],
      ['p', PK_VIDEO],
    ]);
  });

  it('replaceable profile root (kind 0), top-level comment', () => {
    const root = baseEvent({
      id: 'prof-id',
      pubkey: PK_VIDEO,
      kind: 0,
      tags: [],
    });

    expect(buildNip22CommentTags(root)).toEqual([
      ['A', `0:${PK_VIDEO}:`],
      ['K', '0'],
      ['P', PK_VIDEO],
      ['a', `0:${PK_VIDEO}:`],
      ['k', '0'],
      ['p', PK_VIDEO],
    ]);
  });

  it('URL root, top-level comment', () => {
    const root = new URL('https://example.com/watch?v=1');

    expect(buildNip22CommentTags(root)).toEqual([
      ['I', 'https://example.com/watch?v=1'],
      ['K', 'example.com'],
      ['i', 'https://example.com/watch?v=1'],
      ['k', 'example.com'],
    ]);
  });

  it('addressable video root with reply to regular kind 1111 comment', () => {
    const root = baseEvent({
      id: VIDEO_ID,
      pubkey: PK_VIDEO,
      kind: SHORT_VIDEO_KIND,
      tags: [['d', 'vine-abc']],
    });
    const reply = baseEvent({
      id: COMMENT_ID,
      pubkey: PK_USER,
      kind: 1111,
      tags: [['e', VIDEO_ID]],
    });

    expect(buildNip22CommentTags(root, reply)).toEqual([
      ['A', `${SHORT_VIDEO_KIND}:${PK_VIDEO}:vine-abc`],
      ['E', VIDEO_ID],
      ['K', String(SHORT_VIDEO_KIND)],
      ['P', PK_VIDEO],
      ['e', COMMENT_ID],
      ['k', '1111'],
      ['p', PK_USER],
    ]);
  });

  it('regular root with reply URL', () => {
    const root = baseEvent({
      id: VIDEO_ID,
      pubkey: PK_VIDEO,
      kind: 1,
      tags: [],
    });
    const reply = new URL('https://other.test/note');

    expect(buildNip22CommentTags(root, reply)).toEqual([
      ['E', VIDEO_ID],
      ['K', '1'],
      ['P', PK_VIDEO],
      ['i', 'https://other.test/note'],
      ['k', 'other.test'],
    ]);
  });
});
