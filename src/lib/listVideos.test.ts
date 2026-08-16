// ABOUTME: Unit tests for resolving video-list members into ordered video data

import { describe, expect, it, vi } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';
import type { VideoListMember } from '@/lib/parseVideoListFromEvent';
import { fetchListVideos } from './listVideos';

const OWNER = 'a'.repeat(64);

function videoEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  const id = overrides.id ?? '1'.repeat(64);
  const dTag = overrides.tags?.find(tag => tag[0] === 'd')?.[1] ?? `d-${id[0]}`;
  return {
    ...overrides,
    id,
    pubkey: overrides.pubkey ?? OWNER,
    kind: overrides.kind ?? SHORT_VIDEO_KIND,
    created_at: 1700,
    tags: [
      ['d', dTag],
      ['title', `Video ${dTag}`],
      ['imeta', `url https://media.example/${dTag}.mp4`, 'm video/mp4'],
      ...(overrides.tags?.filter(tag => tag[0] !== 'd') ?? []),
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
    expect(filters[0]).toMatchObject({ kinds: [SHORT_VIDEO_KIND], ids: ids.slice(0, 200), limit: 200 });
    expect(filters[1]).toMatchObject({ kinds: [SHORT_VIDEO_KIND], ids: ids.slice(200), limit: 1 });
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
});
