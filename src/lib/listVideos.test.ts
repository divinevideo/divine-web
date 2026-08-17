// ABOUTME: Unit tests for resolving video-list members into ordered video data

import { describe, expect, it, vi } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';
import { LIST_VIDEO_KINDS, type VideoListMember } from '@/lib/parseVideoListFromEvent';
import { fetchListVideos } from './listVideos';

const OWNER = 'a'.repeat(64);

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

describe('fetchListVideos', () => {
  it('chunks e-tag id filters and keeps video routing kinds', async () => {
    const ids = Array.from({ length: 201 }, (_, index) => index.toString(16).padStart(64, '0'));
    const members: VideoListMember[] = ids.map(value => ({ type: 'e', value }));
    const query = vi.fn().mockResolvedValue([]);

    await fetchListVideos({ query }, members, new AbortController().signal);

    const filters = query.mock.calls[0][0] as NostrFilter[];
    expect(filters).toHaveLength(2);
    expect(filters[0]).toMatchObject({ kinds: LIST_VIDEO_KINDS, ids: ids.slice(0, 200) });
    expect(filters[1]).toMatchObject({ kinds: LIST_VIDEO_KINDS, ids: ids.slice(200) });
    expect(filters[0]).not.toHaveProperty('limit');
    expect(filters[1]).not.toHaveProperty('limit');
  });

  it('builds addressable filters without exact-count relay limits', async () => {
    const members: VideoListMember[] = [
      { type: 'a', value: `${SHORT_VIDEO_KIND}:${OWNER}:first` },
      { type: 'a', value: `${SHORT_VIDEO_KIND}:${OWNER}:second` },
      { type: 'a', value: `${SHORT_VIDEO_KIND}:${OWNER}:second` },
    ];
    const query = vi.fn().mockResolvedValue([]);

    await fetchListVideos({ query }, members, new AbortController().signal);

    const filters = query.mock.calls[0][0] as NostrFilter[];
    expect(filters).toEqual([
      {
        kinds: LIST_VIDEO_KINDS,
        authors: [OWNER],
        '#d': ['first', 'second'],
      },
    ]);
  });

  it('merges e and a results, dedupes, and returns videos in member order', async () => {
    const eventId = '1'.repeat(64);
    const coordEventId = '2'.repeat(64);
    const first = videoEvent({ id: eventId, tags: [['d', 'first']] });
    const second = videoEvent({ id: coordEventId, tags: [['d', 'second']] });
    const members: VideoListMember[] = [
      { type: 'a', value: `${SHORT_VIDEO_KIND}:${OWNER}:second` },
      { type: 'e', value: eventId },
      { type: 'e', value: coordEventId },
    ];
    const query = vi.fn().mockResolvedValue([first, second]);

    const videos = await fetchListVideos({ query }, members, new AbortController().signal);

    expect(videos.map(video => video.id)).toEqual([coordEventId, eventId]);
    expect(videos.map(video => video.listMember)).toEqual(members.slice(0, 2));
  });

  it('resolves legacy kind e-tag members', async () => {
    const eventId = '3'.repeat(64);
    const members: VideoListMember[] = [{ type: 'e', value: eventId }];
    const query = vi.fn().mockResolvedValue([
      videoEvent({ id: eventId, kind: 34235, tags: [['d', 'legacy']] }),
    ]);

    const videos = await fetchListVideos({ query }, members, new AbortController().signal);

    expect(videos.map(video => video.id)).toEqual([eventId]);
  });

  it('keeps every resolvable coordinate and picks the newest revision', async () => {
    const firstOld = videoEvent({
      id: '4'.repeat(64),
      created_at: 100,
      tags: [['d', 'first'], ['title', 'Old first']],
    });
    const firstNew = videoEvent({
      id: '5'.repeat(64),
      created_at: 200,
      tags: [['d', 'first'], ['title', 'New first']],
    });
    const second = videoEvent({
      id: '6'.repeat(64),
      created_at: 150,
      tags: [['d', 'second']],
    });
    const members: VideoListMember[] = [
      { type: 'a', value: `${SHORT_VIDEO_KIND}:${OWNER}:first` },
      { type: 'a', value: `${SHORT_VIDEO_KIND}:${OWNER}:second` },
    ];
    const query = vi.fn().mockResolvedValue([firstNew, second, firstOld]);

    const videos = await fetchListVideos({ query }, members, new AbortController().signal);

    expect(videos.map(video => video.id)).toEqual([firstNew.id, second.id]);
    expect(videos[0]?.title).toBe('New first');
  });

  it('breaks a same-timestamp revision tie by keeping the lowest event id', async () => {
    const lowerId = videoEvent({
      id: '4'.repeat(64),
      created_at: 200,
      tags: [['d', 'first'], ['title', 'Lower id']],
    });
    const higherId = videoEvent({
      id: '7'.repeat(64),
      created_at: 200,
      tags: [['d', 'first'], ['title', 'Higher id']],
    });
    const members: VideoListMember[] = [
      { type: 'a', value: `${SHORT_VIDEO_KIND}:${OWNER}:first` },
    ];
    // Return the higher id first so selection cannot depend on query order.
    const query = vi.fn().mockResolvedValue([higherId, lowerId]);

    const videos = await fetchListVideos({ query }, members, new AbortController().signal);

    expect(videos.map(video => video.id)).toEqual([lowerId.id]);
    expect(videos[0]?.title).toBe('Lower id');
  });
});
