/**
 * Channel categories — an Armada client convention (see CORD.md).
 *
 * CORD-03 has no notion of grouping, so a Channel MAY carry
 * `custom["armada.category"] = { name }` — a display-only member of the same
 * client-extensible object as `armada.git` (CORD-02 §6).
 *
 * A category is EMERGENT, not an entity: it exists exactly as long as some
 * visible Channel names it. That is the whole design, and three properties
 * follow from it.
 *
 *   1. Nothing to keep in sync. There is no category list to create, delete,
 *      or garbage-collect, and no way to have a category pointing at a channel
 *      that no longer exists (or the reverse). Two moderators filing different
 *      channels at once collide on individual channels rather than clobbering
 *      a shared list — the reason CORD-04 keeps Role order per-entity.
 *
 *   2. A member sees a category exactly when they can see at least one channel
 *      in it, for free. `channelsView` already omits a private Channel whose
 *      key the member does not hold (CORD-03), so a category all of whose
 *      channels are gated away simply has no members left to derive it from.
 *      No separate visibility rule, and no way for the two to disagree.
 *
 *   3. An empty category cannot exist, so the sidebar can never show a member
 *      a heading whose contents are all hidden — which would advertise the
 *      existence of channels they cannot read.
 *
 * On (3), the honest bound: Channel METADATA lives on the Control Plane and is
 * readable by every member, gated content or not. Hiding the heading is a
 * display courtesy of the same kind as omitting the channel itself — a client
 * reading the fold directly still sees that the category exists. Categories
 * organize a sidebar; they are not an access control.
 */

import { NAME_MAX_BYTES, utf8Len, type ChannelMetadata } from "./types";

export const ARMADA_CHANNEL_CATEGORY_METADATA_KEY = "armada.category";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * The channel's category name, or undefined when it belongs to none. Bounded
 * by the same 64 bytes as every other name (CORD-02 §6); an over-long or blank
 * one reads as uncategorized rather than invalidating the channel.
 */
export function channelCategory(metadata: ChannelMetadata): string | undefined {
  const extension = isRecord(metadata.custom) ? metadata.custom[ARMADA_CHANNEL_CATEGORY_METADATA_KEY] : undefined;
  if (!isRecord(extension) || typeof extension.name !== "string") return undefined;
  const name = extension.name.trim();
  if (!name || utf8Len(name) > NAME_MAX_BYTES) return undefined;
  return name;
}

/** Metadata with the category set (or cleared), other extensions untouched. */
export function withChannelCategory(metadata: ChannelMetadata, name: string | undefined): ChannelMetadata {
  const custom: Record<string, unknown> = isRecord(metadata.custom) ? { ...metadata.custom } : {};
  const trimmed = name?.trim();
  if (trimmed) custom[ARMADA_CHANNEL_CATEGORY_METADATA_KEY] = { name: trimmed };
  else delete custom[ARMADA_CHANNEL_CATEGORY_METADATA_KEY];
  const next: ChannelMetadata = { ...metadata };
  if (Object.keys(custom).length > 0) next.custom = custom;
  else delete next.custom;
  return next;
}

/** Group identity: "Voice" and "voice" are one category, not two near-duplicates. */
export function categoryKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * The category names in use, in display order, one entry per casefolded group.
 *
 * What a "move to category" picker offers: filing from the list is the only
 * thing keeping the arrangement from silting up with near-duplicates, since a
 * category has no id and re-typing its name is how the two spellings that then
 * have to be merged get created.
 */
export function categoryNames<T>(
  channels: readonly T[],
  categoryOf: (channel: T) => string | undefined,
): string[] {
  const byKey = new Map<string, string>();
  for (const channel of channels) {
    const name = categoryOf(channel)?.trim();
    if (name && !byKey.has(categoryKey(name))) byKey.set(categoryKey(name), name);
  }
  return [...byKey.values()];
}

/** One rendered group: a heading (or the uncategorized run) and its channels. */
export interface ChannelCategory<T> {
  /** Casefolded identity; empty string for the uncategorized run. */
  key: string;
  /** The spelling to display, taken from the first channel in the group. */
  name: string;
  channels: T[];
}

/**
 * Partition channels (ALREADY in display order) into the uncategorized run
 * followed by the categories.
 *
 * Input order does all the work: within a category the channels keep it, and
 * the categories themselves appear in order of their first channel. So a
 * community that orders its channels (`armada.order`) gets its categories
 * ordered by the same act, with no second arrangement to maintain and no way
 * for the two to contradict each other.
 *
 * A category's position is therefore not settable — it is READ OFF its first
 * member. Moving a category means moving the channel that leads it, which is
 * why the drag offers no heading-sized target.
 *
 * Uncategorized channels lead, unindented — a community that never files
 * anything sees exactly the flat list it had before.
 *
 * The displayed spelling comes from the first channel of the group, so two
 * channels disagreeing on case produce one heading, chosen deterministically
 * rather than by whichever the fold happened to yield first.
 */
export function groupChannelsByCategory<T extends { name: string }>(
  channels: readonly T[],
  categoryOf: (channel: T) => string | undefined,
): { uncategorized: T[]; categories: ChannelCategory<T>[] } {
  const uncategorized: T[] = [];
  const categories: ChannelCategory<T>[] = [];
  const byKey = new Map<string, ChannelCategory<T>>();

  for (const channel of channels) {
    const raw = categoryOf(channel);
    const name = raw?.trim();
    if (!name) {
      uncategorized.push(channel);
      continue;
    }
    const key = categoryKey(name);
    let group = byKey.get(key);
    if (!group) {
      group = { key, name, channels: [] };
      byKey.set(key, group);
      categories.push(group);
    }
    group.channels.push(channel);
  }

  return { uncategorized, categories };
}
