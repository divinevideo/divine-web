// ABOUTME: Unit tests for the NIP-25 video like tag builder
// ABOUTME: Pins the coordinate so an edited video keeps its reactions reachable
import { describe, it, expect } from 'vitest';

import { SHORT_VIDEO_KIND } from '@/types/video';

import { buildVideoLikeTags } from './buildVideoLikeTags';

const VIDEO_ID = '01' + 'cc'.repeat(31);
const AUTHOR_PK = 'a1' + 'aa'.repeat(31);
const VINE_ID = 'vine-one';

describe('buildVideoLikeTags', () => {
  it('carries the coordinate so the reaction survives an edit', () => {
    expect(
      buildVideoLikeTags({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: VINE_ID,
      })
    ).toEqual([
      ['e', VIDEO_ID],
      ['a', `${SHORT_VIDEO_KIND}:${AUTHOR_PK}:${VINE_ID}`],
      ['p', AUTHOR_PK],
      ['k', SHORT_VIDEO_KIND.toString()],
    ]);
  });

  it('omits the coordinate when the video has no d tag to address it by', () => {
    expect(
      buildVideoLikeTags({
        videoId: VIDEO_ID,
        videoPubkey: AUTHOR_PK,
        vineId: null,
      })
    ).toEqual([
      ['e', VIDEO_ID],
      ['p', AUTHOR_PK],
      ['k', SHORT_VIDEO_KIND.toString()],
    ]);
  });
});
