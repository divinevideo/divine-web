// ABOUTME: Pure NIP-22 (kind 1111) tag construction for comments on roots and replies
// ABOUTME: Extracted from usePostComment for unit testing without React or relays

import { NKinds, type NostrEvent } from '@nostrify/nostrify';

/**
 * Build NIP-22 tag array for a comment on `root`, optionally in reply to `reply`.
 * Does not include kind/content/signature — tags only.
 */
export function buildNip22CommentTags(
  root: NostrEvent | URL,
  reply?: NostrEvent | URL
): string[][] {
  const tags: string[][] = [];

  const dRoot = root instanceof URL ? '' : root.tags.find(([name]) => name === 'd')?.[1] ?? '';
  const dReply = reply instanceof URL ? '' : reply?.tags.find(([name]) => name === 'd')?.[1] ?? '';

  if (root instanceof URL) {
    tags.push(['I', root.toString()]);
  } else if (NKinds.addressable(root.kind)) {
    tags.push(['A', `${root.kind}:${root.pubkey}:${dRoot}`]);
    tags.push(['E', root.id]);
  } else if (NKinds.replaceable(root.kind)) {
    tags.push(['A', `${root.kind}:${root.pubkey}:`]);
  } else {
    tags.push(['E', root.id]);
  }
  if (root instanceof URL) {
    tags.push(['K', root.hostname]);
  } else {
    tags.push(['K', root.kind.toString()]);
    tags.push(['P', root.pubkey]);
  }

  if (reply) {
    if (reply instanceof URL) {
      tags.push(['i', reply.toString()]);
    } else if (NKinds.addressable(reply.kind)) {
      tags.push(['a', `${reply.kind}:${reply.pubkey}:${dReply}`]);
    } else if (NKinds.replaceable(reply.kind)) {
      tags.push(['a', `${reply.kind}:${reply.pubkey}:`]);
    } else {
      tags.push(['e', reply.id]);
    }
    if (reply instanceof URL) {
      tags.push(['k', reply.hostname]);
    } else {
      tags.push(['k', reply.kind.toString()]);
      tags.push(['p', reply.pubkey]);
    }
  } else {
    if (root instanceof URL) {
      tags.push(['i', root.toString()]);
    } else if (NKinds.addressable(root.kind)) {
      tags.push(['a', `${root.kind}:${root.pubkey}:${dRoot}`]);
      tags.push(['e', root.id]);
    } else if (NKinds.replaceable(root.kind)) {
      tags.push(['a', `${root.kind}:${root.pubkey}:`]);
    } else {
      tags.push(['e', root.id]);
    }
    if (root instanceof URL) {
      tags.push(['k', root.hostname]);
    } else {
      tags.push(['k', root.kind.toString()]);
      tags.push(['p', root.pubkey]);
    }
  }

  return tags;
}
