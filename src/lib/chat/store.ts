/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Account-scoped in-memory chat store; cleared on account switch/logout.
import type { ChatPayload } from './protocol';
export const chatQueryScope = (pubkey: string) => `chat:v1:${pubkey}`;
export class ChatStore {
  readonly scope: string;
  messages: (ChatPayload & { author: string })[] = [];
  pending: string[] = [];
  private subs = new Set<() => void>();
  constructor(pubkey: string) { this.scope = chatQueryScope(pubkey); }
  onCleanup(fn: () => void) { this.subs.add(fn); return () => this.subs.delete(fn); }
  addMessage(m: ChatPayload & { author: string }) { this.messages = [...this.messages, m]; }
  /** Cancel subs, clear decrypted state, pending sends and keys material held here. */
  dispose() { this.subs.forEach((fn) => { try { fn(); } catch { /* noop */ } }); this.subs.clear(); this.messages = []; this.pending = []; }
}
export const CHAT_RELAY_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string,string> }).env?.VITE_CHAT_RELAY_URL) || 'wss://relay.staging.dvines.org';
