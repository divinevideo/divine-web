// ABOUTME: Composition hook — fetches a people list then batch-loads author metadata for all members
// ABOUTME: Combines usePeopleList (NIP-51 kind 30000) + useBatchedAuthors for a single call-site API

import type { NostrMetadata } from '@nostrify/nostrify';
import { usePeopleList } from './usePeopleList';
import { useBatchedAuthors } from './useBatchedAuthors';

export interface PeopleListMember {
  pubkey: string;
  metadata: NostrMetadata | undefined;
}

/**
 * Fetch a people list and resolve metadata for every member in one hook.
 *
 * @param pubkey - List owner's hex pubkey (pass undefined while loading)
 * @param dTag   - The d-tag identifying the list (pass undefined while loading)
 * @returns members array, combined isLoading/isError flags
 */
export function usePeopleListMembers(
  pubkey: string | undefined,
  dTag: string | undefined,
) {
  const list = usePeopleList(pubkey ?? '', dTag ?? '');
  const memberPubkeys: string[] = list.data?.members ?? [];
  const authors = useBatchedAuthors(memberPubkeys);

  const members: PeopleListMember[] = memberPubkeys.map(pk => ({
    pubkey: pk,
    metadata: authors.data?.[pk]?.metadata,
  }));

  return {
    members,
    isLoading: list.isLoading || authors.isLoading,
    isError: list.isError || authors.isError,
  };
}
