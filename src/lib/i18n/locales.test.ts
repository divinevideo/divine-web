import { describe, expect, it } from 'vitest';
import { resources } from './index';

const PLURAL_SUFFIXES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const LOCALES_REQUIRING_FULL_PLURAL_COVERAGE = new Set(['ar']);

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(nested, nextPrefix);
  });
}

function extractPlaceholders(value: unknown): string[] {
  if (typeof value === 'string') {
    return [...value.matchAll(/\{\{[^}]+\}\}/g)].map((match) => match[0]).sort();
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).flatMap(extractPlaceholders);
  }

  return [];
}

function getByPath(catalog: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      catalog,
    );
}

function getPluralCategoryMap(keys: string[]): Map<string, Set<string>> {
  const categoriesByBase = new Map<string, Set<string>>();

  for (const key of keys) {
    const match = key.match(/^(.*)_([^_.]+)$/);
    if (!match || !PLURAL_SUFFIXES.has(match[2])) {
      continue;
    }

    const [, base, category] = match;
    const categories = categoriesByBase.get(base) ?? new Set<string>();
    categories.add(category);
    categoriesByBase.set(base, categories);
  }

  return categoriesByBase;
}

// Arabic plural categories embed the numeral grammatically (singular and dual
// forms carry no numeral, e.g. "فيديو واحد" / "فيديوهان"), so {{count}} is
// intentionally absent from these forms.
const PLACEHOLDER_PARITY_EXCEPTIONS = new Set([
  'ar.common:categoriesPage.videoCount_one',
  'ar.common:categoriesPage.videoCount_two',
  'ar.common:categoriesPage.videoCount_zero',
]);

/**
 * Whole-sentence keys that cannot legitimately be identical to English. Short
 * labels are excluded on purpose: "Reposts", "Likes" and "Notifications" are
 * genuinely the same word in several locales, so a blanket comparison would
 * only produce noise. Key parity alone does not catch a locale that shipped
 * the English string as a placeholder.
 */
const MUST_BE_TRANSLATED_PREFIXES = [
  'notificationsPage.message.',
  'notificationsPage.video.',
];

describe('i18n locale resources', () => {
  it('keeps every locale aligned with the english namespaces', () => {
    for (const [namespace, englishCatalog] of Object.entries(resources.en)) {
      const englishKeys = flattenKeys(englishCatalog).sort();

      for (const [locale, namespaces] of Object.entries(resources)) {
        const localeCatalog = namespaces[namespace as keyof typeof namespaces];
        const localeKeys = new Set(flattenKeys(localeCatalog));
        const missingKeys = englishKeys.filter((key) => !localeKeys.has(key));

        expect(
          missingKeys,
          `${locale}.${namespace} is missing keys:\n${missingKeys.join('\n')}`,
        ).toEqual([]);
      }
    }
  });

  it('preserves interpolation placeholders across every locale', () => {
    for (const [namespace, englishCatalog] of Object.entries(resources.en)) {
      const englishKeys = flattenKeys(englishCatalog).sort();

      for (const key of englishKeys) {
        const expected = extractPlaceholders(getByPath(englishCatalog, key));
        if (expected.length === 0) {
          continue;
        }

        for (const [locale, namespaces] of Object.entries(resources)) {
          if (PLACEHOLDER_PARITY_EXCEPTIONS.has(`${locale}.${namespace}:${key}`)) {
            continue;
          }

          const localeCatalog = namespaces[namespace as keyof typeof namespaces];
          const actual = extractPlaceholders(getByPath(localeCatalog, key));

          expect(
            actual,
            `${locale}.${namespace}:${key} must keep placeholders ${expected.join(' ')}`,
          ).toEqual(expected);
        }
      }
    }
  });

  it('does not ship english placeholders for whole-sentence keys', () => {
    for (const [namespace, englishCatalog] of Object.entries(resources.en)) {
      const englishKeys = flattenKeys(englishCatalog)
        .filter((key) => MUST_BE_TRANSLATED_PREFIXES.some((prefix) => key.startsWith(prefix)))
        .sort();

      for (const [locale, namespaces] of Object.entries(resources)) {
        if (locale === 'en') {
          continue;
        }

        const localeCatalog = namespaces[namespace as keyof typeof namespaces];
        const untranslated = englishKeys.filter(
          (key) => getByPath(localeCatalog, key) === getByPath(englishCatalog, key),
        );

        expect(
          untranslated,
          `${locale}.${namespace} still holds the english string for:\n${untranslated.join('\n')}`,
        ).toEqual([]);
      }
    }
  });

  it('covers every reachable plural category for whole-sentence keys', () => {
    // A missing category is not a missing key: i18next resolves the suffix from
    // Intl.PluralRules, finds nothing, and falls back to English. pl selects
    // "many" for 13 and ro selects "few", so _one/_other alone leaves both
    // rendering the english string for most counts.
    for (const [locale, namespaces] of Object.entries(resources)) {
      const requiredCategories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

      for (const [namespace, catalog] of Object.entries(namespaces)) {
        const pluralBases = getPluralCategoryMap(
          flattenKeys(catalog).filter((key) =>
            MUST_BE_TRANSLATED_PREFIXES.some((prefix) => key.startsWith(prefix)),
          ),
        );

        const missingCategories = [...pluralBases.entries()].flatMap(([base, categories]) =>
          requiredCategories
            .filter((category) => !categories.has(category))
            .map((category) => `${base}_${category}`),
        );

        expect(
          missingCategories,
          `${locale}.${namespace} would fall back to english for:\n${missingCategories.join('\n')}`,
        ).toEqual([]);
      }
    }
  });

  it('covers every Intl plural category for locales with full plural forms', () => {
    for (const [locale, namespaces] of Object.entries(resources)) {
      if (!LOCALES_REQUIRING_FULL_PLURAL_COVERAGE.has(locale)) {
        continue;
      }

      const requiredCategories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

      for (const [namespace, catalog] of Object.entries(namespaces)) {
        const pluralBases = getPluralCategoryMap(flattenKeys(catalog));
        const missingCategories = [...pluralBases.entries()].flatMap(([base, categories]) =>
          requiredCategories
            .filter((category) => !categories.has(category))
            .map((category) => `${base}_${category}`),
        );

        expect(
          missingCategories,
          `${locale}.${namespace} is missing plural categories:\n${missingCategories.join('\n')}`,
        ).toEqual([]);
      }
    }
  });
});
