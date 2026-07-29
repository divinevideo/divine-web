import { beforeEach, describe, expect, it } from 'vitest';
import { LOCALE_STORAGE_KEY } from './config';
import { createI18nInstance, initializeI18n } from './index';

describe('i18n bootstrap', () => {
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

    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('uses the detected browser locale and updates document metadata', async () => {
    const i18n = await createI18nInstance({ languages: ['de-DE'] });

    expect(i18n.language).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('prefers a stored manual override over browser languages', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'tr');

    const i18n = await createI18nInstance({ languages: ['es-MX', 'en-US'] });

    expect(i18n.language).toBe('tr');
    expect(document.documentElement.lang).toBe('tr');
  });

  it('sets rtl direction for arabic', async () => {
    const i18n = await createI18nInstance({ languages: ['ar-SA'] });

    expect(i18n.language).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('reuses the singleton through initializeI18n', async () => {
    const i18n = await initializeI18n({ languages: ['fr-FR'] });

    expect(i18n.language).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('initializes in vietnamese from a regional browser locale', async () => {
    const i18n = await createI18nInstance({ languages: ['vi-VN'] });

    expect(i18n.language).toBe('vi');
    expect(i18n.t('nav.home')).toBe('Trang chủ');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('initializes in urdu with rtl direction', async () => {
    const i18n = await createI18nInstance({ languages: ['ur-PK'] });

    expect(i18n.language).toBe('ur');
    expect(i18n.t('nav.search')).toBe('تلاش');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('initializes in simplified chinese from singapore', async () => {
    const i18n = await createI18nInstance({ languages: ['zh-SG'] });

    expect(i18n.language).toBe('zh');
    expect(i18n.t('nav.home')).toBe('首页');
  });

  it('initializes in malay', async () => {
    const i18n = await createI18nInstance({ languages: ['ms-MY'] });

    expect(i18n.language).toBe('ms');
    expect(i18n.t('nav.home')).toBe('Utama');
  });
});
