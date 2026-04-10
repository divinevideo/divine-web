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

type LocaleResourceSet = Record<string, Record<string, unknown>>;

const localeModules = import.meta.glob('./locales/*/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const resources: Record<SupportedLocale, LocaleResourceSet> = SUPPORTED_LOCALES.reduce(
  (accumulator, locale) => {
    accumulator[locale] = {};
    return accumulator;
  },
  {} as Record<SupportedLocale, LocaleResourceSet>,
);

for (const [path, module] of Object.entries(localeModules)) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) {
    continue;
  }

  const [, locale, namespace] = match;
  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    continue;
  }

  resources[locale as SupportedLocale][namespace] = module as Record<string, unknown>;
}

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
  const namespaces = Array.from(
    new Set(Object.values(resources).flatMap((namespacesByLocale) => Object.keys(namespacesByLocale))),
  );

  await instance.use(initReactI18next).init({
    defaultNS: 'common',
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      escapeValue: false,
    },
    lng: locale,
    ns: namespaces,
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
