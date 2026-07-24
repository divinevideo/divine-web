// ABOUTME: Tests for coarse platform detection used by the app-download picker
// ABOUTME: Real-world user-agent strings for iOS, Android, desktop, and the no-nav case

import { describe, it, expect } from 'vitest';
import { detectPlatform } from './detectPlatform';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('detectPlatform', () => {
  it('detects iPhone and iPad as ios', () => {
    expect(detectPlatform(IPHONE)).toBe('ios');
    expect(detectPlatform(IPAD)).toBe('ios');
  });

  it('detects Android', () => {
    expect(detectPlatform(ANDROID)).toBe('android');
  });

  it('treats Mac and Windows as desktop', () => {
    expect(detectPlatform(MAC)).toBe('desktop');
    expect(detectPlatform(WINDOWS)).toBe('desktop');
  });

  it('defaults to desktop when there is no user agent (e.g. prerender)', () => {
    expect(detectPlatform(undefined)).toBe('desktop');
    expect(detectPlatform('')).toBe('desktop');
  });
});
