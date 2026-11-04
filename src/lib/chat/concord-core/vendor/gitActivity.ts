/**
 * NIP-34 git repository attachment model, extracted from armada
 * `src/lib/gitActivity.ts`. Only the address/attachment subset the Concord
 * channel metadata model (`types.ts`, `control.ts`) needs; announcement and
 * ticket parsing stay in the client.
 */

/** NIP-34 repository announcement. */
export const GIT_REPOSITORY_ANNOUNCEMENT_KIND = 30617;

/** A validated NIP-34 repository coordinate. */
export interface GitRepositoryAddress {
  kind: typeof GIT_REPOSITORY_ANNOUNCEMENT_KIND;
  owner: string;
  identifier: string;
  coordinate: string;
}

/** Parse `kind:pubkey:identifier`; identifier may itself contain colons. */
function parseAddr(value: string | undefined): { kind: number; pubkey: string; identifier: string } | undefined {
  if (!value) return undefined;
  const first = value.indexOf(":");
  const second = value.indexOf(":", first + 1);
  if (first <= 0 || second <= first + 1) return undefined;
  const kind = Number(value.slice(0, first));
  const pubkey = value.slice(first + 1, second);
  const identifier = value.slice(second + 1);
  if (!Number.isInteger(kind) || kind < 0) return undefined;
  if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) return undefined;
  return { kind, pubkey, identifier };
}

/** Parse a canonical `30617:<owner-pubkey>:<d>` repository coordinate. */
export function parseGitRepositoryAddress(value: string | undefined): GitRepositoryAddress | undefined {
  const parsed = parseAddr(value);
  if (
    !parsed ||
    parsed.kind !== GIT_REPOSITORY_ANNOUNCEMENT_KIND ||
    !parsed.identifier ||
    parsed.pubkey !== parsed.pubkey.toLowerCase()
  ) {
    return undefined;
  }

  return {
    kind: GIT_REPOSITORY_ANNOUNCEMENT_KIND,
    owner: parsed.pubkey,
    identifier: parsed.identifier,
    coordinate: `${GIT_REPOSITORY_ANNOUNCEMENT_KIND}:${parsed.pubkey}:${parsed.identifier}`,
  };
}

import { normalizeRelayUrl } from "./platform";

function normalizedRelays(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    // Relay hints from tags must be explicit ws/wss URLs; no bare-host leniency.
    if (!/^wss?:\/\//i.test(url.trim())) continue;
    const n = normalizeRelayUrl(url);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export interface GitRepositoryAttachment {
  address: GitRepositoryAddress;
  relayHints: string[];
  attachedAt: number;
  detachedAt?: number;
}

/** True when an event timestamp falls within an attachment's half-open interval. */
export function isGitRepositoryAttachedAt(attachment: GitRepositoryAttachment, createdAt: number): boolean {
  return attachment.attachedAt <= createdAt && (attachment.detachedAt === undefined || createdAt < attachment.detachedAt);
}

/** Normalize relay hints and remove duplicate attachment intervals. */
export function normalizeGitRepositoryAttachments(
  attachments: readonly GitRepositoryAttachment[],
): GitRepositoryAttachment[] {
  const seen = new Set<string>();
  return attachments
    .filter((attachment) => attachment.detachedAt === undefined || attachment.detachedAt >= attachment.attachedAt)
    .map((attachment) => ({ ...attachment, relayHints: normalizedRelays(attachment.relayHints) }))
    .sort((a, b) => a.attachedAt - b.attachedAt || a.address.coordinate.localeCompare(b.address.coordinate))
    .filter((attachment) => {
      const key = `${attachment.address.coordinate}\u0000${attachment.attachedAt}\u0000${attachment.detachedAt ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Close each currently-active matching attachment at `detachedAt`. */
export function detachGitRepository(
  attachments: readonly GitRepositoryAttachment[],
  address: GitRepositoryAddress,
  detachedAt: number,
): GitRepositoryAttachment[] {
  return attachments.map((attachment) =>
    attachment.address.coordinate === address.coordinate && attachment.detachedAt === undefined
      ? { ...attachment, detachedAt: Math.max(detachedAt, attachment.attachedAt) }
      : attachment,
  );
}

/** Add a new interval, allowing a repository to be reattached after detachment. */
export function attachGitRepository(
  attachments: readonly GitRepositoryAttachment[],
  address: GitRepositoryAddress,
  relayHints: readonly string[],
  attachedAt: number,
): GitRepositoryAttachment[] {
  return normalizeGitRepositoryAttachments([
    ...attachments,
    { address, relayHints: normalizedRelays(relayHints), attachedAt },
  ]);
}
