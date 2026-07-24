// ABOUTME: Tests the device-aware share decision — native sheet on touch, copy on desktop
// ABOUTME: The desktop-copy path is an explicit product requirement, not a fallback

import { describe, it, expect, vi, afterEach } from 'vitest';
import { prefersNativeShare } from './useShowcaseShare';

const originalNavigator = globalThis.navigator;
const originalMatchMedia = globalThis.window?.matchMedia;

function setup({ hasShare, coarse }: { hasShare: boolean; coarse: boolean }) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: hasShare ? { share: vi.fn() } : {},
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('coarse') ? coarse : false,
    media: query,
  }));
  // jsdom's window.matchMedia is what the hook reads.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('coarse') ? coarse : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  if (originalMatchMedia) window.matchMedia = originalMatchMedia;
  vi.unstubAllGlobals();
});

describe('prefersNativeShare', () => {
  it('is true on a touch device that supports Web Share', () => {
    setup({ hasShare: true, coarse: true });
    expect(prefersNativeShare()).toBe(true);
  });

  // The important case: desktop Chrome DOES expose navigator.share, but the
  // showcase must copy on desktop rather than pop an OS share sheet.
  it('is false on desktop even though navigator.share exists', () => {
    setup({ hasShare: true, coarse: false });
    expect(prefersNativeShare()).toBe(false);
  });

  it('is false when Web Share is unavailable', () => {
    setup({ hasShare: false, coarse: true });
    expect(prefersNativeShare()).toBe(false);
  });
});
