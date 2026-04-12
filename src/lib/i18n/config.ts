export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'tr',
  'ja',
  'de',
  'pt',
  'fr',
  'id',
  'nl',
  'sv',
  'ro',
  'it',
  'pl',
  'ko',
  'ar',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocaleDirection = 'ltr' | 'rtl';

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const LOCALE_STORAGE_KEY = 'divine:locale';

export interface LocaleOption {
  code: SupportedLocale;
  name: string;
  nativeName: string;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  if (!value) {
    return false;
  }

  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(input: string | null | undefined): SupportedLocale | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const lowercase = trimmed.toLowerCase();
  if (isSupportedLocale(lowercase)) {
    return lowercase;
  }

  const baseLanguage = lowercase.split('-')[0];
  return isSupportedLocale(baseLanguage) ? baseLanguage : null;
}

export function getStoredLocale(): SupportedLocale | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  return normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
}

export function setStoredLocale(locale: SupportedLocale): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function clearStoredLocale(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(LOCALE_STORAGE_KEY);
}

export function resolveBrowserLocale(languages: readonly string[] | null | undefined): SupportedLocale {
  if (!languages || languages.length === 0) {
    return DEFAULT_LOCALE;
  }

  for (const language of languages) {
    const normalized = normalizeLocale(language);
    if (normalized) {
      return normalized;
    }
  }

  return DEFAULT_LOCALE;
}

export function resolveInitialLocale(languages: readonly string[] | null | undefined): SupportedLocale {
  return getStoredLocale() ?? resolveBrowserLocale(languages);
}

export function getLocaleDirection(locale: SupportedLocale): LocaleDirection {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function applyDocumentLocale(locale: SupportedLocale): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = locale;
  document.documentElement.dir = getLocaleDirection(locale);
}
