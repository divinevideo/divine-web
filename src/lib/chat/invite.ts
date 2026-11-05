/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Invite fragment handling — fragment stays client-side only, never logged or sent to analytics.
import { matchRoutes } from 'react-router-dom';
import { decodeFragment, encodeFragment, STOCK_RELAYS } from './concord-core/invite';
import { bytesToHex, hexToBytes } from './protocol';
export const PENDING_INVITE_KEY = 'chat:pendingInvite';
export interface Invite { communityId?: string; code?: string; tokenHex?: string; relays?: string[]; naddr?: string; fragment?: string }
/** Legacy POC fragment (#community=&invite=) kept for old local links. */
export function parseInviteHash(hash: string): Invite | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const communityId = params.get('community');
  const code = params.get('invite');
  if (communityId && code) return { communityId, code };
  try {
    const decoded = decodeFragment(raw);
    return { tokenHex: bytesToHex(decoded.token), relays: decoded.relays, fragment: raw };
  } catch { return null; }
}
export function classifyInvitePath(pathname: string): { code?: string; real: boolean } {
  const code = matchRoutes([{ path: '/invite/:code' }], { pathname })?.[0]?.params.code;
  return { code, real: code?.startsWith('naddr1') ?? false };
}
/** Spec link: /invite/<naddr>#<fragment> — naddr is a public locator, fragment is the secret. */
export function parseInviteUrl(pathname: string, hash: string): Invite | null {
  const { code } = classifyInvitePath(pathname);
  const frag = parseInviteHash(hash);
  if (!frag) return null;
  return { ...frag, naddr: code };
}
export function stashInvite(invite: Invite): void { try { sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(invite)); } catch { /* private mode */ } }
/** Read the stashed invite without removing it. */
export function peekInvite(): Invite | null {
  try {
    const raw = sessionStorage.getItem(PENDING_INVITE_KEY);
    return raw ? (JSON.parse(raw) as Invite) : null;
  } catch { return null; }
}
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

/** Preserve captured bytes; older stored invites need the kernel's stock-set encoder. */
export function resumeInviteUrl(invite: Invite | null): string | undefined {
  if (!invite?.naddr || !invite.tokenHex) return undefined;
  try {
    return `${invite.naddr}#${invite.fragment ?? encodeFragment(hexToBytes(invite.tokenHex), invite.relays ?? STOCK_RELAYS)}`;
  } catch {
    // Keep a malformed real invite on the real adapter's failure path. It must
    // never select the POC transport just because stored resume data is bad.
    return invite.naddr;
  }
}
