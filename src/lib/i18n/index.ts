import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  applyDocumentLocale,
  normalizeLocale,
  resolveInitialLocale,
  type SupportedLocale,
} from './config';
import arCommon from './locales/ar/common.json';
import deCommon from './locales/de/common.json';
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import frCommon from './locales/fr/common.json';
import idCommon from './locales/id/common.json';
import itCommon from './locales/it/common.json';
import jaCommon from './locales/ja/common.json';
import koCommon from './locales/ko/common.json';
import nlCommon from './locales/nl/common.json';
import plCommon from './locales/pl/common.json';
import ptCommon from './locales/pt/common.json';
import roCommon from './locales/ro/common.json';
import svCommon from './locales/sv/common.json';
import trCommon from './locales/tr/common.json';

const resources = {
  en: { common: enCommon },
  es: { common: esCommon },
  tr: { common: trCommon },
  ja: { common: jaCommon },
  de: { common: deCommon },
  pt: { common: ptCommon },
  fr: { common: frCommon },
  id: { common: idCommon },
  nl: { common: nlCommon },
  sv: { common: svCommon },
  ro: { common: roCommon },
  it: { common: itCommon },
  pl: { common: plCommon },
  ko: { common: koCommon },
  ar: { common: arCommon },
} as const;

export interface InitializeI18nOptions {
  force?: boolean;
  languages?: readonly string[];
}

function bindDocumentLocale(instance: I18nInstance): void {
  const apply = (language: string) => {
    const normalized = normalizeLocale(language) ?? DEFAULT_LOCALE;
    applyDocumentLocale(normalized);
  };

  apply(instance.language);
  instance.on('languageChanged', apply);
}

export async function createI18nInstance(
  options: InitializeI18nOptions = {},
): Promise<I18nInstance> {
  const locale = resolveInitialLocale(options.languages ?? navigator.languages);
  const instance = i18next.createInstance();

  await instance.use(initReactI18next).init({
    defaultNS: 'common',
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      escapeValue: false,
    },
    lng: locale,
    ns: ['common'],
    resources,
    returnNull: false,
    supportedLngs: [...SUPPORTED_LOCALES],
  });

  bindDocumentLocale(instance);

  return instance;
}

let singletonPromise: Promise<I18nInstance> | null = null;

export async function initializeI18n(
  options: InitializeI18nOptions = {},
): Promise<I18nInstance> {
  if (!singletonPromise || options.force) {
    singletonPromise = createI18nInstance(options);
  }

  return singletonPromise;
}

export async function changeLanguage(locale: SupportedLocale): Promise<void> {
  const instance = await initializeI18n();
  await instance.changeLanguage(locale);
}

export { resources };
