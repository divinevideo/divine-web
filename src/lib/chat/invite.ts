/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Invite fragment handling — fragment stays client-side only, never logged or sent to analytics.
import { decodeInviteFragment } from './protocol';
export const PENDING_INVITE_KEY = 'chat:pendingInvite';
export interface Invite { communityId?: string; code?: string; tokenHex?: string; relays?: string[]; naddr?: string }
/** Legacy POC fragment (#community=&invite=) kept for old local links. */
export function parseInviteHash(hash: string): Invite | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const communityId = params.get('community');
  const code = params.get('invite');
  if (communityId && code) return { communityId, code };
  try {
    const decoded = decodeInviteFragment(raw);
    return { tokenHex: decoded.tokenHex, relays: decoded.relays };
  } catch { return null; }
}
/** Spec link: /invite/<naddr>#<fragment> — naddr is a public locator, fragment is the secret. */
export function parseInviteUrl(pathname: string, hash: string): Invite | null {
  const m = pathname.match(/\/invite\/([^/?#]+)/);
  const frag = parseInviteHash(hash);
  if (!frag) return null;
  return { ...frag, naddr: m?.[1] };
}
export function stashInvite(invite: Invite): void { try { sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(invite)); } catch { /* private mode */ } }
export function consumeInvite(): Invite | null {
  try {
    const raw = sessionStorage.getItem(PENDING_INVITE_KEY);
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    return raw ? (JSON.parse(raw) as Invite) : null;
  } catch { return null; }
}
export function stripInviteFromUrl(): void {
  if (typeof window !== 'undefined' && window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
