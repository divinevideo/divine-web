// ABOUTME: Merges NIP-51 people and video lists into one labeled profile model

import type { PeopleList } from '@/lib/parsePeopleListFromEvent';
import type { VideoList } from '@/lib/parseVideoListFromEvent';
import { buildListPath } from '@/lib/eventRouting';

export interface DiscoverableList {
  key: string;
  type: 'people' | 'videos';
  id: string;
  name: string;
  description?: string;
  image?: string;
  ownerPubkey: string;
  createdAt: number;
  itemCount: number;
  href: string;
}

export function toDiscoverablePeopleList(list: PeopleList): DiscoverableList {
  return {
    key: `30000:${list.pubkey}:${list.id}`,
    type: 'people',
    id: list.id,
    name: list.name,
    description: list.description,
    image: list.image,
    ownerPubkey: list.pubkey,
    createdAt: list.createdAt,
    itemCount: list.memberPubkeys.length,
    href: buildListPath(list.pubkey, list.id),
  };
}

export function toDiscoverableVideoList(list: VideoList): DiscoverableList {
  return {
    key: `30005:${list.pubkey}:${list.id}`,
    type: 'videos',
    id: list.id,
    name: list.name,
    description: list.description,
    image: list.image,
    ownerPubkey: list.pubkey,
    createdAt: list.createdAt,
    itemCount: list.videoCoordinates.length,
    href: buildListPath(list.pubkey, list.id),
  };
}

export function mergeProfileLists(
  peopleLists: PeopleList[],
  videoLists: VideoList[],
): DiscoverableList[] {
  return [
    ...peopleLists.map(toDiscoverablePeopleList),
    ...videoLists.map(toDiscoverableVideoList),
  ].sort((a, b) => b.createdAt - a.createdAt);
}
