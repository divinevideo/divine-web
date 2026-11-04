/**
 * Concord V2 community assembly — genesis (CORD-02 §1), the runtime channel
 * view (CORD-03), and the classifier the Add wizard uses to tell a V2 invite
 * from everything else.
 */

import {
  bytesToHex,
  channelGroupKey,
  communityIdOf,
  controlSignerGroupKey,
  hex32,
  random32,
  voiceGroupKey,
  voiceMediaKey,
} from "./derive";
import { channelCategory } from "./channelCategory";
import { channelPosition, compareChannelOrder } from "./channelOrder";
import { parseInviteLink, type ParsedInviteLink } from "./invite";
import type { FoldedControl } from "./control";
import { capRelays, type ChannelV2, type CommunityV2, type VoiceKeys } from "./types";

/**
 * Mint a brand-new community: a random `owner_salt` commits the owner into the
 * self-certifying `community_id`, an independent random `community_root` is
 * the access key (deliberately NOT derived from the id, so access can rotate
 * while identity stays fixed), and a random `control_root` — held by the
 * owner alone until staff are promoted — write-gates the Control Plane
 * (CORD-02 §2), every member reading it by the derived `control_pk`.
 *
 * Genesis publishes exactly two owner-signed editions — the metadata and one
 * public `#general` Channel — which the caller builds; this mints the secrets
 * and the runtime shape.
 */
export function mintCommunity(name: string, ownerPubkeyHex: string, relays: string[]): {
  community: CommunityV2;
  generalChannelId: Uint8Array;
} {
  const ownerSalt = random32();
  const owner = ownerPubkeyHex.toLowerCase();
  const id = communityIdOf(hex32(owner), ownerSalt);
  const root = random32();
  const controlRoot = random32();
  const controlPk = controlSignerGroupKey(controlRoot, id, 0n).pk;
  const generalChannelId = random32();
  return {
    community: {
      id,
      idHex: bytesToHex(id),
      owner,
      ownerSalt,
      root,
      rootEpoch: 0n,
      controlPk,
      controlRoot,
      heldRoots: [{ epoch: 0n, key: root, controlPk }],
      privateChannels: [],
      relays: capRelays(relays),
      name,
    },
    generalChannelId,
  };
}

/**
 * Assemble the channels the member can actually read from the Control fold +
 * held keys:
 *
 *   - a PUBLIC channel derives its stream from the community_root per held
 *     root epoch (readable by every member, rotates with the base for free);
 *   - a PRIVATE channel needs its independent key from the member's bundle —
 *     lacking it, the channel is omitted (its ciphertext is unreadable anyway);
 *   - deleted channels are dropped from display (history stays decryptable to
 *     anyone who held the keys, but that's a future "archive" view).
 *
 * Ordered by name for a stable sidebar.
 */
export function channelsView(community: CommunityV2, folded: FoldedControl | undefined): ChannelV2[] {
  const out: ChannelV2[] = [];
  const seen = new Set<string>();

  const privateKeysById = new Map(community.privateChannels.map((ch) => [bytesToHex(ch.id), ch]));

  // Every Channel is callable: its call coordinates derive from the same
  // (secret, epoch) that addresses its CURRENT Chat Plane (CORD-07 §1), so the
  // room name and media root roll with the Channel's key on a rekey. Each
  // channel's `voice` property is a LAZY memoized getter over this: the room
  // keypair costs a secp256k1 point multiplication, and nothing reads voice
  // keys until a call is joined or resolved for that channel — deriving them
  // eagerly here priced every channelsView at a point-mul per channel.
  const voiceKeys = (secret: Uint8Array, id: Uint8Array, epoch: bigint): VoiceKeys => ({
    room: voiceGroupKey(secret, id, epoch),
    mediaKey: voiceMediaKey(secret, id, epoch),
  });

  for (const def of folded?.channels.values() ?? []) {
    if (def.deleted) continue;
    seen.add(def.channelIdHex);
    const id = hex32(def.channelIdHex);

    // History is not one key. A channel accumulates streams: one per held
    // ROOT epoch (what it wrote while public) and one per held CHANNEL key,
    // current and retained priors (what it wrote under each private epoch).
    // Rendering only the current one is why converting a channel — or simply
    // rotating its key — appeared to erase the conversation before it.
    const rootStreams = community.heldRoots.map((r) => ({
      epoch: r.epoch,
      group: channelGroupKey(r.key, id, r.epoch),
      ...(r.retiredAt !== undefined ? { retiredAt: r.retiredAt } : {}),
    }));
    const held = privateKeysById.get(def.channelIdHex);
    const channelStreams = held
      ? [
          { epoch: held.epoch, group: channelGroupKey(held.key, id, held.epoch) },
          ...(held.priors ?? []).map((p) => ({
            epoch: p.epoch,
            group: channelGroupKey(p.key, id, p.epoch),
            ...(p.retiredAt !== undefined ? { retiredAt: p.retiredAt } : {}),
          })),
        ]
      : [];

    if (!def.isPrivate) {
      let voiceMemo: VoiceKeys | undefined;
      out.push({
        id,
        idHex: def.channelIdHex,
        name: def.name,
        isPrivate: false,
        category: channelCategory(def.metadata),
        position: channelPosition(def.metadata),
        get voice() {
          return (voiceMemo ??= voiceKeys(community.root, id, community.rootEpoch));
        },
        // Writes go to the root stream; private-era streams stay readable.
        streams: [...rootStreams, ...channelStreams],
        current: rootStreams[0],
      });
      continue;
    }

    if (!held) continue; // no key → cannot read; omit rather than tease
    let voiceMemo: VoiceKeys | undefined;
    out.push({
      id,
      idHex: def.channelIdHex,
      name: def.name,
      isPrivate: true,
      category: channelCategory(def.metadata),
      position: channelPosition(def.metadata),
      get voice() {
        return (voiceMemo ??= voiceKeys(held.key, id, held.epoch));
      },
      // Writes go to the current channel key; public-era history stays readable.
      streams: [...channelStreams, ...rootStreams],
      current: channelStreams[0],
    });
  }

  // Private channels held in the bundle but not (yet) folded from the Control
  // Plane still render (the fold may lag a fresh join); the fold's name wins
  // once it lands.
  for (const held of community.privateChannels) {
    const idHex = bytesToHex(held.id);
    if (seen.has(idHex)) continue;
    const stream = { epoch: held.epoch, group: channelGroupKey(held.key, held.id, held.epoch) };
    const priorStreams = (held.priors ?? []).map((p) => ({
      epoch: p.epoch,
      group: channelGroupKey(p.key, held.id, p.epoch),
      ...(p.retiredAt !== undefined ? { retiredAt: p.retiredAt } : {}),
    }));
    let voiceMemo: VoiceKeys | undefined;
    out.push({
      id: held.id,
      idHex,
      name: held.name || idHex.slice(0, 8),
      isPrivate: true,
      get voice() {
        return (voiceMemo ??= voiceKeys(held.key, held.id, held.epoch));
      },
      streams: [stream, ...priorStreams],
      current: stream,
    });
  }

  // Position first, then name: one order on every client (channelOrder.ts).
  out.sort(compareChannelOrder);
  return out;
}

// ── Add-wizard classification ────────────────────────────────────────────────

/** What a pasted "add" input classifies to, V2-aware. */
export type AddInputV2 = { kind: "concord-v2"; invite: ParsedInviteLink } | { kind: "other" };

/** Classify a pasted string as a Concord V2 invite, or leave it for other classifiers. */
export function classifyV2Invite(input: string): AddInputV2 {
  const invite = parseInviteLink(input);
  return invite ? { kind: "concord-v2", invite } : { kind: "other" };
}
