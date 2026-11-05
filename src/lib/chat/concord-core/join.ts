/**
 * Join-material helpers, extracted from armada
 * `src/concord-v2/hooks/useCommunityActions2.ts` (the pure part only).
 *
 * Turning a verified invite bundle into the membership-list entry is protocol
 * work, not UI work: any headless client (like the bridge) joins the same way.
 */

import type { CommunityListEntry, JoinMaterial } from "./communityList";
import { encodeFragment, type InviteBundle, type ParsedInviteLink } from "./invite";
import { capRelays } from "./types";

/** Turn a verified bundle into the membership-list join material + entry. */
export function bundleToEntry(bundle: InviteBundle, opts?: { inviteRef?: string }): CommunityListEntry {
  const jm: JoinMaterial = {
    community_id: bundle.community_id,
    owner: bundle.owner,
    owner_salt: bundle.owner_salt,
    community_root: bundle.community_root,
    root_epoch: bundle.root_epoch,
    // The split epoch's Control Plane address (CORD-02 §7): subscribe, verify
    // and read, never write. Dropped when malformed rather than carried
    // through — a bad address is a plane nobody can read, and absent means
    // "legacy", which at least folds at the member-derivable address.
    ...(typeof bundle.control_pk === "string" && /^[0-9a-f]{64}$/i.test(bundle.control_pk)
      ? { control_pk: bundle.control_pk.toLowerCase() }
      : {}),
    channels: Array.isArray(bundle.channels)
      ? bundle.channels.map((ch) => ({ id: ch.id, key: ch.key, epoch: ch.epoch, name: ch.name }))
      : [],
    relays: capRelays(bundle.relays),
    name: bundle.name,
  };
  return {
    community_id: jm.community_id,
    seed: jm,
    current: jm,
    added_at: Date.now(),
    // Remember the link joined through (bare `naddr#fragment`), so a member
    // stranded on a superseded epoch can re-resolve the SAME link once its
    // creator refreshes the bundle (CORD-05 §2).
    ...(opts?.inviteRef ? { invite_ref: opts.inviteRef } : {}),
  };
}

/** The domain-agnostic bare form of a parsed invite link: `<naddr>#<fragment>`. */
export function inviteRefOf(invite: ParsedInviteLink): string {
  return `${invite.naddr}#${encodeFragment(invite.token, invite.bootstrapRelays)}`;
}
