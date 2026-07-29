import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  clearStoredLocale,
  getLocaleDirection,
  getStoredLocale,
  resolveInitialLocale,
  setStoredLocale,
} from './config';

describe('i18n config', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });

    window.localStorage.clear();
  });

  it('matches regional browser locales to supported base locales', () => {
    expect(resolveInitialLocale(['es-MX', 'en-US'])).toBe('es');
    expect(resolveInitialLocale(['pt-BR'])).toBe('pt');
    expect(resolveInitialLocale(['th-TH', 'de-DE'])).toBe('de');
  });

  it('falls back to english when no locale matches', () => {
    expect(resolveInitialLocale(['th-TH', 'uk-UA'])).toBe(DEFAULT_LOCALE);
  });

  it('resolves top-country locales (vi, ur, zh, ms) from regional variants', () => {
    expect(resolveInitialLocale(['vi-VN'])).toBe('vi');
    expect(resolveInitialLocale(['ur-PK'])).toBe('ur');
    expect(resolveInitialLocale(['zh-SG'])).toBe('zh');
    expect(resolveInitialLocale(['zh-CN'])).toBe('zh');
    expect(resolveInitialLocale(['ms-MY'])).toBe('ms');
    expect(resolveInitialLocale(['ms-SG'])).toBe('ms');
  });

  it('aliases legacy tagalog codes (tl, tl-PH) to fil', () => {
    // 'tl' and 'tl-PH' come from older OS settings; LOCALE_ALIASES routes them to 'fil'.
    expect(resolveInitialLocale(['tl'])).toBe('fil');
    expect(resolveInitialLocale(['tl-PH'])).toBe('fil');
  });

  it('resolves filipino regional variants (fil-PH) via the standard base-language fallback', () => {
    // 'fil' is a supported locale, so 'fil-PH' resolves via the normal split-on-dash path,
    // not via LOCALE_ALIASES.
    expect(resolveInitialLocale(['fil-PH'])).toBe('fil');
    expect(resolveInitialLocale(['fil'])).toBe('fil');
  });

  it('prefers a persisted manual override over browser locales', () => {
    setStoredLocale('tr');

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('tr');
    expect(getStoredLocale()).toBe('tr');
    expect(resolveInitialLocale(['es-MX', 'en-US'])).toBe('tr');
  });

  it('ignores corrupt persisted locales', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pirate');

    expect(getStoredLocale()).toBeNull();
    expect(resolveInitialLocale(['ja-JP'])).toBe('ja');
  });

  it('can clear a stored locale', () => {
    setStoredLocale('fr');
    clearStoredLocale();

    expect(getStoredLocale()).toBeNull();
  });

  it('uses rtl direction for arabic and urdu', () => {
    expect(getLocaleDirection('ar')).toBe('rtl');
    expect(getLocaleDirection('ur')).toBe('rtl');
    expect(getLocaleDirection('en')).toBe('ltr');
    expect(getLocaleDirection('zh')).toBe('ltr');
  });
});
