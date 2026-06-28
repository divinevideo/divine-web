import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pickTopN,
  recordClose,
  recordError,
  recordOpen,
  recordProbe,
  recordPublish,
  recordReqEnd,
  recordReqFirstResponse,
  recordReqStart,
  refreshSticky,
  reset,
  score,
  snapshot,
  RELAY_HEALTH_CONSTANTS,
} from './relayHealth';

const NOW = 1_700_000_000_000;
const URL_A = 'wss://a.example';
const URL_B = 'wss://b.example';
const URL_C = 'wss://c.example';

beforeEach(() => {
  reset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('score()', () => {
  it('returns the default score for an unseen relay', () => {
    expect(score(URL_A)).toBeCloseTo(RELAY_HEALTH_CONSTANTS.DEFAULT_SCORE, 5);
  });

  it('penalizes errors and rewards low latency', () => {
    recordOpen(URL_A);
    for (let i = 0; i < 10; i += 1) {
      recordReqEnd(URL_A, 100, true);
    }
    recordOpen(URL_B);
    for (let i = 0; i < 10; i += 1) {
      recordReqEnd(URL_B, 100, false);
    }
    expect(score(URL_A)).toBeGreaterThan(score(URL_B));
  });

  it('decays as time passes since last success', () => {
    recordOpen(URL_A);
    recordReqEnd(URL_A, 100, true);
    const fresh = score(URL_A);
    vi.advanceTimersByTime(RELAY_HEALTH_CONSTANTS.RECENCY_WINDOW_MS + 1);
    const stale = score(URL_A);
    expect(stale).toBeLessThan(fresh);
  });

  it('penalizes recorded errors', () => {
    recordOpen(URL_A);
    for (let i = 0; i < 10; i += 1) {
      recordReqEnd(URL_A, 50, true);
    }
    const before = score(URL_A);
    recordError(URL_A);
    expect(score(URL_A)).toBeLessThan(before);
  });
});

describe('pickTopN()', () => {
  it('returns up to n relays ranked by score', () => {
    recordOpen(URL_A);
    for (let i = 0; i < 10; i += 1) {
      recordReqEnd(URL_A, 50, true);
    }
    recordOpen(URL_B);
    for (let i = 0; i < 10; i += 1) {
      recordReqEnd(URL_B, 500, true);
    }
    recordOpen(URL_C);
    for (let i = 0; i < 10; i += 1) {
      recordReqEnd(URL_C, 200, true);
    }
    const picked = pickTopN([URL_A, URL_B, URL_C], 2);
    expect(picked).toEqual([URL_A, URL_C]);
  });

  it('returns an empty list for an empty input', () => {
    expect(pickTopN([], 3)).toEqual([]);
  });

  it('returns the full list when n is larger than the input', () => {
    recordOpen(URL_A);
    const picked = pickTopN([URL_A, URL_B], 5);
    expect(picked).toHaveLength(2);
  });
});

describe('sticky routing', () => {
  it('forces a sticky relay to the top of pickTopN for its kind', () => {
    recordOpen(URL_A);
    for (let i = 0; i < 10; i += 1) {
      recordReqEnd(URL_A, 50, true);
    }
    recordOpen(URL_B);
    for (let i = 0; i < 10; i += 1) {
      recordReqEnd(URL_B, 50, true);
    }
    refreshSticky(URL_B, 34236);
    expect(pickTopN([URL_A, URL_B], 1, 34236)).toEqual([URL_B]);
  });

  it('expires sticky after the window', () => {
    recordOpen(URL_A);
    recordReqEnd(URL_A, 50, true);
    recordOpen(URL_B);
    recordReqEnd(URL_B, 50, true);
    refreshSticky(URL_B, 34236);
    vi.advanceTimersByTime(RELAY_HEALTH_CONSTANTS.STICKY_WINDOW_MS + 1);
    expect(pickTopN([URL_A, URL_B], 1, 34236)).toEqual([URL_A]);
  });

  it('does not apply sticky when the score is below the floor', () => {
    recordOpen(URL_A);
    recordReqEnd(URL_A, 50, true);
    recordOpen(URL_B);
    for (let i = 0; i < 20; i += 1) {
      recordError(URL_B);
    }
    refreshSticky(URL_B, 34236);
    expect(pickTopN([URL_A, URL_B], 1, 34236)).toEqual([URL_A]);
  });

  it('does not renew an active sticky window', () => {
    recordOpen(URL_A);
    recordReqEnd(URL_A, 50, true);
    recordOpen(URL_B);
    recordReqEnd(URL_B, 50, true);

    refreshSticky(URL_B, 34236);
    const firstExpiry = snapshot().find((x) => x.url === URL_B)?.sticky?.expiresAt;
    vi.advanceTimersByTime(10_000);
    refreshSticky(URL_B, 34236);

    expect(snapshot().find((x) => x.url === URL_B)?.sticky?.expiresAt).toBe(firstExpiry);
  });

  it('only applies sticky when the kind matches', () => {
    recordOpen(URL_A);
    recordReqEnd(URL_A, 50, true);
    recordOpen(URL_B);
    recordReqEnd(URL_B, 50, true);
    refreshSticky(URL_B, 34236);
    expect(pickTopN([URL_A, URL_B], 1, 0)).toEqual([URL_A]);
  });
});

describe('snapshot()', () => {
  it('returns one entry per relay with current state', () => {
    recordOpen(URL_A);
    recordReqEnd(URL_A, 100, true);
    const snap = snapshot();
    const a = snap.find((s) => s.url === URL_A);
    expect(a).toBeDefined();
    expect(a?.successCount).toBe(1);
    expect(a?.ewmaLatencyMs).toBeGreaterThan(0);
  });
});

describe('reset()', () => {
  it('clears all state', () => {
    recordOpen(URL_A);
    recordReqEnd(URL_A, 100, true);
    reset();
    expect(snapshot()).toEqual([]);
  });
});

describe('recordProbe()', () => {
  it('stores capabilities for later scoring', () => {
    recordProbe(URL_A, { funnelcake: true });
    const before = score(URL_A, 34236);
    const withoutBonus = score(URL_A);
    expect(before).toBeGreaterThan(withoutBonus);
  });
});

describe('recordClose()', () => {
  it('counts abnormal closes as errors', () => {
    recordOpen(URL_A);
    recordClose(URL_A, false);
    const s = snapshot().find((x) => x.url === URL_A);
    expect(s?.errorCount).toBe(1);
  });

  it('does not count clean closes as errors', () => {
    recordOpen(URL_A);
    recordClose(URL_A, true);
    const s = snapshot().find((x) => x.url === URL_A);
    expect(s?.errorCount).toBe(0);
  });
});

describe('recordPublish()', () => {
  it('counts success and failure separately', () => {
    recordPublish(URL_A, true);
    recordPublish(URL_A, false);
    const s = snapshot().find((x) => x.url === URL_A);
    expect(s?.successCount).toBe(1);
    expect(s?.errorCount).toBe(1);
  });
});

describe('recordReqStart / recordReqFirstResponse', () => {
  it('times latency from start to first response', () => {
    const req = recordReqStart(URL_A);
    vi.advanceTimersByTime(150);
    recordReqFirstResponse(req, true);
    const s = snapshot().find((x) => x.url === URL_A);
    expect(s?.ewmaLatencyMs).toBe(150);
    expect(s?.successCount).toBe(1);
  });

  it('does nothing if no start was recorded', () => {
    const req = Symbol('missing') as ReturnType<typeof recordReqStart>;
    recordReqFirstResponse(req, true);
    const s = snapshot().find((x) => x.url === URL_A);
    expect(s).toBeUndefined();
  });

  it('clears the start so a second response is a no-op', () => {
    const req = recordReqStart(URL_A);
    vi.advanceTimersByTime(100);
    recordReqFirstResponse(req, true);
    vi.advanceTimersByTime(500);
    recordReqFirstResponse(req, true);
    const s = snapshot().find((x) => x.url === URL_A);
    expect(s?.ewmaLatencyMs).toBe(100);
    expect(s?.successCount).toBe(1);
  });

  it('counts error when first response is not OK', () => {
    const req = recordReqStart(URL_A);
    vi.advanceTimersByTime(80);
    recordReqFirstResponse(req, false);
    const s = snapshot().find((x) => x.url === URL_A);
    expect(s?.errorCount).toBe(1);
    expect(s?.ewmaLatencyMs).toBe(0);
  });

  it('tracks concurrent requests to the same relay independently', () => {
    const first = recordReqStart(URL_A);
    vi.advanceTimersByTime(50);
    const second = recordReqStart(URL_A);
    vi.advanceTimersByTime(50);
    recordReqFirstResponse(second, true);
    vi.advanceTimersByTime(50);
    recordReqFirstResponse(first, true);

    const s = snapshot().find((x) => x.url === URL_A);
    expect(s?.successCount).toBe(2);
    expect(s?.ewmaLatencyMs).toBe(80);
  });
});

describe('recordError() clears sticky', () => {
  it('drops a sticky relay the moment an error is recorded', () => {
    recordOpen(URL_A);
    const reqA = recordReqStart(URL_A);
    vi.advanceTimersByTime(50);
    recordReqFirstResponse(reqA, true);
    recordOpen(URL_B);
    const reqB = recordReqStart(URL_B);
    vi.advanceTimersByTime(50);
    recordReqFirstResponse(reqB, true);
    refreshSticky(URL_B, 34236);
    expect(snapshot().find((x) => x.url === URL_B)?.sticky).not.toBeNull();
    recordError(URL_B);
    expect(snapshot().find((x) => x.url === URL_B)?.sticky).toBeNull();
  });
});
