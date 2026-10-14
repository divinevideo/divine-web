// ABOUTME: Unit tests for resolving pinned-video coordinates into video data

import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND, VIDEO_KINDS } from '@/types/video';
import { buildPinnedVideoFilters, resolvePinnedVideosFromEvents } from './pinnedVideoResolution';

const OWNER = 'b'.repeat(64);

function videoEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  const id = overrides.id ?? '1'.repeat(64);
  const dTag = overrides.tags?.find(tag => tag[0] === 'd')?.[1] ?? `d-${id[0]}`;
  const title = overrides.tags?.find(tag => tag[0] === 'title')?.[1] ?? `Video ${dTag}`;
  return {
    ...overrides,
    id,
    pubkey: overrides.pubkey ?? OWNER,
    kind: overrides.kind ?? SHORT_VIDEO_KIND,
    created_at: overrides.created_at ?? 1700,
    tags: [
      ['d', dTag],
      ['title', title],
      ['imeta', `url https://media.example/${dTag}.mp4`, 'm video/mp4'],
      ...(overrides.tags?.filter(tag => tag[0] !== 'd' && tag[0] !== 'title') ?? []),
    ],
    content: '',
    sig: 's'.repeat(128),
  };
}

describe('buildPinnedVideoFilters', () => {
  it('groups coordinates without exact-count relay limits', () => {
    const filters = buildPinnedVideoFilters([
      `${SHORT_VIDEO_KIND}:${OWNER}:first`,
      `${SHORT_VIDEO_KIND}:${OWNER}:second`,
      `${SHORT_VIDEO_KIND}:${OWNER}:second`,
      `1:${OWNER}:article`,
    ]);

    expect(filters).toEqual([
      {
        kinds: VIDEO_KINDS,
        authors: [OWNER],
        '#d': ['first', 'second'],
      },
    ]);
  });
});

describe('resolvePinnedVideosFromEvents', () => {
  it('keeps pin order and picks the newest revision per coordinate', () => {
    const firstOld = videoEvent({
      id: '2'.repeat(64),
      created_at: 100,
      tags: [['d', 'first'], ['title', 'Old first']],
    });
    const firstNew = videoEvent({
      id: '3'.repeat(64),
      created_at: 200,
      tags: [['d', 'first'], ['title', 'New first']],
    });
    const second = videoEvent({
      id: '4'.repeat(64),
      created_at: 150,
      tags: [['d', 'second']],
    });

    const videos = resolvePinnedVideosFromEvents(
      [
        `${SHORT_VIDEO_KIND}:${OWNER}:second`,
        `${SHORT_VIDEO_KIND}:${OWNER}:first`,
      ],
      [firstNew, second, firstOld],
    );

    expect(videos.map(video => video.id)).toEqual([second.id, firstNew.id]);
    expect(videos[1]?.title).toBe('New first');
  });

  it('breaks a same-timestamp revision tie by keeping the lowest event id', () => {
    const lowerId = videoEvent({
      id: '2'.repeat(64),
      created_at: 200,
      tags: [['d', 'first'], ['title', 'Lower id']],
    });
    const higherId = videoEvent({
      id: '9'.repeat(64),
      created_at: 200,
      tags: [['d', 'first'], ['title', 'Higher id']],
    });

    // Return the higher id first so selection cannot depend on query order.
    const videos = resolvePinnedVideosFromEvents(
      [`${SHORT_VIDEO_KIND}:${OWNER}:first`],
      [higherId, lowerId],
    );

    expect(videos.map(video => video.id)).toEqual([lowerId.id]);
    expect(videos[0]?.title).toBe('Lower id');
  });
});
