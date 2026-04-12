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
});
