// ABOUTME: Account-scoped Concord transport. An EVENT write is complete only after an accepted relay OK.
import { finalizeEvent, type Event as NostrEvent, type EventTemplate } from 'nostr-tools';
import type { StreamKeyView } from './concord-core/derive';
import { verifiedEvent } from './community';
import type { SocketLike } from './relay';
export interface CommunitySigner { signEvent(template: EventTemplate): Promise<NostrEvent> }
export type RelayFilter = { kinds: number[]; authors?: string[]; '#d'?: string[]; limit?: number };
type Subscription = { filters: RelayFilter[]; event: (event: NostrEvent) => void; eose?: () => void; error?: (error: Error) => void };

export class CommunityRelay {
  private socket: SocketLike | null = null;
  private keys = new Map<string, StreamKeyView>();
  private subscriptions = new Map<string, Subscription>();
  private pending = new Map<string, { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private auth = new Set<string>();
  private challenge?: string;
  private authenticating = false;
  private sequence = 0;
  private stopped = false;
  constructor(readonly url: string, private signer: CommunitySigner,
    private makeSocket: (url: string) => SocketLike = url => new WebSocket(url) as unknown as SocketLike,
    private disconnected: () => void = () => {}) {}
  register(keys: StreamKeyView[]) {
    for (const key of keys) this.keys.set(key.pk, key);
    if (this.challenge) void this.authenticate(this.challenge);
  }
  async connect(): Promise<void> {
    this.stopped = false;
    const socket = this.makeSocket(this.url); this.socket = socket;
    socket.onmessage = event => this.receive(event.data);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { reject(new Error('Community relay timed out')); this.close(); }, 10000);
      const opened = () => { clearTimeout(timer); resolve(); };
      socket.onopen = opened;
      socket.onclose = () => {
        clearTimeout(timer); reject(new Error('Community relay disconnected'));
        this.fail(new Error('Community relay disconnected'));
        if (!this.stopped) this.disconnected();
      };
      if (socket.readyState === 1) opened();
    });
  }
  private send(frame: unknown[]) {
    if (!this.socket || this.socket.readyState !== 1) throw new Error('Community relay disconnected');
    this.socket.send(JSON.stringify(frame));
  }
  private fail(error: Error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
    for (const sub of this.subscriptions.values()) sub.error?.(error);
  }
  private async authenticate(challenge: string) {
    this.challenge = challenge; this.authenticating = true;
    // Stream secrets are held read material, never owner keys. Split control
    // read views deliberately have no signing key; do not invent one or claim
    // AUTH as their staff-only address. A relay refusing that read fails closed.
    const template: EventTemplate = { kind: 22242, content: '', tags: [['relay', this.url], ['challenge', challenge]], created_at: Math.floor(Date.now() / 1000) };
    const events: NostrEvent[] = [...this.keys.values()].filter(key => key.sk).map(key => finalizeEvent({ ...template }, key.sk!));
    try {
      events.push(await this.signer.signEvent({ ...template }));
      if (this.stopped || this.challenge !== challenge) return;
      for (const event of events) {
        if (this.auth.has(event.id)) continue;
        this.auth.add(event.id); this.send(['AUTH', event]);
      }
      this.authenticating = false;
    } catch { this.fail(new Error('Community relay authentication failed')); }
  }
  private receive(data: string) {
    let frame: unknown[];
    try { frame = JSON.parse(data); if (!Array.isArray(frame)) return; } catch { return; }
    if (frame[0] === 'AUTH' && typeof frame[1] === 'string') { this.auth.clear(); void this.authenticate(frame[1]); return; }
    if (frame[0] === 'OK') {
      const id = String(frame[1]);
      if (this.auth.delete(id)) {
        if (frame[2] !== true) { this.fail(new Error('Community relay authentication refused')); return; }
        // Gated relays can close a REQ before authentication settles. Retry
        // reads after the final ACK; publications are never replayed.
        if (!this.auth.size) for (const [key, sub] of this.subscriptions) this.send(['REQ', key, ...sub.filters]);
        return;
      }
      const pending = this.pending.get(id);
      if (pending) { clearTimeout(pending.timer); this.pending.delete(id); if (frame[2] === true) pending.resolve(); else pending.reject(new Error('Community relay refused this message')); }
      return;
    }
    const sub = this.subscriptions.get(String(frame[1])); if (!sub) return;
    if (frame[0] === 'EVENT') {
      const event = frame[2] as NostrEvent;
      if (verifiedEvent(event) && sub.filters.some(f => f.kinds.includes(event.kind) && (!f.authors || f.authors.includes(event.pubkey)) && (!f['#d'] || event.tags.some(t => t[0] === 'd' && f['#d']!.includes(t[1]))))) sub.event(event);
    }
    if (frame[0] === 'EOSE') sub.eose?.();
    if (frame[0] === 'CLOSED' && (!String(frame[2]).startsWith('auth-required:') || (this.challenge && !this.authenticating && !this.auth.size))) sub.error?.(new Error('Community relay refused this subscription'));
  }
  subscribe(filters: RelayFilter[], event: (event: NostrEvent) => void, eose?: () => void, error?: (error: Error) => void): () => void {
    const id = `community-${++this.sequence}`;
    this.subscriptions.set(id, { filters, event, eose, error }); this.send(['REQ', id, ...filters]);
    return () => { this.subscriptions.delete(id); if (this.socket?.readyState === 1) this.send(['CLOSE', id]); };
  }
  query(filters: RelayFilter[]): Promise<NostrEvent[]> {
    return new Promise((resolve, reject) => {
      const found = new Map<string, NostrEvent>();
      const timer = setTimeout(() => { off(); reject(new Error('Community relay read timed out')); }, 12000);
      const off = this.subscribe(filters, event => found.set(event.id, event), () => { clearTimeout(timer); off(); resolve([...found.values()]); }, error => { clearTimeout(timer); off(); reject(error); });
    });
  }
  publish(event: NostrEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(event.id); reject(new Error('Community relay did not acknowledge this message')); }, 8000);
      this.pending.set(event.id, { resolve, reject, timer });
      try { this.send(['EVENT', event]); } catch (error) { clearTimeout(timer); this.pending.delete(event.id); reject(error); }
    });
  }
  close() {
    this.stopped = true; this.challenge = undefined; this.auth.clear();
    this.fail(new Error('Community relay disconnected')); this.subscriptions.clear(); this.keys.clear();
    this.socket?.close(); this.socket = null;
  }
}
