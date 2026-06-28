// ABOUTME: Per-relay health tracking, score, and adaptive pickTopN for the Nostr pool
// ABOUTME: Records open/close/error/req/publish/probe events and exposes a single score per relay

const DEFAULT_SCORE = 0.5;
const SCORE_FLOOR = 0.2;
const LATENCY_CAP_MS = 5000;
const RECENCY_WINDOW_MS = 5 * 60 * 1000;
const STICKY_WINDOW_MS = 30 * 1000;

export type CapabilityBonus = {
  nip50?: boolean;
  funnelcake?: boolean;
};

type RelayState = {
  url: string;
  ewmaLatencyMs: number;
  errorCount: number;
  successCount: number;
  lastSuccessAt: number;
  lastErrorAt: number;
  reconnecting: boolean;
  sticky: { kind: number; expiresAt: number } | null;
  capabilities: CapabilityBonus;
  source: 'live' | 'fallback';
};

const state = new Map<string, RelayState>();

function ensure(url: string): RelayState {
  let s = state.get(url);
  if (!s) {
    s = {
      url,
      ewmaLatencyMs: 0,
      errorCount: 0,
      successCount: 0,
      lastSuccessAt: 0,
      lastErrorAt: 0,
      reconnecting: false,
      sticky: null,
      capabilities: {},
      source: 'fallback',
    };
    state.set(url, s);
  }
  return s;
}

export function recordOpen(url: string): void {
  const s = ensure(url);
  s.reconnecting = false;
  s.lastSuccessAt = Date.now();
}

export function recordClose(url: string, clean: boolean): void {
  const s = ensure(url);
  if (!clean) {
    s.errorCount += 1;
    s.lastErrorAt = Date.now();
  }
}

export function recordError(url: string): void {
  const s = ensure(url);
  s.errorCount += 1;
  s.lastErrorAt = Date.now();
  s.sticky = null;
}

export function recordReconnecting(url: string): void {
  ensure(url).reconnecting = true;
}

export function recordReqEnd(
  url: string,
  latencyMs: number,
  ok: boolean,
): void {
  const s = ensure(url);
  if (ok) {
    s.successCount += 1;
    s.lastSuccessAt = Date.now();
    if (s.ewmaLatencyMs === 0) {
      s.ewmaLatencyMs = latencyMs;
    } else {
      s.ewmaLatencyMs = 0.7 * s.ewmaLatencyMs + 0.3 * latencyMs;
    }
  } else {
    s.errorCount += 1;
    s.lastErrorAt = Date.now();
  }
}

type ReqHandle = symbol;

const reqStartTimes = new Map<ReqHandle, { url: string; startedAt: number }>();

export function recordReqStart(url: string): ReqHandle {
  const handle = Symbol(url);
  reqStartTimes.set(handle, { url, startedAt: Date.now() });
  return handle;
}

export function recordReqStartClear(handle: ReqHandle): void {
  reqStartTimes.delete(handle);
}

export function recordReqFirstResponse(handle: ReqHandle, ok: boolean): void {
  const pending = reqStartTimes.get(handle);
  reqStartTimes.delete(handle);
  if (!pending) return;
  recordReqEnd(pending.url, Date.now() - pending.startedAt, ok);
}

export function recordPublish(url: string, ok: boolean): void {
  const s = ensure(url);
  if (ok) {
    s.successCount += 1;
    s.lastSuccessAt = Date.now();
  } else {
    s.errorCount += 1;
    s.lastErrorAt = Date.now();
  }
}

export function recordProbe(url: string, caps: CapabilityBonus): void {
  const s = ensure(url);
  s.capabilities = caps;
  s.source = 'live';
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizedErrorRate(s: RelayState): number {
  const total = s.successCount + s.errorCount;
  if (total === 0) return 0;
  return clamp01(s.errorCount / total);
}

function normalizedLatency(s: RelayState): number {
  if (s.ewmaLatencyMs <= 0) return 0;
  return clamp01(s.ewmaLatencyMs / LATENCY_CAP_MS);
}

function recencyFactor(s: RelayState, now: number): number {
  if (s.lastSuccessAt === 0) return 0.5;
  const elapsed = now - s.lastSuccessAt;
  if (elapsed < 0) return 1;
  if (elapsed > RECENCY_WINDOW_MS) return 0;
  return 1 - elapsed / RECENCY_WINDOW_MS;
}

function capabilityBonus(s: RelayState, kind?: number): number {
  if (kind === undefined) return 0;
  if (kind === 34236 && s.capabilities.funnelcake) return 0.1;
  return 0;
}

export function score(url: string, kind?: number, now: number = Date.now()): number {
  const s = state.get(url);
  if (!s) return DEFAULT_SCORE;
  const raw =
    0.5 * (1 - normalizedErrorRate(s)) +
    0.3 * (1 - normalizedLatency(s)) +
    0.2 * recencyFactor(s, now) +
    capabilityBonus(s, kind) -
    (s.reconnecting ? 0.5 : 0);
  return Math.max(0, Math.min(1, raw));
}

export function pickTopN(
  urls: string[],
  n: number,
  kind?: number,
  now: number = Date.now(),
): string[] {
  if (urls.length === 0) return [];
  const ranked = urls
    .map((u) => ({ url: u, s: score(u, kind, now) }))
    .sort((a, b) => b.s - a.s);

  if (kind !== undefined) {
    const stickyHolder = ranked.find((r) => {
      const st = state.get(r.url)?.sticky;
      if (!st) return false;
      if (st.kind !== kind) return false;
      if (st.expiresAt < now) return false;
      return r.s >= SCORE_FLOOR;
    });
    if (stickyHolder) {
      const rest = ranked.filter((r) => r.url !== stickyHolder.url);
      return [stickyHolder.url, ...rest.map((r) => r.url)].slice(0, n);
    }
  }

  return ranked.slice(0, n).map((r) => r.url);
}

export function refreshSticky(url: string, kind: number, now: number = Date.now()): void {
  const s = ensure(url);
  if (score(url, kind, now) < SCORE_FLOOR) return;
  s.sticky = { kind, expiresAt: now + STICKY_WINDOW_MS };
}

export function clearSticky(url: string): void {
  const s = state.get(url);
  if (s) s.sticky = null;
}

export interface RelaySnapshot {
  url: string;
  score: number;
  ewmaLatencyMs: number;
  errorCount: number;
  successCount: number;
  lastSuccessAt: number;
  lastErrorAt: number;
  reconnecting: boolean;
  sticky: { kind: number; expiresAt: number } | null;
}

export function snapshot(): RelaySnapshot[] {
  const now = Date.now();
  return Array.from(state.values()).map((s) => ({
    url: s.url,
    score: score(s.url, undefined, now),
    ewmaLatencyMs: s.ewmaLatencyMs,
    errorCount: s.errorCount,
    successCount: s.successCount,
    lastSuccessAt: s.lastSuccessAt,
    lastErrorAt: s.lastErrorAt,
    reconnecting: s.reconnecting,
    sticky: s.sticky ? { ...s.sticky } : null,
  }));
}

export function reset(): void {
  state.clear();
  reqStartTimes.clear();
}

export const RELAY_HEALTH_CONSTANTS = {
  DEFAULT_SCORE,
  SCORE_FLOOR,
  LATENCY_CAP_MS,
  RECENCY_WINDOW_MS,
  STICKY_WINDOW_MS,
} as const;
