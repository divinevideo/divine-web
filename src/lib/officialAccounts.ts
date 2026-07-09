// ABOUTME: Pinned official-accounts set + discriminated NIP-05 resolver + graded
// ABOUTME: pin ∩ NIP-05 gate for the protected-minor DM restriction (#176 web).
// ABOUTME: Mirrors the mobile OfficialAccountsService; localStorage last-known store.

import { parseNip05 } from './nip05Resolve';

/**
 * How a NIP-05 resolution landed, graded by ambiguity so the caller can react
 * differently: a different key is an unambiguous revoke/compromise (drop now),
 * an affirmative absence is softer (confirm before dropping), and a network
 * failure carries no signal at all (keep last-known). Unlike
 * {@link resolveNip05ToPubkey} which collapses all three into `null`.
 */
export type Nip05Resolution =
  | { kind: 'matched'; resolvedPubkey: string }
  | { kind: 'differentKey'; resolvedPubkey: string }
  | { kind: 'absent' }
  | { kind: 'networkError' };

const RESOLVE_TIMEOUT_MS = 5000;
// A legitimate nostr.json for a handful of names is well under a kilobyte;
// reject anything advertising far more before parsing it.
const MAX_CONTENT_LENGTH = 256 * 1024;

export async function resolveOfficialNip05(
  nip05: string,
  expectedPubkey: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<Nip05Resolution> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const parts = parseNip05(nip05);
  // A malformed identifier is not a trustworthy "absent" — treat as no signal.
  if (!parts) return { kind: 'networkError' };

  const url = `https://${parts.domain}/.well-known/nostr.json?name=${encodeURIComponent(parts.name)}`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? RESOLVE_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      // NIP-05 (§05): the .well-known/nostr.json endpoint MUST NOT redirect and
      // fetchers MUST ignore redirects. Following a 30x is a spurious-APPROVE
      // vector (a MITM/misconfigured origin could bounce the lookup to an
      // attacker host that returns the expected key for a burner). `error`
      // makes fetch reject on any redirect, which the catch maps to
      // networkError (no signal) rather than trusting a redirect target's body.
      redirect: 'error',
    });
  } catch {
    // Offline, timeout (abort), DNS, connection reset — no signal.
    return { kind: 'networkError' };
  } finally {
    clearTimeout(timer);
  }

  // A 404 is an affirmative "this name is not here"; other non-2xx carry no
  // trustworthy signal.
  if (response.status === 404) return { kind: 'absent' };
  if (!response.ok) return { kind: 'networkError' };

  const advertised = Number(response.headers?.get?.('content-length') ?? '');
  if (Number.isFinite(advertised) && advertised > MAX_CONTENT_LENGTH) {
    return { kind: 'networkError' };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { kind: 'networkError' };
  }

  // A well-formed nostr.json MUST carry a `names` object; its absence means the
  // response isn't a usable directory (malformed), not an affirmative absence.
  const names = (data as { names?: unknown } | null)?.names;
  if (typeof names !== 'object' || names === null) {
    return { kind: 'networkError' };
  }

  const resolved = (names as Record<string, unknown>)[parts.name];
  if (typeof resolved !== 'string') {
    // Well-formed directory that simply does not list this name.
    return { kind: 'absent' };
  }

  // Normalize BOTH sides identically: the pin is the trust anchor, and a
  // checksummed/padded nostr.json must not read as a different key.
  const norm = resolved.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(norm)) {
    // A non-hex value isn't a usable pubkey — a malformed directory entry
    // carries no trustworthy signal. Treat as networkError (keep last-known),
    // NOT differentKey, so garbage from the name server can't spuriously revoke.
    return { kind: 'networkError' };
  }
  if (norm === expectedPubkey.trim().toLowerCase()) {
    return { kind: 'matched', resolvedPubkey: norm };
  }
  return { kind: 'differentKey', resolvedPubkey: norm };
}

export interface OfficialAccount {
  pubkeyHex: string;
  nip05: string;
  role: string;
  /** Whether a protected minor may exchange DMs with this account. */
  minorContactable: boolean;
}

/** Divine HQ pinned pubkey (`_@divinehq.divine.video`). */
export const DIVINE_HQ_PUBKEY =
  'c4a39f1291291d452405cd8ddd798c4a29a3858c52cd0d843f1f6852cf17682e';

/**
 * Divine Moderation pinned pubkey (`moderation@divine.video`) — the official,
 * NIP-05-verified support/contact identity. Re-exported as `DIVINE_SUPPORT_PUBKEY`
 * (dm.ts) so the "Message Support" surfaces point at a pinned, minorContactable
 * account rather than an unverifiable personal key.
 */
export const DIVINE_MODERATION_PUBKEY =
  '8fd5eb6d8f362163bc00a5ab6b4a3167dbf32d00ec4efdbcf43b3c9514433b7e';

/**
 * The pinned child-contactable set (verified live 2026-07-07). Additions are
 * release-gated by design — this is a child-contact list, so requiring a deploy
 * to add a key is the accepted friction that makes the pin an attacker-addition
 * barrier. Each entry pins its OWN canonical identifier form.
 */
export const PINNED_OFFICIAL_ACCOUNTS: OfficialAccount[] = [
  {
    pubkeyHex: DIVINE_HQ_PUBKEY,
    nip05: '_@divinehq.divine.video',
    role: 'hq',
    minorContactable: true,
  },
  {
    pubkeyHex: DIVINE_MODERATION_PUBKEY,
    nip05: 'moderation@divine.video',
    role: 'moderation',
    minorContactable: true,
  },
];

const normHex = (hex: string): string => hex.trim().toLowerCase();

function pinnedFor(
  hex: string,
  accounts: OfficialAccount[],
): OfficialAccount | undefined {
  const h = normHex(hex);
  return accounts.find((a) => normHex(a.pubkeyHex) === h);
}

/** Pin-only, synchronous: the attacker-addition barrier. */
export function isPinnedMinorContactable(
  hex: string,
  accounts: OfficialAccount[] = PINNED_OFFICIAL_ACCOUNTS,
): boolean {
  const a = pinnedFor(hex, accounts);
  return !!a && a.minorContactable;
}

const TTL_MS = 60 * 60 * 1000;
const ABSENCE_RECHECK_MS = 5 * 60 * 1000;

interface StoredVerdict {
  approved: boolean;
  checkedAt: number;
  firstAbsentAt?: number;
}

type ResolveFn = (nip05: string, expectedHex: string) => Promise<Nip05Resolution>;

/**
 * Decides whether a protected minor may DM a given pubkey (#176): pin ∩ live
 * NIP-05, graded revocation, a 1h freshness TTL, a 5-min confirming recheck for
 * absence, and a persistent (localStorage) last-known verdict. Mirrors the
 * mobile OfficialAccountsService.
 */
export class OfficialAccountsService {
  private readonly resolve: ResolveFn;
  private readonly now: () => number;
  private readonly storage: Storage | undefined;
  private readonly accounts: OfficialAccount[];
  private readonly inFlight = new Map<string, Promise<boolean>>();
  private readonly listeners = new Set<() => void>();

  constructor(
    opts: {
      resolve?: ResolveFn;
      now?: () => number;
      storage?: Storage;
      accounts?: OfficialAccount[];
      fetchImpl?: typeof fetch;
    } = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.storage =
      opts.storage ??
      (typeof localStorage !== 'undefined' ? localStorage : undefined);
    this.accounts = opts.accounts ?? PINNED_OFFICIAL_ACCOUNTS;
    this.resolve =
      opts.resolve ??
      ((nip05, hex) =>
        resolveOfficialNip05(nip05, hex, { fetchImpl: opts.fetchImpl }));
  }

  isPinnedMinorContactable(hex: string): boolean {
    return isPinnedMinorContactable(hex, this.accounts);
  }

  /** Pin ∩ last-known, synchronous, no network. For hot list/render paths. */
  isApprovedMinorDmRecipientSync(hex: string): boolean {
    if (!this.isPinnedMinorContactable(hex)) return false;
    return this.load(hex)?.approved ?? true;
  }

  /** Pin ∩ live NIP-05, graded. Awaits any in-flight resolution for the same
   *  account rather than treating concurrency as failure. */
  async isApprovedMinorDmRecipient(hex: string): Promise<boolean> {
    const account = pinnedFor(hex, this.accounts);
    if (!account || !account.minorContactable) return false;

    const key = normHex(hex);
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const p = this.resolveAndDecide(account, hex).finally(() =>
      this.inFlight.delete(key),
    );
    this.inFlight.set(key, p);
    return p;
  }

  /** Subscribe to persisted verdict flips (for receive-time revalidation). */
  onVerdictChanged(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private async resolveAndDecide(
    account: OfficialAccount,
    hex: string,
  ): Promise<boolean> {
    const record = this.load(hex);
    if (record && !this.isStale(record)) return record.approved;

    const priorApproved = record?.approved ?? true;
    const res = await this.resolve(account.nip05, account.pubkeyHex);
    const now = this.now();
    switch (res.kind) {
      case 'matched':
        this.persist(hex, { approved: true, checkedAt: now }, priorApproved);
        return true;
      case 'differentKey':
        this.persist(hex, { approved: false, checkedAt: now }, priorApproved);
        return false;
      case 'absent': {
        if (record && !record.approved) return false; // stays revoked
        const firstAbsent = record?.firstAbsentAt;
        if (firstAbsent !== undefined && now - firstAbsent >= ABSENCE_RECHECK_MS) {
          this.persist(hex, { approved: false, checkedAt: now }, priorApproved);
          return false; // confirming recheck: drop
        }
        this.persist(
          hex,
          { approved: true, checkedAt: now, firstAbsentAt: firstAbsent ?? now },
          priorApproved,
        );
        return true;
      }
      case 'networkError':
        // No trustworthy signal: keep last-known; pinned default is trusted.
        return record?.approved ?? true;
    }
  }

  private isStale(r: StoredVerdict): boolean {
    const age = this.now() - r.checkedAt;
    const limit = r.firstAbsentAt !== undefined ? ABSENCE_RECHECK_MS : TTL_MS;
    return age >= limit;
  }

  private keyFor(hex: string): string {
    return `official_recipient_${normHex(hex)}`;
  }

  private load(hex: string): StoredVerdict | null {
    const raw = this.storage?.getItem(this.keyFor(hex));
    if (!raw) return null;
    try {
      const d = JSON.parse(raw) as StoredVerdict;
      if (typeof d.checkedAt === 'number' && typeof d.approved === 'boolean') {
        return d;
      }
    } catch {
      // Intentional no-op: a corrupt entry is treated as no record — the caller
      // falls back to the pin-trusted default and the async path re-resolves.
    }
    return null;
  }

  private persist(hex: string, record: StoredVerdict, priorApproved: boolean) {
    try {
      this.storage?.setItem(this.keyFor(hex), JSON.stringify(record));
    } catch {
      // Storage full/unavailable: skip persistence. Safety is unaffected — the
      // sync default stays pin-trusted and every send re-resolves.
    }
    if (record.approved !== priorApproved) {
      for (const fn of this.listeners) fn();
    }
  }
}

/**
 * App-wide singleton (browser default: real fetch + localStorage). Shared by the
 * send gate and the inbound filter so the last-known cache + onVerdictChanged
 * stream are consistent across both.
 */
export const officialAccountsService = new OfficialAccountsService();
