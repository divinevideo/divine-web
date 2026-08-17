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

const localePathPattern = /^\.\/locales\/([^/]+)\/([^/]+)\.json$/;

const englishModules = import.meta.glob('./locales/en/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const lazyLocaleModules = import.meta.glob(['./locales/*/*.json', '!./locales/en/*.json'], {
  import: 'default',
}) as Record<string, () => Promise<unknown>>;

function parseLocalePath(path: string): { locale: SupportedLocale; namespace: string } | null {
  const match = path.match(localePathPattern);
  if (!match) {
    return null;
  }

  const [, locale, namespace] = match;
  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    return null;
  }

  return { locale: locale as SupportedLocale, namespace };
}

function collectLocaleResources(
  locale: SupportedLocale,
  modules: Record<string, unknown>,
): LocaleResourceSet {
  const resources: LocaleResourceSet = {};

  for (const [path, module] of Object.entries(modules)) {
    const parsed = parseLocalePath(path);
    if (!parsed || parsed.locale !== locale) {
      continue;
    }

    resources[parsed.namespace] = module as Record<string, unknown>;
  }

  return resources;
}

const englishResources = collectLocaleResources(DEFAULT_LOCALE, englishModules);
const namespaces = Object.keys(englishResources);
const localeResourcePromises = new Map<SupportedLocale, Promise<LocaleResourceSet>>();

async function loadLocaleResources(locale: SupportedLocale): Promise<LocaleResourceSet> {
  if (locale === DEFAULT_LOCALE) {
    return englishResources;
  }

  const existingPromise = localeResourcePromises.get(locale);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = Promise.all(
    Object.entries(lazyLocaleModules)
      .filter(([path]) => parseLocalePath(path)?.locale === locale)
      .map(async ([path, load]) => {
        const parsed = parseLocalePath(path);
        const module = await load();
        return parsed ? ([parsed.namespace, module] as const) : null;
      }),
  ).then((entries) =>
    entries.reduce<LocaleResourceSet>((accumulator, entry) => {
      if (!entry) {
        return accumulator;
      }

      const [namespace, module] = entry;
      accumulator[namespace] = module as Record<string, unknown>;
      return accumulator;
    }, {}),
  ).catch((error: unknown) => {
    localeResourcePromises.delete(locale);
    throw error;
  });

  localeResourcePromises.set(locale, promise);
  return promise;
}

function addLocaleResourceBundles(
  instance: I18nInstance,
  locale: SupportedLocale,
  resources: LocaleResourceSet,
): void {
  for (const [namespace, catalog] of Object.entries(resources)) {
    if (!instance.hasResourceBundle(locale, namespace)) {
      instance.addResourceBundle(locale, namespace, catalog, true, true);
    }
  }
}

async function loadInitialLocale(locale: SupportedLocale): Promise<SupportedLocale> {
  try {
    await loadLocaleResources(locale);
    return locale;
  } catch {
    return DEFAULT_LOCALE;
  }
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
  const detectedLanguages =
    options.languages ?? (typeof navigator === 'undefined' ? undefined : navigator.languages);
  const requestedLocale = resolveInitialLocale(detectedLanguages);
  const locale = await loadInitialLocale(requestedLocale);
  const instance = i18next.createInstance();
  const resources: Partial<Record<SupportedLocale, LocaleResourceSet>> = {
    [DEFAULT_LOCALE]: englishResources,
  };

  if (locale !== DEFAULT_LOCALE) {
    resources[locale] = await loadLocaleResources(locale);
  }

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
  try {
    const resources = await loadLocaleResources(locale);
    addLocaleResourceBundles(instance, locale, resources);
    await instance.changeLanguage(locale);
  } catch {
    await instance.changeLanguage(DEFAULT_LOCALE);
  }
}
