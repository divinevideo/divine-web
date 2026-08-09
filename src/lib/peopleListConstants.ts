import { BLOCK_LIST_D_TAG } from '@/lib/blocklistFilter';

export const RESERVED_PEOPLE_LIST_D_TAGS = [
  BLOCK_LIST_D_TAG,
  'denylist',
  'dm-contacts',
  'hidden',
  'mute',
] as const;

export function isReservedPeopleListDTag(dTag: string): boolean {
  return RESERVED_PEOPLE_LIST_D_TAGS.includes(dTag as typeof RESERVED_PEOPLE_LIST_D_TAGS[number]);
}
