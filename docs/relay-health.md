# Relay Health

`src/lib/relayHealth.ts` tracks per-relay telemetry and exposes an
adaptive `pickTopN(urls, n, kind?)` used by `NostrProvider` to route
REQ and EVENT operations.

## Score

Each relay has a single score in `[0, 1]`. Higher is better. Default is
0.5 for unseen relays. The score combines:

- **Error rate** (50% weight): 1 − (errors / total events).
- **Latency** (30% weight): 1 − clamp(latency_ms / 5000, 0, 1).
- **Recency** (20% weight): 1 if just succeeded, decays linearly to 0
  over 5 minutes.
- **Reconnecting penalty**: −0.5 if currently reconnecting.
- **Capability bonus**: +0.1 for video kind (34236) if the relay has
  Funnelcake.

The score is recomputed on every read of the map (cheap, no cache).

## Sticky routing

`pickTopN(urls, n, kind)` forces a sticky relay to the top of the result
for its kind. Sticky applies only to `VIDEO_KINDS` (kind 34236). Window:
30 s, refreshed on successful use, expired on error. Score floor: 0.2
(a degraded relay loses its sticky).

## Reconnect behavior

`NRelay1` (from `@nostrify/nostrify`) already provides automatic
reconnection with `ExponentialBackoff(1000)`. We do not re-implement
reconnect — we just record the open/close/error events from the
underlying WebSocket so the score reflects what actually happened.

## Debug surface

In dev (`import.meta.env.DEV`) or when
`localStorage.divine.debug.relays === '1'`:

```ts
window.__DIVINE_RELAY_STATS__.snapshot();   // RelaySnapshot[]
window.__DIVINE_RELAY_STATS__.reset();      // clear all state
window.__DIVINE_RELAY_STATS__.pickTopN(urls, n, kind?);  // dry-run ranking
```

`snapshot()` returns:

```ts
interface RelaySnapshot {
  url: string;
  score: number;
  ewmaLatencyMs: number;
  errorCount: number;
  successCount: number;
  lastSuccessAt: number;   // unix ms
  lastErrorAt: number;     // unix ms
  reconnecting: boolean;
  sticky: { kind: number; expiresAt: number } | null;
}
```

## Tuning

Weights and constants live as named exports at the top of
`relayHealth.ts` (`RELAY_HEALTH_CONSTANTS`). Edit them directly; the
score function recomputes on every read so changes take effect without
a reload.

- If a relay scores high but is slow: check `ewmaLatencyMs`.
- If a relay is correctly excluded: check `lastErrorAt` and
  `errorCount`.
- If stickiness is pinning a degraded relay: lower `SCORE_FLOOR`
  (currently 0.2) or shorten `STICKY_WINDOW_MS` (currently 30 s).
