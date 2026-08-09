// ABOUTME: Tests for merging people and video lists into one profile presentation model

import { describe, expect, it } from 'vitest';
import type { PeopleList } from './parsePeopleListFromEvent';
import type { VideoList } from './parseVideoListFromEvent';
import {
  mergeProfileLists,
  toDiscoverablePeopleList,
  toDiscoverableVideoList,
} from './profileLists';
import {
  PEOPLE_LIST_EVENT_KIND,
  VIDEO_LIST_EVENT_KIND,
  buildListPath,
} from './eventRouting';

const OWNER = 'a'.repeat(64);

const peopleList: PeopleList = {
  id: 'friends',
  name: 'Friends',
  pubkey: OWNER,
  createdAt: 20,
  memberPubkeys: ['b'.repeat(64), 'c'.repeat(64)],
};

const videoList: VideoList = {
  id: 'favorites',
  name: 'Favorites',
  pubkey: OWNER,
  createdAt: 10,
  videoCoordinates: ['34236:owner:one'],
  public: true,
};

describe('profile list presentation', () => {
  it('maps people lists to an owner-aware public route', () => {
    expect(toDiscoverablePeopleList(peopleList)).toMatchObject({
      key: `30000:${OWNER}:friends`,
      type: 'people',
      itemCount: 2,
      href: buildListPath(OWNER, 'friends', PEOPLE_LIST_EVENT_KIND),
    });
  });

  it('maps video lists to the existing public route', () => {
    expect(toDiscoverableVideoList(videoList)).toMatchObject({
      key: `30005:${OWNER}:favorites`,
      type: 'videos',
      itemCount: 1,
      href: buildListPath(OWNER, 'favorites', VIDEO_LIST_EVENT_KIND),
    });
  });

  it('merges both kinds newest-first', () => {
    expect(mergeProfileLists([peopleList], [videoList]).map((list) => list.type)).toEqual([
      'people',
      'videos',
    ]);
  });

  it('keeps both surfaces reachable when the two kinds share a d tag', () => {
    const sharedId = 'friends';
    const merged = mergeProfileLists(
      [peopleList],
      [{ ...videoList, id: sharedId, name: 'Friends' }],
    );

    expect(new Set(merged.map((list) => list.href)).size).toBe(2);
    expect(merged.map((list) => list.href)).toEqual([
      buildListPath(OWNER, sharedId, PEOPLE_LIST_EVENT_KIND),
      buildListPath(OWNER, sharedId, VIDEO_LIST_EVENT_KIND),
    ]);
  });
});
