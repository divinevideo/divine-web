import { describe, expect, it } from 'vitest';
import { resources } from './index';

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

// Arabic plural categories embed the numeral grammatically (singular and dual
// forms carry no numeral, e.g. "فيديو واحد" / "فيديوهان"), so {{count}} is
// intentionally absent from these forms.
const PLACEHOLDER_PARITY_EXCEPTIONS = new Set([
  'ar.common:categoriesPage.videoCount_one',
  'ar.common:categoriesPage.videoCount_two',
  'ar.common:categoriesPage.videoCount_zero',
]);

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
});
