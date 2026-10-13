/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Invite fragment handling — fragment stays client-side only, never logged or sent to analytics.
export const PENDING_INVITE_KEY = 'chat:pendingInvite';
export interface Invite { communityId: string; code: string }
export function parseInviteHash(hash: string): Invite | null {
  const raw = hash.replace(/^#/, '');
  const params = new URLSearchParams(raw);
  const communityId = params.get('community');
  const code = params.get('invite');
  return communityId && code ? { communityId, code } : null;
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
